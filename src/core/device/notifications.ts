import { Platform } from 'react-native';

let Notifications: any = null;

try {
  // Carregamento dinâmico e seguro para evitar crash em ambientes onde ExpoTopicSubscriptionModule não existe (como Expo Go)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority?.HIGH,
      }),
    });
  }
} catch (error) {
  console.warn('[Notifications] Notificações nativas não disponíveis neste ambiente (ex: Expo Go):', error);
  Notifications = null;
}

/**
 * Solicita permissões de notificação no dispositivo Android ou iOS.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Caneto',
        importance: Notifications.AndroidImportance?.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0943F1',
      });
    }

    return true;
  } catch (error) {
    console.warn('Erro ao solicitar permissões de notificação:', error);
    return false;
  }
}

/**
 * Dispara uma notificação local de teste ou aviso.
 */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // dispara imediatamente
    });
  } catch (error) {
    console.warn('Erro ao disparar notificação local:', error);
  }
}
