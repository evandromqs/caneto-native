import { supabase } from '../../supabase';

export type Profile = { display_name: string; username: string; visibility: 'public' | 'private'; is_photo_public: boolean };

export async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('display_name,username,visibility,is_photo_public').eq('id', userId).maybeSingle();
  if (error) throw error;
  return { display_name: data?.display_name ?? '', username: data?.username ?? '', visibility: data?.visibility === 'private' ? 'private' : 'public', is_photo_public: data?.is_photo_public !== false };
}

export async function saveProfile(userId: string, profile: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ id: userId, ...profile }, { onConflict: 'id' });
  if (error) throw error;
}
