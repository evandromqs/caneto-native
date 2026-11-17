import { Component, type ReactNode } from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';
import App from '../../App';
import { getThemeColors } from '../ui/theme';

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[Caneto] Falha ao renderizar o app', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const palette = getThemeColors(Appearance.getColorScheme() === 'dark');
    return <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.ink }]}>Não foi possível abrir o Caneto</Text>
      <Text style={[styles.message, { color: palette.muted }]}>{this.state.error.message}</Text>
      <Pressable style={[styles.button, { backgroundColor: palette.blue }]} accessibilityRole="button" onPress={() => this.setState({ error: null })}>
        <Text style={styles.buttonText}>Tentar novamente</Text>
      </Pressable>
    </View>;
  }
}

export default function IndexRoute() {
  return <AppErrorBoundary><App /></AppErrorBoundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  title: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#0F172A', textAlign: 'center' },
  message: { marginTop: 8, fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#475569', textAlign: 'center' },
  button: { marginTop: 20, backgroundColor: '#0943F1', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
});
