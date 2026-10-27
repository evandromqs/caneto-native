import type { Item, List } from '../../data';
import { createListPayload, patchLists } from '../../data';
import { generateUUID } from '../../ui/error';
import { suggestCategory } from '../../core/categories';
import { syncWrite } from '../../core/sync/outbox';

export async function renameList(listId: string, name: string, storeName?: string) {
  const now = Date.now();
  const nextName = name.trim();
  const nextStore = storeName?.trim() || null;
  patchLists(lists => lists.map(list => list.id === listId ? { ...list, name: nextName, store_name: nextStore, updated_at: now } : list));
  await syncWrite({ table: 'lists', action: 'update', entityId: listId, match: { id: listId }, payload: { name: nextName, store_name: nextStore, updated_at: now } });
}

export async function removeList(listId: string) {
  patchLists(lists => lists.filter(list => list.id !== listId));
  await syncWrite({ table: 'lists', action: 'delete', entityId: listId, match: { id: listId }, payload: null });
}

export async function duplicateList(list: List, userId: string) {
  const payload = createListPayload({
    name: `${list.name} (cópia)`,
    userId,
    color: list.color,
    storeId: list.store_id,
    storeName: list.store_name,
  });
  const now = Date.now();
  const items = list.items.map(item => ({
    id: generateUUID(), list_id: payload.id, user_id: userId, name: item.name, category_id: item.category_id,
    quantity: item.quantity, unit: item.unit, price: item.price, checked: false, created_at: now, updated_at: now,
  }));
  patchLists(lists => [{
    id: payload.id, name: payload.name, color: list.color, user_id: userId, is_completed: false,
    store_id: list.store_id, store_name: list.store_name, created_at: now, updated_at: now,
    items: items.map(item => ({ ...item, checked_at: null })),
  }, ...lists]);
  await syncWrite({ table: 'lists', action: 'insert', entityId: payload.id, match: { id: payload.id }, payload, userId });
  for (const item of items) {
    await syncWrite({ table: 'items', action: 'insert', entityId: item.id, match: { id: item.id }, payload: item, userId });
  }
  return payload.id;
}

export async function saveItemChanges(item: Item, changes: { name: string; quantity: number; unit: string; price: number | null; category_id?: string }) {
  const now = Date.now();
  const category_id = changes.category_id ?? suggestCategory(changes.name);
  const next = { ...changes, category_id, updated_at: now };
  patchLists(lists => lists.map(list => list.id === item.list_id ? {
    ...list, updated_at: now, items: list.items.map(row => row.id === item.id ? { ...row, ...next } : row),
  } : list));
  await syncWrite({ table: 'items', action: 'update', entityId: item.id, match: { id: item.id }, payload: next });
  await syncWrite({ table: 'lists', action: 'update', entityId: item.list_id, match: { id: item.list_id }, payload: { updated_at: now } });
}

export async function removeItem(item: Item) {
  const now = Date.now();
  patchLists(lists => lists.map(list => list.id === item.list_id ? { ...list, updated_at: now, items: list.items.filter(row => row.id !== item.id) } : list));
  await syncWrite({ table: 'items', action: 'delete', entityId: item.id, match: { id: item.id }, payload: null });
  await syncWrite({ table: 'lists', action: 'update', entityId: item.list_id, match: { id: item.list_id }, payload: { updated_at: now } });
}

export async function setListCompleted(list: List, completed: boolean) {
  const now = Date.now();
  const total = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  patchLists(lists => lists.map(row => row.id === list.id ? {
    ...row, is_completed: completed, updated_at: now,
    domain: row.domain ? { ...row.domain, isCompleted: completed, completedAt: completed ? now : undefined, totalSpent: completed ? total : undefined, updatedAt: now } : row.domain,
  } : row));
  await syncWrite({ table: 'lists', action: 'update', entityId: list.id, match: { id: list.id }, payload: { is_completed: completed, completed_at: completed ? now : null, total_spent: completed ? total : null, updated_at: now } });
}
