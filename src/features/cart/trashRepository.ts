import * as Crypto from 'expo-crypto';
import { patchLists } from '../../data';
import { syncWrite } from '../../core/sync/outbox';
import type { DeletedShoppingItem, ShoppingItem } from '../../core/models/caneto';

export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const TRASH_STORAGE_KEY_PREFIX = 'caneto_trash_v1_';

function getStorageKey(listId: string): string {
  return `${TRASH_STORAGE_KEY_PREFIX}${listId}`;
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Retorna apenas os itens excluídos há menos de 6 horas para a lista especificada. */
export function getValidTrash(listId: string): DeletedShoppingItem[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(getStorageKey(listId));
  const items = safeParse<DeletedShoppingItem[]>(raw, []);
  const now = Date.now();
  const valid = items.filter(item => now - item.deletedAt < SIX_HOURS_MS);

  // Se algum item expirou, limpa o armazenamento silenciosamente
  if (valid.length !== items.length) {
    saveTrash(listId, valid);
  }

  return valid;
}

function saveTrash(listId: string, items: DeletedShoppingItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(getStorageKey(listId));
    } else {
      localStorage.setItem(getStorageKey(listId), JSON.stringify(items));
    }
  } catch (error) {
    console.warn('[trashRepository] Falha ao persistir lixeira local:', error);
  }
}

/** Adiciona um item à lixeira local da lista */
export function addTrashItem(item: ShoppingItem): DeletedShoppingItem {
  const now = Date.now();
  const trashItem: DeletedShoppingItem = {
    ...item,
    deletedAt: now,
    originalListId: item.listId,
  };

  const current = getValidTrash(item.listId);
  const updated = [trashItem, ...current.filter(t => t.id !== item.id)];
  saveTrash(item.listId, updated);

  return trashItem;
}

/** Remove um item específico da lixeira */
export function removeTrashItem(listId: string, itemId: string, deletedAt?: number): void {
  const current = getValidTrash(listId);
  const updated = current.filter(t => !(t.id === itemId && (!deletedAt || t.deletedAt === deletedAt)));
  saveTrash(listId, updated);
}

/** Esvazia permanentemente todos os itens da lixeira de uma lista */
export function clearTrash(listId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getStorageKey(listId));
}

/** Formata o tempo restante de retenção (até 6h) */
export function formatRemainingTime(deletedAt: number): string {
  const elapsed = Date.now() - deletedAt;
  const remaining = Math.max(0, SIX_HOURS_MS - elapsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `Expira em ${hours}h ${minutes}m`;
  }
  return `Expira em ${minutes}m`;
}

/** Restaura o item excluído de volta no banco de dados Supabase */
export async function restoreItemToDatabase(userId: string, item: DeletedShoppingItem): Promise<void> {
  const now = Date.now();
  const listId = item.listId || item.originalListId;
  if (!listId) throw new Error('ID da lista ausente para restauração.');

  const row = {
    id: item.id || Crypto.randomUUID(),
    list_id: listId,
    user_id: userId,
    name: item.name.trim(),
    category_id: item.categoryId || 'other',
    quantity: item.quantity || 1,
    unit: item.unit || 'un',
    price: item.price ?? null,
    checked: false,
    notes: item.notes ?? null,
    photo_url: item.photoUrl ?? null,
    label_photo_url: item.labelPhotoUrl ?? null,
    ean: item.ean ?? null,
    brand: item.brand ?? null,
    created_at: item.createdAt || now,
    updated_at: now,
  };
  patchLists(lists => lists.map(list => list.id === listId ? {
    ...list, updated_at: now, items: [...list.items, {
      id: row.id, list_id: listId, name: row.name, category_id: row.category_id, quantity: row.quantity,
      unit: row.unit, price: row.price, checked: false, created_at: row.created_at, checked_at: null, updated_at: now,
      ean: row.ean, brand: row.brand,
    }],
  } : list));
  await syncWrite({ table: 'items', action: 'insert', entityId: row.id, match: { id: row.id }, payload: row, userId });
  await syncWrite({ table: 'lists', action: 'update', entityId: listId, match: { id: listId }, payload: { updated_at: now }, userId });
}

/** Exclui o item definitivamente da tabela items no Supabase */
export async function deleteItemFromDatabase(itemId: string, listId: string): Promise<void> {
  const now = Date.now();
  patchLists(lists => lists.map(list => list.id === listId ? { ...list, updated_at: now, items: list.items.filter(item => item.id !== itemId) } : list));
  await syncWrite({ table: 'items', action: 'delete', entityId: itemId, match: { id: itemId }, payload: null });
  await syncWrite({ table: 'lists', action: 'update', entityId: listId, match: { id: listId }, payload: { updated_at: now } });
}
