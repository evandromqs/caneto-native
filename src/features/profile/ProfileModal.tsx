import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { loadProfile, saveProfile, type Profile } from './repository';
import { getErrorMessage } from '../../ui/error';

const EMOJIS = ['🛒', '🥑', '🍕', '🍎', '⚡', '👑', '🦁', '🚀', '☕', '🌟', '😎', '🐶'];
const empty: Profile = { display_name: '', username: '', avatar_url: null, visibility: 'public', is_photo_public: true };

export function ProfileModal({ visible, userId, email, onClose }: { visible: boolean; userId: string; email: string; onClose: () => void }) {
  return visible ? <ProfileDialog key={userId} userId={userId} email={email} onClose={onClose} /> : null;
}

function ProfileDialog({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile>(empty);
  const [busy, setBusy] = useState(true);
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    loadProfile(userId)
      .then(value => { if (active) setProfile(value); })
      .catch(error => { if (active) setMessage(getErrorMessage(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userId]);

  const pickPhoto = async () => {
    setMessage('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      quality: 0.4,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setProfile(old => ({ ...old, avatar_url: `data:image/jpeg;base64,${result.assets[0].base64}` }));
      setPickingEmoji(false);
    }
  };

  const handleSave = async () => {
    if (!profile.display_name.trim() || profile.username.length < 3) {
      setMessage('Informe seu nome e um @usuário com ao menos 3 caracteres.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await saveProfile(userId, { ...profile, display_name: profile.display_name.trim() });
      onClose();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const avatar = profile.avatar_url ?? '';
  const isImageAvatar = avatar.startsWith('http') || avatar.startsWith('data:');
  const emojiAvatar = avatar.startsWith('emoji:') ? avatar.replace('emoji:', '') : '';
  const fallbackInitial = (profile.display_name || email || 'C').trim().charAt(0).toUpperCase();

  const footer = (
    <View style={styles.footerRow}>
      <Pressable style={styles.closeLeftBtn} onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Fechar">
        <Text style={styles.closeLeftText}>Fechar</Text>
      </Pressable>
      <Pressable style={[styles.primary, styles.footerPrimary, busy && styles.disabled]} disabled={busy} onPress={() => void handleSave()}>
        <Text style={styles.primaryText}>{busy ? 'Salvando...' : 'Salvar'}</Text>
      </Pressable>
    </View>
  );

  return (
    <ModalSheet visible title="Meu perfil" subtitle={email} hideCloseButton centerTitle onClose={onClose} footer={footer}>
      <View style={styles.avatarSection}>
        <View style={styles.avatarCircle}>
          {isImageAvatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{emojiAvatar || fallbackInitial}</Text>
          )}
        </View>
        <View style={styles.avatarActions}>
          <Pressable style={styles.avatarBtn} onPress={() => void pickPhoto()} disabled={busy}>
            <Ionicons name="image-outline" size={16} color={theme.ink} />
            <Text style={styles.avatarBtnText}>Foto</Text>
          </Pressable>
          <Pressable style={[styles.avatarBtn, pickingEmoji && styles.avatarBtnActive]} onPress={() => setPickingEmoji(v => !v)} disabled={busy}>
            <Ionicons name="happy-outline" size={16} color={pickingEmoji ? '#FFFFFF' : theme.ink} />
            <Text style={[styles.avatarBtnText, pickingEmoji && styles.avatarBtnTextActive]}>Emoji</Text>
          </Pressable>
        </View>
        {pickingEmoji && (
          <View style={styles.emojiStrip}>
            {EMOJIS.map(emoji => {
              const selected = emojiAvatar === emoji;
              return (
                <Pressable
                  key={emoji}
                  style={[styles.emojiChip, selected && styles.emojiChipActive]}
                  onPress={() => { setProfile(old => ({ ...old, avatar_url: `emoji:${emoji}` })); setPickingEmoji(false); }}
                >
                  <Text style={styles.emojiGlyph}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Nome exibido</Text>
        <TextInput
          style={styles.input}
          value={profile.display_name}
          onChangeText={display_name => setProfile(old => ({ ...old, display_name }))}
          maxLength={60}
          placeholder="Seu nome"
          placeholderTextColor={theme.muted}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Usuário</Text>
        <View style={styles.usernameBox}>
          <Text style={styles.atPrefix}>@</Text>
          <TextInput
            style={styles.usernameInput}
            value={profile.username}
            onChangeText={value => setProfile(old => ({ ...old, username: value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) }))}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="seu_usuario"
            placeholderTextColor={theme.muted}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Visibilidade</Text>
        <View style={styles.segment}>
          {(['public', 'private'] as const).map(value => {
            const active = profile.visibility === value;
            return (
              <Pressable
                key={value}
                style={[styles.segmentButton, active && styles.segmentActive]}
                onPress={() => setProfile(old => ({ ...old, visibility: value }))}
              >
                <Ionicons name={value === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={15} color={active ? '#FFFFFF' : theme.ink} />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{value === 'public' ? 'Público' : 'Privado'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Foto de perfil pública</Text>
        <Switch
          value={profile.is_photo_public}
          onValueChange={is_photo_public => setProfile(old => ({ ...old, is_photo_public }))}
          trackColor={{ false: theme.borderStrong, true: theme.blue }}
          thumbColor="#FFFFFF"
        />
      </View>

      {!!message && <Text style={styles.message}>{message}</Text>}
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  avatarSection: { alignItems: 'center', gap: 10, marginBottom: 14 },
  avatarCircle: { width: 72, height: 72, borderRadius: 22, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: theme.borderStrong },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 30 },
  avatarActions: { flexDirection: 'row', gap: 8 },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, minHeight: 36, borderRadius: 10, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong },
  avatarBtnActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  avatarBtnText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  avatarBtnTextActive: { color: '#FFFFFF' },
  emojiStrip: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, padding: 8, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  emojiChip: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  emojiChipActive: { borderColor: theme.blue, backgroundColor: theme.blueSoft },
  emojiGlyph: { fontSize: 19 },
  fieldGroup: { gap: 5, marginBottom: 12 },
  label: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  input: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontSize: 15, fontFamily: theme.font.semibold },
  usernameBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, gap: 6 },
  atPrefix: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 15 },
  usernameInput: { flex: 1, color: theme.ink, fontSize: 15, fontFamily: theme.font.semibold, paddingVertical: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentButton: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  segmentText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  segmentTextActive: { color: 'white' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  switchLabel: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  footerPrimary: { flex: 1 },
  closeLeftBtn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  closeLeftText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  primary: { backgroundColor: theme.blue, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  message: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center', marginTop: 10 },
}));
