import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

export const CURRENT_APP_VERSION = Constants.expoConfig?.version ?? '1.0.3';
export const GITHUB_REPO = 'evandromqs/caneto-native';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface AppReleaseInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle: string;
  releaseNotes: string;
  apkUrl: string;
  apkName: string;
  publishedAt: string;
}

/**
 * Normaliza e compara versões no padrão semver (ex: v1.0.2 vs 1.0.3)
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      .split('.')
      .map(n => parseInt(n, 10) || 0);

  const lParts = clean(latest);
  const cParts = clean(current);

  const maxLen = Math.max(lParts.length, cParts.length);
  for (let i = 0; i < maxLen; i++) {
    const l = lParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Consulta a API do GitHub para obter a última release pública
 */
export async function checkAppUpdate(): Promise<AppReleaseInfo | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CanetoNativeApp',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API HTTP ${response.status}`);
    }

    const data = await response.json();
    const latestTag = (data.tag_name || '').trim();
    const assets: ReleaseAsset[] = data.assets || [];

    // Localiza o asset de APK
    const apkAsset =
      assets.find(a => a.name.endsWith('.apk')) ||
      assets.find(a => a.browser_download_url.endsWith('.apk'));

    const apkUrl = apkAsset?.browser_download_url || data.html_url;
    const apkName = apkAsset?.name || 'caneto-update.apk';
    const hasUpdate = isNewerVersion(latestTag, CURRENT_APP_VERSION);

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestTag.replace(/^v/i, ''),
      releaseTitle: data.name || `Caneto ${latestTag}`,
      releaseNotes: data.body || '',
      apkUrl,
      apkName,
      publishedAt: data.published_at || '',
    };
  } catch (error) {
    console.warn('Erro ao verificar atualizações no GitHub:', error);
    return null;
  }
}

/**
 * Inicia o download do APK diretamente pelo navegador/download manager do Android
 */
export async function downloadAndInstallApk(apkUrl: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(apkUrl);
    if (supported) {
      await Linking.openURL(apkUrl);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Falha ao abrir URL de atualização:', err);
    return false;
  }
}
