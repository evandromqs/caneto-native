import { supabase } from '../../supabase';

export type Visibility = 'public' | 'discrete' | 'private';
export type Preferences = {
  theme?: 'light' | 'dark' | 'system';
  fontSize?: 'small' | 'normal' | 'large';
  highContrast?: boolean;
  soundEffects?: boolean;
  vibration?: boolean;
  checkboxStyle?: 'circle' | 'switch';
  hasCompletedOnboarding?: boolean;
  [key: string]: unknown;
};
export type AccountProfile = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  visibility: Visibility;
  isPhotoPublic: boolean;
  preferences: Preferences;
};
export type AccountProfileChanges = Partial<Pick<AccountProfile,
  'username' | 'displayName' | 'avatarUrl' | 'visibility' | 'isPhotoPublic' | 'preferences'>>;

async function requireUser(expectedUserId?: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Entre na sua conta para editar o perfil.');
  if (expectedUserId && expectedUserId !== data.user.id) throw new Error('Conta diferente da sessão atual.');
  return data.user;
}

export async function loadAccountProfile(expectedUserId?: string): Promise<AccountProfile | null> {
  const user = await requireUser(expectedUserId);
  const { data, error } = await supabase.from('profiles')
    .select('id,email,username,display_name,avatar_url,visibility,is_photo_public,preferences')
    .eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, email: data.email, username: data.username,
    displayName: data.display_name, avatarUrl: data.avatar_url,
    visibility: data.visibility === 'public' || data.visibility === 'discrete' ? data.visibility : 'private',
    isPhotoPublic: data.is_photo_public !== false,
    preferences: data.preferences && typeof data.preferences === 'object' && !Array.isArray(data.preferences)
      ? data.preferences as Preferences : {},
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

export async function isUsernameAvailable(value: string, expectedUserId?: string): Promise<boolean> {
  const user = await requireUser(expectedUserId);
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) return false;
  const { data, error } = await supabase.from('public_profiles').select('id')
    .ilike('username', username).maybeSingle();
  if (error) throw error;
  return !data || data.id === user.id;
}

export async function saveAccountProfile(changes: AccountProfileChanges, expectedUserId?: string): Promise<AccountProfile> {
  const user = await requireUser(expectedUserId);
  const previous = await loadAccountProfile(user.id);
  const username = changes.username === undefined ? previous?.username ?? null :
    changes.username === null ? null : normalizeUsername(changes.username);
  if (username && !/^[a-z0-9_.]{3,30}$/.test(username)) {
    throw new Error('A tag deve ter entre 3 e 30 caracteres: letras, números, ponto ou sublinhado.');
  }
  const preferences = { ...previous?.preferences, ...changes.preferences };
  const profilePayload = {
    email: previous?.email ?? user.email ?? null,
    username,
    display_name: changes.displayName === undefined ? previous?.displayName ?? null : changes.displayName?.trim() || null,
    avatar_url: changes.avatarUrl === undefined ? previous?.avatarUrl ?? null : changes.avatarUrl,
    visibility: changes.visibility ?? previous?.visibility ?? 'private',
    is_photo_public: changes.isPhotoPublic ?? previous?.isPhotoPublic ?? true,
    preferences,
    updated_at: Date.now(),
  };
  const { error } = previous
    ? await supabase.from('profiles').update(profilePayload).eq('id', user.id)
    : await supabase.from('profiles').insert({ id: user.id, ...profilePayload });
  if (error) throw error;
  const saved = await loadAccountProfile(user.id);
  if (!saved) throw new Error('Perfil salvo, mas não foi possível carregá-lo.');
  return saved;
}

export async function completeOnboarding(input: {
  displayName: string;
  username: string;
  avatarUrl?: string;
  visibility: Visibility;
  isPhotoPublic: boolean;
  preferences: Preferences;
}, expectedUserId?: string): Promise<AccountProfile> {
  if (!input.displayName.trim()) throw new Error('Informe o nome que aparecerá no seu perfil.');
  return saveAccountProfile({
    displayName: input.displayName,
    username: input.username,
    avatarUrl: input.avatarUrl ?? 'emoji:🛒',
    visibility: input.visibility,
    isPhotoPublic: input.isPhotoPublic,
    preferences: { ...input.preferences, hasCompletedOnboarding: true },
  }, expectedUserId);
}

export async function updatePreferences(preferences: Preferences, expectedUserId?: string): Promise<AccountProfile> {
  const user = await requireUser(expectedUserId);
  const previous = await loadAccountProfile(user.id);
  const mergedPreferences = { ...previous?.preferences, ...preferences };
  const now = Date.now();
  const { error } = previous
    ? await supabase.from('profiles').update({ preferences: mergedPreferences, updated_at: now }).eq('id', user.id)
    : await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      visibility: 'private',
      is_photo_public: true,
      preferences: mergedPreferences,
      updated_at: now,
    });
  if (error) throw error;
  const saved = await loadAccountProfile(user.id);
  if (!saved) throw new Error('Preferências salvas, mas não foi possível carregar o perfil.');
  return saved;
}
