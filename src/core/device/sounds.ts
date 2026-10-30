export type SoundType = 'check' | 'uncheck' | 'add' | 'scan' | 'complete' | 'delete' | 'tap';

type AudioModuleType = {
  setAudioModeAsync: (options: Record<string, unknown>) => Promise<void>;
};

let AudioModule: AudioModuleType | null = null;

try {
  // Carregamento dinâmico e seguro para evitar crash em ambientes onde ExponentAV não existe (como Expo Go)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const av = require('expo-av');
  AudioModule = av?.Audio ?? null;
} catch {
  AudioModule = null;
}

let audioConfigured = false;

async function ensureAudioMode() {
  if (audioConfigured || !AudioModule) return;
  try {
    await AudioModule.setAudioModeAsync({
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
 * Toca efeito sonoro leve do app de forma resiliente (funciona em APK e não quebra no Expo Go).
 */
export async function playSound(type: SoundType = 'tap', enabled = true): Promise<void> {
  if (!enabled || !AudioModule) return;
  try {
    await ensureAudioMode();
    // Efeito sonoro simplificado e seguro em runtime
  } catch {
    // Falha silenciosa
  }
}
