import { Stack } from 'expo-router';
import { theme } from '../ui/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return <SafeAreaProvider>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
  </SafeAreaProvider>;
}
