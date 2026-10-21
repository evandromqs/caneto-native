import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { List } from '../../data';
import { ModalSheet } from '../../ui/ModalSheet';
import { theme } from '../../ui/theme';
import { loadHistory, type PaymentMethod, type Purchase } from './repository';
import { getErrorMessage } from '../../ui/error';

const methods: { id: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'pix', label: 'Pix', icon: 'qr-code-outline' }, { id: 'debito', label: 'Cartão de Débito', icon: 'card-outline' }, { id: 'credito', label: 'Cartão de Crédito', icon: 'card-outline' }, { id: 'dinheiro', label: 'Dinheiro', icon: 'cash-outline' },
];
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PaymentModal({ visible, list, onClose, onConfirm }: { visible: boolean; list: List | null; onClose: () => void; onConfirm: (method: PaymentMethod) => Promise<void> }) {
  return visible ? <PaymentDialog list={list} onClose={onClose} onConfirm={onConfirm} /> : null;
}
function PaymentDialog({ list, onClose, onConfirm }: { list: List | null; onClose: () => void; onConfirm: (method: PaymentMethod) => Promise<void> }) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const checked = list?.items.filter(item => item.checked) ?? [];
  const target = checked.length ? checked : list?.items ?? [];
  const total = target.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  return <ModalSheet visible title="Finalizar compras" subtitle={list?.name} onClose={onClose}>
    <View style={styles.summary}><Text style={styles.summaryLabel}>{target.length} produtos</Text><Text style={styles.total}>{currency(total)}</Text></View>
    <Text style={styles.label}>Forma de pagamento</Text>
    {methods.map(entry => <Pressable key={entry.id} style={[styles.method, method === entry.id && styles.methodActive]} onPress={() => setMethod(entry.id)}><Ionicons name={entry.icon} size={21} color={theme.blue} /><Text style={styles.methodText}>{entry.label}</Text><Ionicons name={method === entry.id ? 'radio-button-on' : 'radio-button-off'} size={21} color={theme.blue} /></Pressable>)}
    {!!message && <Text style={styles.message}>{message}</Text>}
    <Pressable style={[styles.primary, (busy || !target.length) && styles.disabled]} disabled={busy || !target.length} onPress={async () => { setBusy(true); try { await onConfirm(method); onClose(); } catch (error) { setMessage(getErrorMessage(error)); } finally { setBusy(false); } }}><Text style={styles.primaryText}>{busy ? 'Finalizando...' : 'Finalizar compras'}</Text></Pressable>
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

const styles = StyleSheet.create({
  summary: { padding: 16, backgroundColor: theme.blueSoft, borderRadius: 14, marginBottom: 18 }, summaryLabel: { color: theme.muted, fontFamily: theme.font.semibold }, total: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 20 }, label: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15, marginBottom: 10 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 13, marginBottom: 8 }, methodActive: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, methodText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  message: { color: theme.danger, fontFamily: theme.font.regular, marginVertical: 10 }, primary: { backgroundColor: theme.blue, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 }, primaryText: { color: 'white', fontFamily: theme.font.bold }, disabled: { opacity: 0.5 }, empty: { color: theme.muted, fontFamily: theme.font.regular, textAlign: 'center', marginVertical: 30 }, historyCard: { padding: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 14, marginBottom: 10 }, historyName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, muted: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 }, recreate: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }, recreateText: { color: theme.blue, fontFamily: theme.font.semibold },
});
