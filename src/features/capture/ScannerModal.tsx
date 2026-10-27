import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { CANETO_API } from '../../core/api';
import { parseNfceQrCode } from '../../core/scanner/nfce';
import { assertCanScan, consumeAiScan, readScanQuota, type ScanQuota } from '../../core/scanner/quota';
import { canetoData } from '../../core/data/supabaseAdapter';
import { ModalSheet } from '../../ui/ModalSheet';
import { theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';

export type CapturedItem = {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
  categoryId: string;
  ean?: string;
  brand?: string;
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

const modes: { id: Mode; label: string }[] = [
  { id: 'ean', label: 'Código' },
  { id: 'product', label: 'Produto' },
  { id: 'invoice', label: 'Nota' },
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

  const lookupEan = async (code: string) => {
    const response = await fetch(`${CANETO_API}/api/products/scan?ean=${encodeURIComponent(code)}`);
    const body = await response.json() as { found?: boolean; product?: { name?: string; brand?: string; ean?: string; categoryId?: string } };
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

  return <ModalSheet visible title={purpose === 'receipt' ? 'Comprovante' : 'Leitor'} subtitle={quota ? `IA: ${quota.scansRemaining} de ${quota.scansLimit} leituras neste mês` : 'Câmera'} onClose={onClose}>
    <View style={styles.modes}>{modes.map(entry => <Pressable key={entry.id} style={[styles.mode, mode === entry.id && styles.modeOn]} onPress={() => { setMode(entry.id); setDraft(null); lock.current = false; setError(''); }}><Text style={[styles.modeText, mode === entry.id && styles.modeTextOn]}>{entry.label}</Text></Pressable>)}</View>
    {!permission?.granted ? <Pressable style={styles.primary} onPress={() => void requestPermission()}><Text style={styles.primaryText}>Permitir câmera</Text></Pressable> : !draft && <CameraView
      ref={camera}
      style={styles.camera}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: mode === 'invoice' ? ['qr'] : ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}
      onBarcodeScanned={mode === 'product' ? undefined : event => { void onBarcode(event); }}
    />}
    {mode === 'product' && !draft && <Pressable style={styles.primary} disabled={busy} onPress={() => void recognizePhoto()}><Ionicons name="camera" size={18} color="white" /><Text style={styles.primaryText}>{busy ? 'Lendo...' : 'Fotografar produto ou etiqueta'}</Text></Pressable>}
    {busy && <ActivityIndicator color={theme.blue} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!draft && <View style={styles.draft}>
      {draft.items.map(item => <Text key={`${item.ean || item.name}`} style={styles.item}>{item.quantity} {item.unit} · {item.name}{item.price != null ? ` · ${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</Text>)}
      {!!draft.storeName && <Text style={styles.item}>{draft.storeName}</Text>}
      {draft.total != null && <Text style={styles.item}>Total da nota: {draft.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>}
      {!draft.items.length && !draft.receiptQr && <Text style={styles.item}>Nada identificado.</Text>}
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => { setDraft(null); lock.current = false; }}><Text style={styles.secondaryText}>Ler de novo</Text></Pressable>
        <Pressable style={styles.primary} disabled={busy} onPress={() => void confirm()}><Text style={styles.primaryText}>{purpose === 'receipt' ? 'Usar comprovante' : 'Adicionar à lista'}</Text></Pressable>
      </View>
    </View>}
  </ModalSheet>;
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mode: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: theme.blue, borderColor: theme.blue },
  modeText: { color: theme.ink, fontFamily: theme.font.semibold },
  modeTextOn: { color: 'white' },
  camera: { height: 280, borderRadius: 16, overflow: 'hidden', backgroundColor: '#020817' },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginTop: 10 },
  primaryText: { color: 'white', fontFamily: theme.font.bold },
  secondary: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: theme.blue, fontFamily: theme.font.semibold },
  error: { color: theme.danger, fontFamily: theme.font.regular, marginTop: 8 },
  draft: { gap: 8, marginTop: 12 },
  item: { color: theme.ink, fontFamily: theme.font.regular },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
