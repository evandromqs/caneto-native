import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createThemedStyles, theme } from '../../ui/theme';
import { isExpoGo, requestPasswordReset, signInWithGoogle } from './auth';
import type { GoogleSignInResult } from './auth';

type Props = {
  onGoogleResult?: (result: GoogleSignInResult) => void;
  onError?: (message: string) => void;
};

function GoogleColorIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginRight: 10 }}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

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
      {busy ? (
        <ActivityIndicator color={theme.blue} />
      ) : (
        <View style={styles.googleContent}>
          <GoogleColorIcon />
          <Text style={styles.googleText}>Continuar com o Google</Text>
        </View>
      )}
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

const styles = createThemedStyles(theme => StyleSheet.create({
  google: { borderColor: theme.borderStrong, borderWidth: 1, borderRadius: 14, minHeight: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, paddingHorizontal: 20, marginTop: 10 },
  googleContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  forgot: { alignItems: 'center', justifyContent: 'center', minHeight: 40, marginTop: 10 },
  forgotText: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 14 },
  hint: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 12, textAlign: 'center', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { backgroundColor: theme.surface, borderRadius: 24, padding: 24, gap: 12 },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 21 },
  description: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14 },
  input: { minHeight: 50, height: 50, borderRadius: 12, borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 14, color: theme.ink, fontFamily: theme.font.regular },
  message: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 },
  primary: { minHeight: 50, height: 50, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primaryText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 15 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14 },
}));
