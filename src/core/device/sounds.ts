export type SoundType = 'check' | 'uncheck' | 'add' | 'scan' | 'complete' | 'delete' | 'tap';

/**
 * Efeitos sonoros ficaram desativados no Android para não depender do expo-av,
 * que não possui versão compatível com o SDK 57 e derrubava o app no start.
 */
export async function playSound(_type: SoundType = 'tap', _enabled = true): Promise<void> {}
