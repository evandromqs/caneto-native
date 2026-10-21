import * as Crypto from 'expo-crypto';
import { supabase } from '../../supabase';
import type { Item, List } from '../../data';

export async function renameList(listId: string, name: string, storeName?: string) {
  const { error } = await supabase.from('lists').update({ name: name.trim(), store_name: storeName?.trim() || null, updated_at: Date.now() }).eq('id', listId);
  if (error) throw error;
}

export async function removeList(listId: string) {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw error;
}

export async function duplicateList(list: List, userId: string) {
  const id = Crypto.randomUUID();
  const now = Date.now();
  const { error } = await supabase.from('lists').insert({ id, name: `${list.name} (cópia)`, icon: 'ShoppingCart', color: list.color, user_id: userId, created_at: now, updated_at: now });
  if (error) throw error;
  if (list.items.length) {
    const { error: itemsError } = await supabase.from('items').insert(list.items.map(item => ({ id: Crypto.randomUUID(), list_id: id, user_id: userId, name: item.name, category_id: item.category_id, quantity: item.quantity, unit: item.unit, price: item.price, checked: false, created_at: now, updated_at: now })));
    if (itemsError) throw itemsError;
  }
  return id;
}

export async function saveItemChanges(item: Item, changes: { name: string; quantity: number; unit: string; price: number | null }) {
  const now = Date.now();
  const { error } = await supabase.from('items').update({ ...changes, updated_at: now }).eq('id', item.id);
  if (error) throw error;
  const { error: listError } = await supabase.from('lists').update({ updated_at: now }).eq('id', item.list_id);
  if (listError) throw listError;
}

export async function removeItem(item: Item) {
  const { error } = await supabase.from('items').delete().eq('id', item.id);
  if (error) throw error;
  const { error: listError } = await supabase.from('lists').update({ updated_at: Date.now() }).eq('id', item.list_id);
  if (listError) throw listError;
}

export async function setListCompleted(list: List, completed: boolean) {
  const now = Date.now();
  const total = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const { error } = await supabase.from('lists').update({ is_completed: completed, completed_at: completed ? now : null, total_spent: completed ? total : null, updated_at: now }).eq('id', list.id);
  if (error) throw error;
}
