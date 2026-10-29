import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const KEEP_AWAKE_TAG = 'caneto-shopping-list';

/**
 * Hook para manter a tela sempre acesa durante a compra se a opção estiver ativa.
 */
export function useKeepScreenAwake(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
      // Ignora erro se não suportado
    });

    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {
        // Ignora erro
      });
    };
  }, [enabled]);
}
