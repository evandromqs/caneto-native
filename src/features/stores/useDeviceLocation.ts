import { useEffect, useRef, useState } from 'react';
import type { Coordinates } from './model';

export function useDeviceLocation(enabled = true) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [message, setMessage] = useState('');
  const subscription = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void (async () => {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (permission.status !== 'granted') {
        setStatus('denied');
        setMessage('Ative a localização para ver lojas próximas e marcar a fachada.');
        return;
      }
      setStatus('granted');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active) setCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 30 },
        position => { if (active) setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }); },
      );
    })().catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível obter o GPS.');
    });
    return () => {
      active = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [enabled]);

  return { coords, status, message };
}
