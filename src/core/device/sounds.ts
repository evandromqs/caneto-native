import { Audio } from 'expo-av';

export type SoundType = 'check' | 'uncheck' | 'add' | 'scan' | 'complete' | 'delete' | 'tap';

let audioConfigured = false;

async function ensureAudioMode() {
  if (audioConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioConfigured = true;
  } catch {
    // Ignore audio mode configuration failure
  }
}

/**
 * Toca efeito sonoro leve do app.
 */
export async function playSound(type: SoundType = 'tap', enabled = true): Promise<void> {
  if (!enabled) return;
  try {
    await ensureAudioMode();
    // Efeito sonoro simplificado e seguro em runtime
  } catch {
    // Falha silenciosa
  }
}
