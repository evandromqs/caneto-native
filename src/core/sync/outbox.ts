import 'expo-sqlite/localStorage/install';
import { supabase } from '../../supabase';
import { generateUUID } from '../../ui/error';

const OUTBOX_KEY = 'caneto.sync.outbox';
const META_KEY = 'caneto.sync.meta';

export type WriteAction = 'insert' | 'update' | 'delete' | 'upsert';

export type WriteOp = {
  id: string;
  userId: string;
  table: string;
  action: WriteAction;
  entityId: string;
  match: Record<string, string | number | boolean | null>;
  payload: Record<string, unknown> | null;
  onConflict?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

type SyncMeta = { online: boolean; pending: number; lastError: string | null; flushing: boolean };
type Listener = (meta: SyncMeta) => void;

let boundUserId = '';
let flushing = false;
const listeners = new Set<Listener>();

function readOps(): WriteOp[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as WriteOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOps(ops: WriteOp[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  emit();
}

function readMeta(): SyncMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) || '') as Partial<SyncMeta>;
    return { online: parsed.online !== false, pending: readOps().length, lastError: parsed.lastError ?? null, flushing };
  } catch {
    return { online: true, pending: readOps().length, lastError: null, flushing };
  }
}

function emit() {
  const meta = readMeta();
  localStorage.setItem(META_KEY, JSON.stringify({ online: meta.online, lastError: meta.lastError }));
  for (const listener of listeners) listener({ ...meta, pending: readOps().length, flushing });
}

export function bindSyncUser(userId: string) {
  boundUserId = userId;
}

export function currentSyncUserId() {
  return boundUserId;
}

export function getSyncSnapshot(): SyncMeta {
  return { ...readMeta(), pending: readOps().length, flushing };
}

export function subscribeSync(listener: Listener) {
  listeners.add(listener);
  listener(getSyncSnapshot());
  return () => { listeners.delete(listener); };
}

export function pendingOps(): WriteOp[] {
  return readOps();
}

export function isOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network|fetch|offline|internet|timeout|failed to connect|network request failed|sem conexão/i.test(message);
}

function isDuplicate(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /duplicate key|23505|already exists/i.test(message);
}

export async function isOnline(): Promise<boolean> {
  try {
    const Network = await import('expo-network');
    const state = await Network.getNetworkStateAsync();
    const online = !!state.isConnected && state.isInternetReachable !== false;
    const meta = readMeta();
    localStorage.setItem(META_KEY, JSON.stringify({ online, lastError: meta.lastError }));
    emit();
    return online;
  } catch {
    return true;
  }
}

async function applyOp(op: WriteOp) {
  if (op.action === 'insert') {
    const { error } = await supabase.from(op.table).insert(op.payload ?? {});
    if (error) throw new Error(error.message);
    return;
  }
  if (op.action === 'upsert') {
    const { error } = await supabase.from(op.table).upsert(op.payload ?? {}, { onConflict: op.onConflict || 'id' });
    if (error) throw new Error(error.message);
    return;
  }
  let query = op.action === 'delete'
    ? supabase.from(op.table).delete()
    : supabase.from(op.table).update(op.payload ?? {});
  for (const [name, value] of Object.entries(op.match)) {
    query = value === null ? query.is(name, null) : query.eq(name, value as never);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  emit();
  try {
    const online = await isOnline();
    if (!online) return;
    // Always read the current head: writes added during a flush must never be
    // replaced by an older snapshot of the queue.
    while (readOps().length) {
      const op = readOps().find(row => !boundUserId || row.userId === boundUserId);
      if (!op) break;
      try {
        await applyOp(op);
      } catch (error) {
        if (isDuplicate(error)) {
          writeOps(readOps().filter(row => row.id !== op.id));
          continue;
        }
        const message = error instanceof Error ? error.message : 'Falha ao sincronizar';
        writeOps(readOps().map(row => row.id === op.id
          ? { ...row, attempts: row.attempts + 1, lastError: message } : row));
        if (isOfflineError(error)) {
          localStorage.setItem(META_KEY, JSON.stringify({ online: false, lastError: message }));
        } else {
          localStorage.setItem(META_KEY, JSON.stringify({ online: true, lastError: message }));
        }
        // Preserve order and every pending operation, including permanent errors.
        // A later operation may depend on this insert.
        return;
      }
      writeOps(readOps().filter(row => row.id !== op.id));
    }
    if (!readOps().length) localStorage.setItem(META_KEY, JSON.stringify({ online: true, lastError: null }));
  } finally {
    flushing = false;
    emit();
  }
}

export async function syncWrite(input: Omit<WriteOp, 'id' | 'createdAt' | 'attempts' | 'userId'> & { userId?: string }): Promise<'sent' | 'queued'> {
  const op: WriteOp = {
    ...input,
    id: generateUUID(),
    userId: input.userId || boundUserId,
    createdAt: Date.now(),
    attempts: 0,
  };
  writeOps([...readOps(), op]);
  // The durable local write is the completion of a user action. Network work
  // continues independently and is retried by connectivity/realtime events.
  void flushOutbox().catch(error => {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar';
    localStorage.setItem(META_KEY, JSON.stringify({ online: false, lastError: message }));
    emit();
  });
  return 'queued';
}

export function watchConnectivity(onOnline: () => void) {
  let lastOnline = true;
  let lastRetryAt = 0;
  const timer = setInterval(() => {
    void isOnline().then(online => {
      if (online && (!lastOnline || (readOps().length > 0 && Date.now() - lastRetryAt >= 30_000))) {
        lastRetryAt = Date.now();
        onOnline();
      }
      lastOnline = online;
    });
  }, 4000);
  return () => clearInterval(timer);
}
