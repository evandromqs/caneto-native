import { canetoData } from './core/data/supabaseAdapter';
import type { ShoppingItem, ShoppingList } from './core/models/caneto';
import { readListCache, writeListCache } from './core/sync/listCache';
import { bindSyncUser, currentSyncUserId, flushOutbox, pendingOps, syncWrite } from './core/sync/outbox';
import { generateUUID } from './ui/error';
import { parseQuickItemInput } from './core/categories';
import { createListPayload } from './core/data/payloads';

export { createListPayload };

export type Item = {
  id: string;
  list_id: string;
  name: string;
  category_id: string;
  quantity: number;
  unit: string;
  price: number | null;
  checked: boolean;
  created_at: number;
  checked_at: number | null;
  updated_at: number;
  ean?: string | null;
  brand?: string | null;
  photo_url?: string | null;
  label_photo_url?: string | null;
  notes?: string | null;
};

export type List = {
  id: string;
  name: string;
  color: string;
  user_id: string;
  is_completed: boolean;
  store_id?: string | null;
  store_name?: string | null;
  share_code?: string | null;
  permission?: 'editor' | 'viewer';
  created_at: number;
  updated_at: number;
  items: Item[];
  domain?: ShoppingList;
};

function toShoppingItem(item: Item): ShoppingItem {
  return {
    id: item.id, listId: item.list_id, name: item.name, categoryId: item.category_id,
    quantity: item.quantity, unit: item.unit as ShoppingItem['unit'], price: item.price ?? undefined,
    checked: item.checked, createdAt: item.created_at, updatedAt: item.updated_at,
    checkedAt: item.checked_at ?? undefined, ean: item.ean ?? undefined, brand: item.brand ?? undefined,
    photoUrl: item.photo_url ?? undefined,
    labelPhotoUrl: item.label_photo_url ?? undefined,
    notes: item.notes ?? undefined,
  };
}

export function syncDomain(list: List): List {
  const previous = list.domain;
  const domain: ShoppingList = {
    id: list.id, ownerId: list.user_id,
    permission: previous?.permission ?? (list.permission === 'viewer' ? 'viewer' : list.permission === 'editor' ? 'editor' : 'owner'),
    name: list.name, icon: previous?.icon ?? 'ShoppingCart', color: list.color,
    isDefault: previous?.isDefault ?? false, shareCode: list.share_code ?? previous?.shareCode,
    accessMode: previous?.accessMode ?? 'private', budget: previous?.budget,
    storeId: list.store_id ?? undefined, storeName: list.store_name ?? undefined, storeAddress: previous?.storeAddress,
    isCompleted: list.is_completed, completedAt: previous?.completedAt, paymentMethod: previous?.paymentMethod,
    receiptPhotoUrl: previous?.receiptPhotoUrl, receiptQrCode: previous?.receiptQrCode, receiptKey: previous?.receiptKey,
    totalSpent: previous?.totalSpent, detectedItemsTotal: previous?.detectedItemsTotal,
    pendingReceipt: previous?.pendingReceipt ?? false, createdAt: list.created_at, updatedAt: list.updated_at,
    items: list.items.map(toShoppingItem),
  };
  return { ...list, domain };
}

export function patchLists(mutator: (lists: List[]) => List[]) {
  const userId = currentSyncUserId();
  if (!userId) return;
  const current = readListCache<List>(userId) ?? [];
  writeListCache(userId, mutator(current).map(syncDomain));
}

function mergeLists(remote: List[], local: List[]): List[] {
  const pending = pendingOps().filter(op => op.userId === currentSyncUserId());
  const deletedLists = new Set(pending.filter(op => op.table === 'lists' && op.action === 'delete').map(op => op.entityId));
  const deletedItems = new Set(pending.filter(op => op.table === 'items' && op.action === 'delete').map(op => op.entityId));
  const byId = new Map<string, List>();
  for (const list of remote) if (!deletedLists.has(list.id)) byId.set(list.id, list);
  for (const list of local) {
    if (deletedLists.has(list.id)) { byId.delete(list.id); continue; }
    const current = byId.get(list.id);
    if (!current) { byId.set(list.id, syncDomain(list)); continue; }
    const items = new Map(current.items.filter(item => !deletedItems.has(item.id)).map(item => [item.id, item]));
    for (const item of list.items) {
      if (deletedItems.has(item.id)) { items.delete(item.id); continue; }
      const other = items.get(item.id);
      if (!other || item.updated_at >= other.updated_at) items.set(item.id, item);
    }
    const newer = list.updated_at >= current.updated_at ? list : current;
    byId.set(list.id, syncDomain({ ...newer, items: [...items.values()] }));
  }
  return [...byId.values()].sort((a, b) => b.updated_at - a.updated_at);
}

function fromDomain(list: ShoppingList): List {
  return syncDomain({
    id: list.id, name: list.name, color: list.color, user_id: list.ownerId,
    is_completed: list.isCompleted, store_id: list.storeId ?? null,
    store_name: list.storeName ?? null, share_code: list.shareCode ?? null,
    permission: list.permission === 'owner' ? 'editor' : list.permission,
    created_at: list.createdAt, updated_at: list.updatedAt, domain: list,
    items: list.items.map(item => ({
      id: item.id, list_id: item.listId, name: item.name, category_id: item.categoryId,
      quantity: item.quantity, unit: item.unit, price: item.price ?? null,
      checked: item.checked, created_at: item.createdAt,
      checked_at: item.checkedAt ?? null, updated_at: item.updatedAt,
      ean: item.ean ?? null, brand: item.brand ?? null, photo_url: item.photoUrl ?? null,
    })),
  });
}

const remoteLoads = new Map<string, Promise<List[]>>();

function refreshRemoteLists(userId: string): Promise<List[]> {
  const active = remoteLoads.get(userId);
  if (active) return active;
  const task = canetoData.lists(userId).then(domainLists => {
    const remote = domainLists.map(fromDomain);
    const local = readListCache<List>(userId) ?? [];
    const merged = pendingOps().some(op => op.userId === userId) ? mergeLists(remote, local) : remote;
    writeListCache(userId, merged);
    return merged;
  }).finally(() => { remoteLoads.delete(userId); });
  remoteLoads.set(userId, task);
  return task;
}

export async function loadLists(userId: string): Promise<List[]> {
  bindSyncUser(userId);
  void flushOutbox().catch(() => undefined);
  const local = readListCache<List>(userId);
  if (local !== null) {
    void refreshRemoteLists(userId).catch(() => undefined);
    return local;
  }
  return refreshRemoteLists(userId);
}

export async function createList(userId: string, name: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Informe o nome da lista.');
  const payload = createListPayload({ name: cleanName, userId });
  const now = payload.created_at;
  patchLists(lists => [{
    id: payload.id, name: cleanName, color: 'emerald', user_id: userId, is_completed: false,
    created_at: now, updated_at: now, items: [],
  }, ...lists.filter(list => list.id !== payload.id)]);
  await syncWrite({ table: 'lists', action: 'insert', entityId: payload.id, match: { id: payload.id }, payload, userId });
  return payload.id;
}

export async function addItem(userId: string, listId: string, rawInput: string): Promise<void> {
  const cleanInput = rawInput.trim();
  if (!cleanInput) throw new Error('Informe o nome do produto.');
  const parsed = parseQuickItemInput(cleanInput);
  await insertItem(userId, listId, {
    name: parsed.name, categoryId: parsed.categoryId, quantity: parsed.quantity, unit: parsed.unit, price: parsed.price ?? null,
  });
}

export async function addScannedItem(userId: string, listId: string, input: { name: string; categoryId: string; quantity: number; unit: string; price: number | null; ean?: string; brand?: string; photoUrl?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome do produto.');
  await insertItem(userId, listId, { ...input, name });
}

async function insertItem(userId: string, listId: string, input: { name: string; categoryId: string; quantity: number; unit: string; price: number | null; ean?: string; brand?: string; photoUrl?: string }) {
  const now = Date.now();
  const row = {
    id: generateUUID(), list_id: listId, user_id: userId, name: input.name, category_id: input.categoryId,
    quantity: input.quantity, unit: input.unit, price: input.price, checked: false, created_at: now, updated_at: now,
    ean: input.ean ?? null, brand: input.brand ?? null, photo_url: input.photoUrl ?? null,
  };
  patchLists(lists => lists.map(list => list.id === listId ? {
    ...list, updated_at: now, items: [...list.items, { ...row, checked_at: null }],
  } : list));
  await syncWrite({ table: 'items', action: 'insert', entityId: row.id, match: { id: row.id }, payload: row, userId });
  await syncWrite({ table: 'lists', action: 'update', entityId: listId, match: { id: listId }, payload: { updated_at: now }, userId });
}

export async function setItemChecked(item: Item, checked: boolean): Promise<void> {
  const now = Date.now();
  patchLists(lists => lists.map(list => list.id === item.list_id ? {
    ...list, updated_at: now, items: list.items.map(row => row.id === item.id ? { ...row, checked, checked_at: checked ? now : null, updated_at: now } : row),
  } : list));
  await syncWrite({ table: 'items', action: 'update', entityId: item.id, match: { id: item.id }, payload: { checked, checked_at: checked ? now : null, updated_at: now } });
  await syncWrite({ table: 'lists', action: 'update', entityId: item.list_id, match: { id: item.list_id }, payload: { updated_at: now } });
}
