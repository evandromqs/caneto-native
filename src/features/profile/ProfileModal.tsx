import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { loadProfile, saveProfile, type Profile } from './repository';
import { getErrorMessage } from '../../ui/error';

const empty: Profile = { display_name: '', username: '', visibility: 'public', is_photo_public: true };

export function ProfileModal({ visible, userId, email, onClose }: { visible: boolean; userId: string; email: string; onClose: () => void }) {
  return visible ? <ProfileDialog key={userId} userId={userId} email={email} onClose={onClose} /> : null;
}

function ProfileDialog({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile>(empty);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; loadProfile(userId).then(value => { if (active) setProfile(value); }).catch(error => { if (active) setMessage(String(error)); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [userId]);
  return <ModalSheet visible title="Meu perfil" subtitle={email} onClose={onClose}>
    <Text style={styles.label}>Nome exibido</Text><TextInput style={styles.input} value={profile.display_name} onChangeText={display_name => setProfile(old => ({ ...old, display_name }))} maxLength={60} placeholder="Seu nome" />
    <Text style={styles.label}>Nome de usuário</Text><TextInput style={styles.input} value={profile.username} onChangeText={value => setProfile(old => ({ ...old, username: value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) }))} maxLength={20} autoCapitalize="none" placeholder="seu_usuario" />
    <Text style={styles.label}>Visibilidade</Text><View style={styles.segment}>{(['public', 'private'] as const).map(value => <Pressable key={value} style={[styles.segmentButton, profile.visibility === value && styles.segmentActive]} onPress={() => setProfile(old => ({ ...old, visibility: value }))}><Text style={[styles.segmentText, profile.visibility === value && styles.segmentTextActive]}>{value === 'public' ? 'Público' : 'Privado'}</Text></Pressable>)}</View>
    <View style={styles.switchRow}><Text style={styles.label}>Foto de perfil pública</Text><Switch value={profile.is_photo_public} onValueChange={is_photo_public => setProfile(old => ({ ...old, is_photo_public }))} trackColor={{ true: theme.blue }} /></View>
    {!!message && <Text style={styles.message}>{message}</Text>}
    <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={async () => { if (!profile.display_name.trim() || profile.username.length < 3) { setMessage('Informe seu nome e um usuário com ao menos 3 caracteres.'); return; } setBusy(true); setMessage(''); try { await saveProfile(userId, { ...profile, display_name: profile.display_name.trim() }); onClose(); } catch (error) { setMessage(getErrorMessage(error)); } finally { setBusy(false); } }}><Text style={styles.primaryText}>{busy ? 'Aguarde...' : 'Salvar perfil'}</Text></Pressable>
  </ModalSheet>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  label: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14, marginBottom: 7 }, input: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, fontSize: 16, fontFamily: theme.font.regular, marginBottom: 17 },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 17 }, segmentButton: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, alignItems: 'center' }, segmentActive: { backgroundColor: theme.blue, borderColor: theme.blue }, segmentText: { color: theme.ink, fontFamily: theme.font.semibold }, segmentTextActive: { color: 'white' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, primary: { backgroundColor: theme.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 15 }, disabled: { opacity: 0.5 }, message: { color: theme.danger, fontFamily: theme.font.regular, marginBottom: 10 },
}));
