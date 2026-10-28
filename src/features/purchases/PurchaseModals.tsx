import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { List } from '../../data';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';
import { ScannerModal } from '../capture/ScannerModal';
import { loadHistory, type PaymentMethod, type Purchase, type PurchaseReceipt } from './repository';

const methods: { id: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'pix', label: 'Pix', icon: 'qr-code-outline' },
  { id: 'debito', label: 'Cartão de Débito', icon: 'card-outline' },
  { id: 'credito', label: 'Cartão de Crédito', icon: 'card-outline' },
  { id: 'dinheiro', label: 'Dinheiro', icon: 'cash-outline' },
];
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentModal({ visible, list, userId, onClose, onConfirm }: {
  visible: boolean;
  list: List | null;
  userId: string;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, receipt: PurchaseReceipt) => Promise<void>;
}) {
  return visible ? <PaymentDialog list={list} userId={userId} onClose={onClose} onConfirm={onConfirm} /> : null;
}

function PaymentDialog({ list, userId, onClose, onConfirm }: {
  list: List | null;
  userId: string;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, receipt: PurchaseReceipt) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [receiptPhoto, setReceiptPhoto] = useState('');
  const [receiptQr, setReceiptQr] = useState('');
  const [storeName, setStoreName] = useState(list?.store_name || '');
  const [storeCnpj, setStoreCnpj] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const checked = list?.items.filter(item => item.checked) ?? [];
  const target = checked.length ? checked : list?.items ?? [];
  const calculated = target.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const [totalText, setTotalText] = useState(calculated.toFixed(2).replace('.', ','));
  const paid = Number(totalText.replace(/\./g, '').replace(',', '.'));
  const finalTotal = Number.isFinite(paid) && paid >= 0 ? paid : calculated;
  const hasReceipt = Boolean(receiptPhoto || receiptQr);
  const difference = Math.abs(finalTotal - calculated) >= 0.01;

  const finish = async () => {
    setBusy(true);
    setMessage('');
    try {
      await onConfirm(method, {
        photoUrl: receiptPhoto || undefined,
        qrCode: receiptQr || undefined,
        total: finalTotal,
        pendingReceipt: !hasReceipt || (difference && !hasReceipt),
        storeName: storeName || undefined,
        storeCnpj: storeCnpj || undefined,
      });
      onClose();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  };

  return <ModalSheet visible title="Finalizar compra" subtitle={step === 1 ? 'Passo 1 de 3 · Forma de pagamento' : step === 2 ? 'Passo 2 de 3 · Nota ou recibo' : 'Passo 3 de 3 · Confirmar total'} onClose={onClose}>
    <View style={styles.steps}>{[1, 2, 3].map(value => <View key={value} style={[styles.step, value <= step && styles.stepOn]} />)}</View>
    {step === 1 && <>
      <View style={styles.summary}><Text style={styles.summaryLabel}>{target.length} produtos</Text><Text style={styles.total}>{currency(calculated)}</Text></View>
      {methods.map(entry => <Pressable key={entry.id} style={[styles.method, method === entry.id && styles.methodActive]} onPress={() => setMethod(entry.id)} accessibilityRole="radio" accessibilityState={{ selected: method === entry.id }}>
        <Ionicons name={entry.icon} size={21} color={theme.blue} /><Text style={styles.methodText}>{entry.label}</Text><Ionicons name={method === entry.id ? 'radio-button-on' : 'radio-button-off'} size={21} color={theme.blue} />
      </Pressable>)}
      <Pressable style={[styles.primary, !target.length && styles.disabled]} disabled={!target.length} onPress={() => setStep(2)}><Text style={styles.primaryText}>Continuar</Text></Pressable>
    </>}
    {step === 2 && <>
      <Text style={styles.label}>Leia o QR da NFC-e ou anexe uma foto do recibo. Dá para pular e marcar a nota como pendente.</Text>
      <Pressable style={styles.secondary} onPress={() => setScanning(true)}><Ionicons name="scan-outline" size={18} color={theme.blue} /><Text style={styles.secondaryText}>Ler nota fiscal</Text></Pressable>
      {!!receiptQr && <Text style={styles.muted}>QR lido{storeCnpj ? ` · CNPJ ${storeCnpj}` : ''}</Text>}
      {!!storeName && <Text style={styles.muted}>{storeName}</Text>}
      {!!receiptPhoto && <Text style={styles.muted}>Foto do comprovante anexada.</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.secondary, styles.rowButton]} onPress={() => setStep(1)}><Text style={styles.secondaryText}>Voltar</Text></Pressable>
        <Pressable style={[styles.primary, styles.rowButton]} onPress={() => setStep(3)}><Text style={styles.primaryText}>{hasReceipt ? 'Continuar' : 'Seguir sem nota'}</Text></Pressable>
      </View>
    </>}
    {step === 3 && <>
      <Text style={styles.label}>Total calculado da lista: {currency(calculated)}</Text>
      <Text style={styles.label}>Total pago</Text>
      <TextInput style={styles.input} value={totalText} onChangeText={setTotalText} keyboardType="decimal-pad" accessibilityLabel="Total pago" />
      {difference && <Text style={styles.warning}>O valor pago difere do calculado. Sem comprovante, a compra fica com nota pendente.</Text>}
      {!!message && <Text style={styles.message}>{message}</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.secondary, styles.rowButton]} onPress={() => setStep(2)}><Text style={styles.secondaryText}>Voltar</Text></Pressable>
        <Pressable style={[styles.primary, styles.rowButton, busy && styles.disabled]} disabled={busy} onPress={() => void finish()}><Text style={styles.primaryText}>{busy ? 'Salvando...' : 'Confirmar compra'}</Text></Pressable>
      </View>
    </>}
    <ScannerModal visible={scanning} userId={userId} purpose="receipt" onClose={() => setScanning(false)} onConfirm={async result => {
      setReceiptQr(result.receiptQr || '');
      setReceiptPhoto(result.receiptPhoto || '');
      if (result.total != null) setTotalText(result.total.toFixed(2).replace('.', ','));
      if (result.storeName) setStoreName(result.storeName);
      if (result.cnpj) setStoreCnpj(result.cnpj);
    }} />
  </ModalSheet>;
}

export function HistoryModal({ visible, userId, onClose, onRecreate }: { visible: boolean; userId: string; onClose: () => void; onRecreate: (record: Purchase) => Promise<void> }) {
  const [records, setRecords] = useState<Purchase[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!visible) return; let active = true; loadHistory(userId).then(data => { if (active) setRecords(data); }).catch(error => { if (active) setMessage(getErrorMessage(error)); }); return () => { active = false; }; }, [visible, userId]);
  return <ModalSheet visible={visible} title="Histórico de Compras" subtitle="Compras finalizadas" onClose={onClose}>
    {!!message && <Text style={styles.message}>{message}</Text>}
    {!records.length && <Text style={styles.empty}>Nenhum histórico ainda.</Text>}
    {records.map(record => <View key={record.id} style={styles.historyCard}><Text style={styles.historyName}>{record.list_name}</Text>{!!record.store_name && <Text style={styles.muted}>{record.store_name}</Text>}<Text style={styles.muted}>{new Date(record.completed_at).toLocaleDateString('pt-BR')} · {record.total_items} produtos</Text><Text style={styles.total}>{currency(Number(record.total_spent))}</Text><Pressable style={styles.recreate} onPress={() => void onRecreate(record).then(onClose).catch(error => setMessage(getErrorMessage(error)))}><Ionicons name="refresh-outline" size={17} color={theme.blue} /><Text style={styles.recreateText}>Criar lista novamente</Text></Pressable></View>)}
  </ModalSheet>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6, marginBottom: 14 }, step: { flex: 1, height: 6, borderRadius: 4, backgroundColor: theme.border }, stepOn: { backgroundColor: theme.blue },
  summary: { padding: 16, backgroundColor: theme.blueSoft, borderRadius: 14, marginBottom: 18 }, summaryLabel: { color: theme.muted, fontFamily: theme.font.semibold }, total: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 20 }, label: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 14, marginBottom: 10 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 13, marginBottom: 8 }, methodActive: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, methodText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  message: { color: theme.danger, fontFamily: theme.font.regular, marginVertical: 10 }, warning: { color: theme.warning, fontFamily: theme.font.regular, marginBottom: 8 },
  primary: { backgroundColor: theme.blue, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 }, primaryText: { color: 'white', fontFamily: theme.font.bold },
  secondary: { borderWidth: 1, borderColor: theme.blue, borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 }, secondaryText: { color: theme.blue, fontFamily: theme.font.semibold },
  row: { flexDirection: 'row', gap: 8 }, rowButton: { flex: 1 }, input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.ink, fontFamily: theme.font.bold, fontSize: 18 },
  disabled: { opacity: 0.5 }, empty: { color: theme.muted, fontFamily: theme.font.regular, textAlign: 'center', marginVertical: 30 }, historyCard: { padding: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 14, marginBottom: 10 }, historyName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, muted: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 }, recreate: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }, recreateText: { color: theme.blue, fontFamily: theme.font.semibold },
}));
