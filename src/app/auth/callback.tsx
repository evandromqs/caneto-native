import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccountRedirect } from '../../features/account/useAccountRedirect';
import { RecoveryPasswordForm } from '../../features/account/RecoveryPasswordForm';
import { theme } from '../../ui/theme';

export default function AccountCallbackRoute() {
  const [status, setStatus] = useState<'checking' | 'recovery' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useAccountRedirect(result => {
    if (result.kind === 'recovery') setStatus('recovery');
    if (result.kind === 'signed-in') router.replace('/');
  }, error => { setMessage(error.message); setStatus('error'); });

  useEffect(() => {
    if (status !== 'checking') return;
    const timeout = setTimeout(() => {
      setMessage('Não foi possível validar o link. Solicite um novo e-mail de recuperação.');
      setStatus('error');
    }, 12000);
    return () => clearTimeout(timeout);
  }, [status]);

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <View style={styles.content}>
      {status === 'checking' && <><ActivityIndicator size="large" color={theme.blue} /><Text style={styles.message}>Validando seu link...</Text></>}
      {status === 'recovery' && <RecoveryPasswordForm onComplete={() => router.replace('/')} />}
      {status === 'error' && <><Text style={styles.error}>{message}</Text><Pressable style={styles.button} onPress={() => router.replace('/')}><Text style={styles.buttonText}>Voltar ao login</Text></Pressable></>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 18 },
  message: { color: theme.muted, fontFamily: theme.font.regular, textAlign: 'center' },
  error: { color: theme.danger, fontFamily: theme.font.semibold, textAlign: 'center' },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontFamily: theme.font.semibold },
});
