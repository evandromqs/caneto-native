import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../ui/theme';
import { isExpoGo, requestPasswordReset, signInWithGoogle } from './auth';
import type { GoogleSignInResult } from './auth';

type Props = {
  onGoogleResult?: (result: GoogleSignInResult) => void;
  onError?: (message: string) => void;
};

/** Drop into the existing login screen below email/password fields. */
export function AccountAuthActions({ onGoogleResult, onError }: Props) {
  const [resetOpen, setResetOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const google = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      onGoogleResult?.(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Não foi possível entrar com o Google.');
    } finally { setBusy(false); }
  };
  const sendReset = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await requestPasswordReset(email);
      setMessage('Se este e-mail estiver cadastrado, você receberá um link de recuperação.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.');
    } finally { setBusy(false); }
  };

  return <>
    <Pressable style={styles.google} onPress={() => { void google(); }} accessibilityRole="button"
      accessibilityLabel="Continuar com o Google" disabled={busy}>
      {busy ? <ActivityIndicator color={theme.blue} /> : <Text style={styles.googleText}>Continuar com o Google</Text>}
    </Pressable>
    {isExpoGo ? <Text style={styles.hint}>Google requer uma build de desenvolvimento do Caneto.</Text> : null}
    <Pressable style={styles.forgot} onPress={() => { setMessage(''); setResetOpen(true); }} accessibilityRole="button">
      <Text style={styles.forgotText}>Esqueceu a senha?</Text>
    </Pressable>
    <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Recuperar senha</Text>
          <Text style={styles.description}>Enviaremos um link para o e-mail da sua conta.</Text>
          <TextInput style={styles.input} placeholder="Seu e-mail" placeholderTextColor={theme.subtle}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email}
            onChangeText={setEmail} editable={!busy} accessibilityLabel="E-mail para recuperação" />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable style={styles.primary} onPress={() => { void sendReset(); }} accessibilityRole="button" disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Enviar link</Text>}
          </Pressable>
          <Pressable style={styles.cancel} onPress={() => setResetOpen(false)} accessibilityRole="button">
            <Text style={styles.cancelText}>Fechar</Text>
          </Pressable>
          {isExpoGo ? <Text style={styles.hint}>Para abrir o link no app, teste uma build de desenvolvimento.</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  google: { borderColor: theme.borderStrong, borderWidth: 1, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  googleText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15 },
  forgot: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 8 },
  forgotText: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 14 },
  hint: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 12, textAlign: 'center', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 12 },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 21 },
  description: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 14, color: theme.ink, fontFamily: theme.font.regular },
  message: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 },
  primary: { minHeight: 50, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primaryText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 15 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14 },
});
