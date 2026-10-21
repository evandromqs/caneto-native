import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { theme } from '../../ui/theme';
import type { List } from '../../data';
import { ensureShareCode, loadAccessRequests, respondAccessRequest, type AccessRequest } from './repository';

export function JoinListModal({ visible, onClose, onJoin }: { visible: boolean; onClose: () => void; onJoin: (code: string) => Promise<'joined' | 'pending'> }) {
  return visible ? <JoinListDialog onClose={onClose} onJoin={onJoin} /> : null;
}
function JoinListDialog({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => Promise<'joined' | 'pending'> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <ModalSheet visible title="Entrar em uma lista" subtitle="Compartilhada com você" onClose={onClose}>
    <Text style={styles.explanation}>Digite o código recebido para solicitar acesso. O dono da lista aprova sua primeira entrada.</Text>
    <Text style={styles.label}>Código da lista</Text>
    <TextInput style={styles.input} value={code} onChangeText={value => { setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setMessage(''); }} autoCapitalize="characters" maxLength={8} placeholder="Ex: COM123" />
    {!!message && <Text style={styles.message}>{message}</Text>}
    <Pressable style={[styles.primary, (busy || code.length < 4) && styles.disabled]} disabled={busy || code.length < 4} onPress={async () => { setBusy(true); try { const result = await onJoin(code); setMessage(result === 'pending' ? 'Solicitação enviada. Aguarde a aprovação do dono da lista.' : 'Você entrou na lista.'); if (result === 'joined') onClose(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }}><Text style={styles.primaryText}>{busy ? 'Aguarde...' : 'Solicitar acesso'}</Text></Pressable>
  </ModalSheet>;
}

export function ShareListModal({ visible, list, onClose, onChanged }: { visible: boolean; list: List | null; onClose: () => void; onChanged: () => Promise<void> }) {
  return visible && list ? <ShareListDialog key={list.id} list={list} onClose={onClose} onChanged={onChanged} /> : null;
}
function ShareListDialog({ list, onClose, onChanged }: { list: List; onClose: () => void; onChanged: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const sync = async () => { try { const shareCode = await ensureShareCode(list); const pending = await loadAccessRequests(list.id); if (active) { setCode(shareCode); setRequests(pending); setMessage(''); } } catch (error) { if (active) setMessage(error instanceof Error ? error.message : String(error)); } };
    void sync();
    const timer = setInterval(() => void sync(), 12000);
    return () => { active = false; clearInterval(timer); };
  }, [list]);
  return <ModalSheet visible title="Compartilhar lista" subtitle={list.name} onClose={onClose}>
    <Text style={styles.explanation}>Envie o link. Você aprova o primeiro acesso; depois a pessoa pode editar a lista.</Text>
    <Pressable style={[styles.primary, !code && styles.disabled]} disabled={!code} onPress={() => void Share.share({ message: `https://caneto.online/app?code=${code}` })}><Ionicons name="share-social-outline" color="white" size={19} /><Text style={styles.primaryText}>Compartilhar link</Text></Pressable>
    <View style={styles.codeBox}><Text style={styles.label}>Código</Text><Text style={styles.code}>{code || 'Gerando...'}</Text></View>
    {!!message && <Text style={styles.message}>{message}</Text>}
    {requests.length > 0 && <Text style={styles.requestsTitle}>Solicitações de acesso ({requests.length})</Text>}
    {requests.map(request => <View key={request.id} style={styles.request}><Text style={styles.requestName}>{request.requester_name}</Text><Pressable accessibilityLabel={`Aprovar ${request.requester_name}`} onPress={() => void respondAccessRequest(request.id, true).then(async () => { setRequests(current => current.filter(item => item.id !== request.id)); await onChanged(); }).catch(error => setMessage(String(error)))}><Ionicons name="checkmark-circle" size={28} color="#059669" /></Pressable><Pressable accessibilityLabel={`Recusar ${request.requester_name}`} onPress={() => void respondAccessRequest(request.id, false).then(() => setRequests(current => current.filter(item => item.id !== request.id))).catch(error => setMessage(String(error)))}><Ionicons name="close-circle" size={28} color={theme.danger} /></Pressable></View>)}
  </ModalSheet>;
}

const styles = StyleSheet.create({
  explanation: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14, lineHeight: 22, marginBottom: 18 },
  label: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, fontSize: 17, fontFamily: theme.font.bold, marginBottom: 14, letterSpacing: 2 },
  primary: { backgroundColor: theme.blue, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 15 }, disabled: { opacity: 0.5 },
  message: { color: theme.muted, fontFamily: theme.font.regular, marginVertical: 12 }, codeBox: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 13, marginTop: 14 }, code: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 19, letterSpacing: 2 }, requestsTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 15, marginTop: 20, marginBottom: 8 }, request: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: 1, borderTopColor: theme.border }, requestName: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold },
});
