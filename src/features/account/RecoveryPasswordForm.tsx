import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createThemedStyles, theme } from '../../ui/theme';
import { updatePassword } from './auth';

type Props = { onComplete: () => void };

/** Show after useAccountRedirect reports kind === 'recovery'. */
export function RecoveryPasswordForm({ onComplete }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    if (password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true);
    setError('');
    try { await updatePassword(password); onComplete(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>Criar nova senha</Text>
    <Text style={styles.description}>Escolha uma senha com pelo menos 8 caracteres.</Text>
    <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry
      autoComplete="new-password" placeholder="Nova senha" placeholderTextColor={theme.subtle}
      accessibilityLabel="Nova senha" editable={!busy} />
    <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry
      autoComplete="new-password" placeholder="Confirme a senha" placeholderTextColor={theme.subtle}
      accessibilityLabel="Confirmar nova senha" editable={!busy} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable style={styles.button} onPress={() => { void submit(); }} accessibilityRole="button" disabled={busy}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Salvar senha</Text>}
    </Pressable>
  </View>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  container: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 21 },
  description: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 14, color: theme.ink, fontFamily: theme.font.regular },
  error: { color: theme.danger, fontFamily: theme.font.regular, fontSize: 13 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 15 },
}));
