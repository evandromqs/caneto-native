import { supabase } from './supabase';
import { canetoData } from './core/data/supabaseAdapter';
import type { ShoppingList } from './core/models/caneto';
import { generateUUID, getErrorMessage } from './ui/error';

export function createListPayload(options: {
  id?: string;
  name: string;
  userId: string;
  icon?: string;
  color?: string;
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  isCompleted?: boolean;
}) {
  const now = Date.now();
  const id = options.id || generateUUID();
  return {
    id,
    user_id: options.userId,
    name: options.name.trim(),
    icon: options.icon ?? 'ShoppingCart',
    color: options.color ?? 'emerald',
    is_default: false,
    budget: null,
    share_code: null,
    permission: 'viewer',
    access_mode: 'private',
    store_id: options.storeId ?? null,
    store_name: options.storeName ?? null,
    store_address: options.storeAddress ?? null,
    is_completed: !!options.isCompleted,
    completed_at: options.isCompleted ? now : null,
    payment_method: null,
    receipt_photo_url: null,
    receipt_qr_code: null,
    receipt_key: null,
    total_spent: null,
    detected_items_total: null,
    pending_receipt: false,
    created_at: now,
    updated_at: now,
  };
}

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

export async function loadLists(userId: string): Promise<List[]> {
  const lists = await canetoData.lists(userId);
  return lists.map(list => ({
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
    })),
  }));
}

export async function createList(userId: string, name: string): Promise<string> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Informe o nome da lista.');
  const payload = createListPayload({ name: cleanName, userId });
  const { error } = await supabase.from('lists').insert(payload);
  if (error) {
    console.error('Erro ao criar lista no Supabase:', error);
    throw new Error(getErrorMessage(error));
  }
  return payload.id;
}

export async function addItem(userId: string, listId: string, name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Informe o nome do produto.');
  const now = Date.now();
  const { error } = await supabase.from('items').insert({
    id: generateUUID(), list_id: listId, user_id: userId, name: cleanName,
    category_id: 'other', quantity: 1, unit: 'un', checked: false,
    created_at: now, updated_at: now,
  });
  if (error) throw new Error(getErrorMessage(error));
  await supabase.from('lists').update({ updated_at: now }).eq('id', listId);
}

export async function setItemChecked(item: Item, checked: boolean): Promise<void> {
  const now = Date.now();
  const { error } = await supabase.from('items').update({
    checked, checked_at: checked ? now : null, updated_at: now,
  }).eq('id', item.id);
  if (error) throw new Error(getErrorMessage(error));
  await supabase.from('lists').update({ updated_at: now }).eq('id', item.list_id);
}
