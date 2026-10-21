import { supabase } from '../../supabase';
import type { Item, List } from '../../data';
import { createListPayload } from '../../data';
import { generateUUID, getErrorMessage } from '../../ui/error';

export async function renameList(listId: string, name: string, storeName?: string) {
  const { error } = await supabase.from('lists').update({ name: name.trim(), store_name: storeName?.trim() || null, updated_at: Date.now() }).eq('id', listId);
  if (error) throw new Error(getErrorMessage(error));
}

export async function removeList(listId: string) {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw new Error(getErrorMessage(error));
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
  const { error } = await supabase.from('lists').insert(payload);
  if (error) throw new Error(getErrorMessage(error));
  if (list.items.length) {
    const { error: itemsError } = await supabase.from('items').insert(list.items.map(item => ({
      id: generateUUID(),
      list_id: payload.id,
      user_id: userId,
      name: item.name,
      category_id: item.category_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      checked: false,
      created_at: now,
      updated_at: now,
    })));
    if (itemsError) throw new Error(getErrorMessage(itemsError));
  }
  return payload.id;
}

export async function saveItemChanges(item: Item, changes: { name: string; quantity: number; unit: string; price: number | null }) {
  const now = Date.now();
  const { error } = await supabase.from('items').update({ ...changes, updated_at: now }).eq('id', item.id);
  if (error) throw new Error(getErrorMessage(error));
  const { error: listError } = await supabase.from('lists').update({ updated_at: now }).eq('id', item.list_id);
  if (listError) throw new Error(getErrorMessage(listError));
}

export async function removeItem(item: Item) {
  const { error } = await supabase.from('items').delete().eq('id', item.id);
  if (error) throw new Error(getErrorMessage(error));
  const { error: listError } = await supabase.from('lists').update({ updated_at: Date.now() }).eq('id', item.list_id);
  if (listError) throw new Error(getErrorMessage(listError));
}

export async function setListCompleted(list: List, completed: boolean) {
  const now = Date.now();
  const total = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const { error } = await supabase.from('lists').update({ is_completed: completed, completed_at: completed ? now : null, total_spent: completed ? total : null, updated_at: now }).eq('id', list.id);
  if (error) throw new Error(getErrorMessage(error));
}
