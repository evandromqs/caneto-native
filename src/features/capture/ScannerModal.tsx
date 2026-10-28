import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CANETO_API } from '../../core/api';
import { parseNfceQrCode } from '../../core/scanner/nfce';
import { assertCanScan, consumeAiScan, readScanQuota, type ScanQuota } from '../../core/scanner/quota';
import { canetoData } from '../../core/data/supabaseAdapter';
import { createThemedStyles } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';

export type CapturedItem = {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  categoryId: string;
  ean?: string;
  brand?: string;
  photoUrl?: string;
};

export type CaptureResult = {
  items: CapturedItem[];
  receiptQr?: string;
  receiptPhoto?: string;
  total?: number;
  cnpj?: string;
  storeName?: string;
};

type Mode = 'ean' | 'product' | 'invoice';

const modes: { id: Mode; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { id: 'ean', label: 'Código', icon: 'barcode-outline', hint: 'Aponte para o código de barras do produto' },
  { id: 'product', label: 'Produto', icon: 'cube-outline', hint: 'Centralize o produto e toque no botão de captura' },
  { id: 'invoice', label: 'Nota', icon: 'receipt-outline', hint: 'Aponte para o QR Code da nota fiscal' },
];

export function ScannerModal({ visible, userId, purpose = 'items', onClose, onConfirm }: {
  visible: boolean;
  userId: string;
  purpose?: 'items' | 'receipt';
  onClose: () => void;
  onConfirm: (result: CaptureResult) => Promise<void>;
}) {
  return visible ? <ScannerDialog key={purpose} userId={userId} purpose={purpose} onClose={onClose} onConfirm={onConfirm} /> : null;
}

function ScannerDialog({ userId, purpose, onClose, onConfirm }: {
  userId: string;
  purpose: 'items' | 'receipt';
  onClose: () => void;
  onConfirm: (result: CaptureResult) => Promise<void>;
}) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>(purpose === 'receipt' ? 'invoice' : 'ean');
  const [quota, setQuota] = useState<ScanQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<CaptureResult | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    void canetoData.profile(userId).then(profile => setQuota(readScanQuota(profile))).catch(() => setQuota(readScanQuota()));
  }, [userId]);

  const remember = (result: CaptureResult) => {
    setDraft(result);
    setError('');
  };

  const updateDraftItem = (index: number, patch: Partial<CapturedItem>) => {
    setDraft(current => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
  };

  const lookupEan = async (code: string) => {
    const response = await fetch(`${CANETO_API}/api/products/scan?ean=${encodeURIComponent(code)}`);
    const body = await response.json() as { found?: boolean; product?: { name?: string; brand?: string; ean?: string; categoryId?: string; image?: string } };
    const product = body.product;
    remember({
      items: [{
        name: product?.name || `Produto ${code}`,
        quantity: 1,
        unit: 'un',
        price: null,
        categoryId: product?.categoryId || 'mercearia',
        ean: product?.ean || code,
        brand: product?.brand,
        photoUrl: product?.image,
      }],
    });
  };

  const recognizePhoto = async () => {
    assertCanScan(quota);
    setBusy(true);
    setError('');
    try {
      const shot = await camera.current?.takePictureAsync({ base64: true, quality: 0.4 });
      if (!shot?.base64) throw new Error('Não foi possível capturar a foto.');
      const image = `data:image/jpeg;base64,${shot.base64}`;
      const response = await fetch(`${CANETO_API}/api/products/ai-recognize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }),
      });
      const body = await response.json() as { error?: string; product?: { name?: string; brand?: string; categoryId?: string; unit?: string; quantity?: number; price?: number; barcode?: string } };
      if (!response.ok || !body.product?.name) throw new Error(body.error || 'Não foi possível reconhecer o produto.');
      await consumeAiScan(userId);
      setQuota(readScanQuota());
      const product = body.product;
      remember({
        items: [{
          name: product.name || 'Produto',
          quantity: product.quantity || 1,
          unit: product.unit || 'un',
          price: typeof product.price === 'number' ? product.price : null,
          categoryId: product.categoryId || 'mercearia',
          ean: product.barcode,
          brand: product.brand,
        }],
        receiptPhoto: mode === 'invoice' ? image : undefined,
      });
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const onBarcode = async (scan: BarcodeScanningResult) => {
    if (lock.current || busy || draft) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (mode === 'invoice') {
        const parsed = parseNfceQrCode(scan.data);
        if (!parsed.chaveAcesso) throw new Error(parsed.erroValidacao || 'QR fiscal não reconhecido.');
        let storeName: string | undefined;
        let total = parsed.valorTotal;
        let items: CapturedItem[] = [];
        let detailError = '';
        try {
          assertCanScan(quota);
          const response = await fetch(`${CANETO_API}/api/invoices/parse`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: parsed.urlConsulta || parsed.chaveAcesso }),
          });
          const body = await response.json() as { ok?: boolean; error?: string; totalAmount?: number; items?: { name?: string; quantity?: number; unit?: string; price?: number; categoryId?: string }[] };
          if (parsed.cnpj) {
            const company = await fetch(`${CANETO_API}/api/cnpj/${parsed.cnpj}`).then(res => res.json()).catch(() => null) as { ok?: boolean; store?: { nomeFantasia?: string; razaoSocial?: string } } | null;
            storeName = company?.store?.nomeFantasia || company?.store?.razaoSocial;
          }
          if (response.ok || body.ok) {
            await consumeAiScan(userId);
            setQuota(readScanQuota());
          }
          items = (body.items || []).filter(item => item.name).map(item => ({
            name: item.name || 'Item', quantity: item.quantity || 1, unit: item.unit || 'un',
            price: typeof item.price === 'number' ? item.price : null, categoryId: item.categoryId || 'mercearia',
          }));
          total = body.totalAmount || parsed.valorTotal;
          if (!response.ok && !parsed.valorTotal) detailError = body.error || 'A nota foi lida, mas o detalhe fiscal não voltou.';
        } catch (cause) {
          detailError = getErrorMessage(cause);
        }
        remember({
          items: purpose === 'receipt' ? [] : items,
          receiptQr: scan.data, total, cnpj: parsed.cnpjFormatado, storeName,
        });
        if (detailError) setError(detailError);
      } else {
        await lookupEan(scan.data.replace(/\D/g, ''));
      }
    } catch (cause) {
      setError(getErrorMessage(cause));
      lock.current = false;
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await onConfirm(draft);
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const activeMode = modes.find(entry => entry.id === mode) ?? modes[0];

  return <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent><SafeAreaView style={styles.fullscreen} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.header}>
      <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Fechar câmera"><Ionicons name="close" size={22} color="white" /></Pressable>
      <View style={styles.scannerMark}><Ionicons name="scan-outline" size={19} color="#8FABFF" /></View>
      <View style={styles.headerText}><Text style={styles.headerTitle}>{purpose === 'receipt' ? 'Capturar nota fiscal' : 'Capturar produto'}</Text><Text style={styles.headerSubtitle}>Código, foto inteligente ou nota fiscal</Text></View>
      {!!quota && <View style={styles.quota}><Ionicons name="sparkles" size={13} color="#A7F3D0" /><Text style={styles.quotaText}>{quota.scansRemaining}/{quota.scansLimit}</Text></View>}
    </View>
    <View style={styles.modes}>{modes.map(entry => { const selected = mode === entry.id; return <Pressable key={entry.id} style={[styles.mode, selected && styles.modeOn]} onPress={() => { setMode(entry.id); setDraft(null); lock.current = false; setError(''); }} accessibilityRole="tab" accessibilityState={{ selected }}><Ionicons name={entry.icon} size={17} color={selected ? '#FFFFFF' : '#94A3B8'} /><Text style={[styles.modeText, selected && styles.modeTextOn]}>{entry.label}</Text></Pressable>; })}</View>

    {!draft ? <View style={styles.captureArea}>
      {!permission?.granted ? <View style={styles.permissionCard}><View style={styles.permissionIcon}><Ionicons name="camera-outline" size={30} color="#8FABFF" /></View><Text style={styles.permissionTitle}>A câmera precisa de permissão</Text><Text style={styles.permissionText}>Use a câmera para ler códigos e reconhecer produtos.</Text><Pressable style={styles.permissionButton} onPress={() => void requestPermission()}><Text style={styles.primaryText}>Permitir câmera</Text></Pressable></View> : <>
        <View style={styles.cameraFrame}>
          <CameraView ref={camera} style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: mode === 'invoice' ? ['qr'] : ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }} onBarcodeScanned={mode === 'product' ? undefined : event => { void onBarcode(event); }} />
          <View style={styles.cameraOverlay} pointerEvents="none"><View style={styles.scanTarget}><View style={styles.scanLine} /></View></View>
          {busy && <View style={styles.cameraBusy}><ActivityIndicator color="#FFFFFF" size="large" /><Text style={styles.cameraBusyText}>{mode === 'product' ? 'Reconhecendo produto...' : 'Consultando código...'}</Text></View>}
        </View>
        <View style={styles.instruction}><Ionicons name={activeMode.icon} size={17} color="#8FABFF" /><Text style={styles.instructionText}>{activeMode.hint}</Text></View>
        {mode === 'product' && <Pressable style={({ pressed }) => [styles.captureButton, pressed && styles.capturePressed, busy && styles.disabled]} disabled={busy} onPress={() => void recognizePhoto()} accessibilityLabel="Fotografar produto"><View style={styles.captureButtonInner}><Ionicons name="camera" size={28} color="#FFFFFF" /></View></Pressable>}
      </>}
      {!!error && <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" /><Text style={styles.error}>{error}</Text></View>}
    </View> : <ScrollView style={styles.draftScroll} contentContainerStyle={styles.draft} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.draftHeader}><View style={styles.draftIcon}><Ionicons name="scan-outline" size={20} color="#8FABFF" /></View><View style={styles.draftHeading}><Text style={styles.draftTitle}>{mode === 'invoice' ? 'Nota Fiscal Reconhecida' : 'Confirmar Item'}</Text><Text style={styles.draftSubtitle}>Revise os dados antes de salvar</Text></View><Pressable style={styles.draftClose} onPress={() => { setDraft(null); lock.current = false; }} accessibilityLabel="Fechar confirmação"><Ionicons name="close" size={20} color="#CBD5E1" /></Pressable></View>
      {draft.items.map((item, index) => purpose === 'items' ? <View key={`${item.ean || index}`} style={styles.productDraft}>
        <View style={styles.productVisual}>{item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.productImage} /> : <Ionicons name="cube-outline" size={36} color="#8FABFF" />}</View>
        <Text style={styles.fieldLabel}>Nome do Produto</Text><TextInput style={styles.field} value={item.name} onChangeText={name => updateDraftItem(index, { name })} placeholder="Nome do produto" placeholderTextColor="#64748B" accessibilityLabel="Nome do produto" />
        <View style={styles.row}><View style={styles.flexField}><Text style={styles.fieldLabel}>Quantidade</Text><TextInput style={styles.field} value={String(item.quantity)} onChangeText={value => updateDraftItem(index, { quantity: Number(value.replace(',', '.')) || 1 })} keyboardType="decimal-pad" accessibilityLabel="Quantidade" /></View><View style={styles.shortField}><Text style={styles.fieldLabel}>Unidade</Text><TextInput style={styles.field} value={item.unit} onChangeText={unit => updateDraftItem(index, { unit })} accessibilityLabel="Unidade" /></View></View>
        <View style={styles.row}><View style={styles.flexField}><Text style={styles.fieldLabel}>Categoria</Text><TextInput style={styles.field} value={item.categoryId} onChangeText={categoryId => updateDraftItem(index, { categoryId })} placeholder="Categoria" placeholderTextColor="#64748B" accessibilityLabel="Categoria" /></View><View style={styles.flexField}><Text style={styles.fieldLabel}>Marca</Text><TextInput style={styles.field} value={item.brand || ''} onChangeText={brand => updateDraftItem(index, { brand })} placeholder="Marca" placeholderTextColor="#64748B" accessibilityLabel="Marca" /></View></View>
        <Text style={styles.fieldLabel}>Preço</Text><View style={styles.priceField}><Text style={styles.pricePrefix}>R$</Text><TextInput style={styles.priceInput} value={item.price == null ? '' : String(item.price).replace('.', ',')} onChangeText={value => updateDraftItem(index, { price: value.trim() ? Number(value.replace(',', '.')) || null : null })} placeholder="0,00" placeholderTextColor="#64748B" keyboardType="decimal-pad" accessibilityLabel="Preço" /></View>
        <Text style={styles.fieldLabel}>Código EAN</Text><TextInput style={styles.field} value={item.ean || ''} onChangeText={ean => updateDraftItem(index, { ean })} placeholder="Código de barras" placeholderTextColor="#64748B" keyboardType="number-pad" accessibilityLabel="Código EAN" />
      </View> : <View key={`${item.ean || index}`} style={styles.invoiceItem}><View style={styles.invoiceIndex}><Text style={styles.invoiceIndexText}>{index + 1}</Text></View><View style={styles.invoiceCopy}><Text style={styles.invoiceName}>{item.name}</Text><Text style={styles.invoiceMeta}>{item.quantity} {item.unit}{item.price != null ? ` · ${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</Text></View></View>)}
      {(draft.storeName || draft.total != null) && <View style={styles.invoiceSummary}>{!!draft.storeName && <Text style={styles.storeName}>{draft.storeName}</Text>}{draft.total != null && <Text style={styles.invoiceTotal}>Total da nota: {draft.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>}</View>}
      {!draft.items.length && !draft.receiptQr && <Text style={styles.emptyDraft}>Nada identificado.</Text>}
      {!!error && <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" /><Text style={styles.error}>{error}</Text></View>}
      <View style={styles.confirmActions}><Pressable style={styles.secondary} onPress={() => { setDraft(null); lock.current = false; }}><Ionicons name="refresh-outline" size={18} color="#CBD5E1" /><Text style={styles.secondaryText}>Ler de novo</Text></Pressable><Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => void confirm()}><Ionicons name="checkmark" size={19} color="#FFFFFF" /><Text style={styles.primaryText}>{purpose === 'receipt' ? 'Usar comprovante' : 'Adicionar à lista'}</Text></Pressable></View>
    </ScrollView>}
  </SafeAreaView></Modal>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: '#020817', paddingHorizontal: 16 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 6 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center' },
  scannerMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(9,67,241,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(143,171,255,0.25)' },
  headerText: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 17 },
  headerSubtitle: { color: '#94A3B8', fontFamily: theme.font.regular, fontSize: 11 },
  quota: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  quotaText: { color: '#A7F3D0', fontFamily: theme.font.bold, fontSize: 11 },
  modes: { flexDirection: 'row', gap: 7, marginVertical: 10, padding: 4, borderRadius: 15, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B' },
  mode: { flex: 1, minHeight: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  modeOn: { backgroundColor: theme.blue, borderColor: theme.blue },
  modeText: { color: '#94A3B8', fontFamily: theme.font.semibold, fontSize: 12 },
  modeTextOn: { color: '#FFFFFF' },
  captureArea: { flex: 1, paddingBottom: 12 },
  cameraFrame: { flex: 1, minHeight: 330, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,8,23,0.12)' },
  scanTarget: { width: '78%', height: '47%', borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.72)', justifyContent: 'center', overflow: 'hidden' },
  scanLine: { height: 2, width: '88%', alignSelf: 'center', backgroundColor: '#386BF6', shadowColor: '#386BF6', shadowOpacity: 0.9, shadowRadius: 7, elevation: 4 },
  cameraBusy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(2,8,23,0.72)' },
  cameraBusyText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 13 },
  instruction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  instructionText: { color: '#CBD5E1', fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center' },
  captureButton: { width: 68, height: 68, borderRadius: 34, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.14)' },
  captureButtonInner: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.blue },
  capturePressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  permissionCard: { marginTop: 24, padding: 24, borderRadius: 22, alignItems: 'center', gap: 9, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  permissionIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,67,241,0.20)' },
  permissionTitle: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 17, textAlign: 'center' },
  permissionText: { color: '#94A3B8', fontFamily: theme.font.regular, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  permissionButton: { minHeight: 46, marginTop: 8, borderRadius: 12, paddingHorizontal: 22, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1.2, minHeight: 48, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 12 },
  primaryText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },
  secondary: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#475569', backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  secondaryText: { color: '#CBD5E1', fontFamily: theme.font.semibold, fontSize: 13 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 9, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)', backgroundColor: 'rgba(127,29,29,0.25)' },
  error: { flex: 1, color: '#FCA5A5', fontFamily: theme.font.regular, fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.5 },
  draftScroll: { flex: 1, marginBottom: 8 },
  draft: { gap: 12, paddingVertical: 4, paddingBottom: 12 },
  draftHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#273449' },
  draftIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,67,241,0.20)' },
  draftHeading: { flex: 1 },
  draftTitle: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 16 },
  draftSubtitle: { color: '#94A3B8', fontFamily: theme.font.regular, fontSize: 11 },
  draftClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172033' },
  row: { flexDirection: 'row', gap: 9 },
  productDraft: { gap: 7, padding: 13, borderWidth: 1, borderColor: '#273449', borderRadius: 17, backgroundColor: '#0F172A' },
  productVisual: { width: 92, height: 92, borderRadius: 18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: '#172033', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  fieldLabel: { color: '#CBD5E1', fontFamily: theme.font.semibold, fontSize: 12, marginTop: 3 },
  field: { minHeight: 44, borderWidth: 1, borderColor: '#334155', backgroundColor: '#111B2E', borderRadius: 10, paddingHorizontal: 11, color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 13 },
  flexField: { flex: 1, minWidth: 0 },
  shortField: { width: 92 },
  priceField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#111B2E', paddingHorizontal: 11 },
  pricePrefix: { color: '#94A3B8', fontFamily: theme.font.bold, fontSize: 13 },
  priceInput: { flex: 1, color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 16, textAlign: 'center', paddingVertical: 8 },
  invoiceItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 13, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#273449' },
  invoiceIndex: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,67,241,0.22)' },
  invoiceIndexText: { color: '#8FABFF', fontFamily: theme.font.bold, fontSize: 12 },
  invoiceCopy: { flex: 1 },
  invoiceName: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 13 },
  invoiceMeta: { color: '#94A3B8', fontFamily: theme.font.regular, fontSize: 11 },
  invoiceSummary: { padding: 14, borderRadius: 15, backgroundColor: 'rgba(9,67,241,0.18)', borderWidth: 1, borderColor: 'rgba(56,107,246,0.30)' },
  storeName: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  invoiceTotal: { color: '#A7F3D0', fontFamily: theme.font.bold, fontSize: 15, marginTop: 3 },
  emptyDraft: { color: '#CBD5E1', fontFamily: theme.font.regular, textAlign: 'center', padding: 20 },
  confirmActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
}));
