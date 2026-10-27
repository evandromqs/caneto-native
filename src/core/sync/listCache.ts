import 'expo-sqlite/localStorage/install';

const keyFor = (userId: string) => `caneto.lists.${userId}`;
const listeners = new Set<(userId: string) => void>();

export function subscribeListCache(listener: (userId: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function readListCache<T>(userId: string): T[] | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeListCache<T>(userId: string, lists: T[]): void {
  if (!userId || typeof localStorage === 'undefined') return;
  localStorage.setItem(keyFor(userId), JSON.stringify(lists));
  for (const listener of listeners) listener(userId);
}
