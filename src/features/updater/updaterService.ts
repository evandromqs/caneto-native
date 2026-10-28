import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { CANETO_API } from '../../core/api';

export const GITHUB_REPO = 'evandromqs/caneto-native';
const UPDATE_ENDPOINT = `${CANETO_API}/api/app-version`;
const GITHUB_RELEASE_ENDPOINT = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const UPDATE_REQUEST_TIMEOUT_MS = 8_000;
export const IS_EXPO_GO = Constants.appOwnership === 'expo';
export const CURRENT_APP_VERSION = (IS_EXPO_GO ? Constants.expoConfig?.version : Application.nativeApplicationVersion)
  ?? Constants.expoConfig?.version ?? '0.0.0';

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

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  state: string;
  size: number;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestRelease(): Promise<Response> {
  try {
    const response = await fetchWithTimeout(UPDATE_ENDPOINT, { Accept: 'application/json' });
    if (response.ok) return response;
  } catch (error) {
    console.warn('[Updater] Endpoint cacheado indisponível; usando fallback do GitHub.', error);
  }

  return fetchWithTimeout(GITHUB_RELEASE_ENDPOINT, {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CanetoNativeApp',
    'X-GitHub-Api-Version': '2022-11-28',
  });
}

function versionParts(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i.exec(version.trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

export function isNewerVersion(latest: string, current: string): boolean {
  const next = versionParts(latest);
  const installed = versionParts(current);
  if (!next || !installed) return false;
  for (let index = 0; index < 3; index++) {
    if (next[index] !== installed[index]) return next[index] > installed[index];
  }
  return false;
}

function validApkUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com'
      && url.pathname.startsWith(`/${GITHUB_REPO}/releases/download/`)
      && url.pathname.toLowerCase().endsWith('.apk');
  } catch {
    return false;
  }
}

/**
 * Consulta a API do GitHub para obter a última release pública
 */
export async function checkAppUpdate(): Promise<AppReleaseInfo | null> {
    if (Platform.OS !== 'android' || IS_EXPO_GO) return null;
    const response = await fetchLatestRelease();

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GitHub API HTTP ${response.status}`);
    }

    const data = await response.json();
    const latestTag = typeof data.tag_name === 'string' ? data.tag_name.trim() : '';
    if (!versionParts(latestTag)) throw new Error('A release do GitHub não tem uma versão válida.');
    const assets: ReleaseAsset[] = Array.isArray(data.assets) ? data.assets : [];
    const apkAsset = assets.find(asset => asset.state === 'uploaded'
      && asset.size > 0 && asset.name.toLowerCase().endsWith('.apk')
      && validApkUrl(asset.browser_download_url));
    if (!apkAsset) throw new Error('A release mais recente não contém um APK disponível.');
    const apkUrl = apkAsset.browser_download_url;
    const apkName = apkAsset.name;
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
}

/** Abre o navegador do Android para baixar o APK. A instalação é confirmada pelo usuário. */
export async function openApkDownload(apkUrl: string): Promise<void> {
  if (Platform.OS !== 'android' || IS_EXPO_GO) throw new Error('A atualização por APK só está disponível no aplicativo Android instalado.');
  if (!validApkUrl(apkUrl)) throw new Error('O link do APK é inválido.');
  await Linking.openURL(apkUrl);
}
