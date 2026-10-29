import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configura o comportamento padrão quando uma notificação chega em primeiro plano com tratamento de exceção seguro
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch (error) {
  console.warn('Erro ao configurar handler de notificações:', error);
}

/**
 * Solicita permissões de notificação no dispositivo Android ou iOS.
 */
export async function requestNotificationPermission(): Promise<boolean> {
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
        importance: Notifications.AndroidImportance.MAX,
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
