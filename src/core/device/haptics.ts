import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

let hapticsEnabledGlobal = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabledGlobal = enabled;
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabledGlobal;
}

/**
 * Dispara feedback tátil seguro respeitando a preferência do usuário.
 * No Android combina expo-haptics com Vibration.vibrate para funcionar mesmo
 * quando o feedback de toque do sistema está desativado.
 */
export async function triggerHaptic(type: HapticType = 'selection', enabled: boolean = hapticsEnabledGlobal): Promise<void> {
  if (!enabled) return;
  try {
    if (Platform.OS === 'android') {
      const duration =
        type === 'selection' ? 12
        : type === 'light' ? 16
        : type === 'medium' ? 24
        : type === 'heavy' ? 38
        : type === 'success' ? 28
        : 32;
      Vibration.vibrate(duration);
    }
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Falha silenciosa em dispositivos sem motor háptico
  }
}
