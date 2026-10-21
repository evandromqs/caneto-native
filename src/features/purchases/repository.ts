import * as Crypto from 'expo-crypto';
import { supabase } from '../../supabase';
import type { List } from '../../data';

export type PaymentMethod = 'pix' | 'debito' | 'credito' | 'dinheiro';
export type Purchase = { id: string; list_id: string | null; list_name: string; completed_at: number; total_items: number; total_spent: number; payment_method: PaymentMethod | null; store_name: string | null; items: { name: string; quantity: number; unit: string; price: number | null }[] };

export async function finishPurchase(list: List, userId: string, paymentMethod: PaymentMethod): Promise<void> {
  const items = list.items.some(item => item.checked) ? list.items.filter(item => item.checked) : list.items;
  if (!items.length) throw new Error('Adicione ao menos um produto antes de finalizar.');
  const now = Date.now();
  const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const { error: historyError } = await supabase.from('purchase_history').upsert({ id: `history-${list.id}`, list_id: list.id, list_name: list.name, completed_at: now, total_items: items.length, total_spent: total, detected_items_total: total, pending_receipt: true, items: items.map(item => ({ id: item.id, name: item.name, categoryId: item.category_id, quantity: item.quantity, unit: item.unit, price: item.price, checked: item.checked, createdAt: item.created_at })), user_id: userId, payment_method: paymentMethod, store_name: list.store_name }, { onConflict: 'id' });
  if (historyError) throw historyError;
  const { error } = await supabase.from('lists').update({ is_completed: true, completed_at: now, total_spent: total, payment_method: paymentMethod, updated_at: now }).eq('id', list.id);
  if (error) throw error;
}

export async function loadHistory(userId: string): Promise<Purchase[]> {
  const { data, error } = await supabase.from('purchase_history').select('id,list_id,list_name,completed_at,total_items,total_spent,payment_method,store_name,items').eq('user_id', userId).order('completed_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Purchase[];
}

export async function recreatePurchase(record: Purchase, userId: string): Promise<void> {
  const id = Crypto.randomUUID();
  const now = Date.now();
  const { error } = await supabase.from('lists').insert({ id, name: record.list_name, store_name: record.store_name, icon: 'ShoppingCart', color: 'emerald', user_id: userId, created_at: now, updated_at: now });
  if (error) throw error;
  if (record.items.length) {
    const { error: itemsError } = await supabase.from('items').insert(record.items.map(item => ({ id: Crypto.randomUUID(), list_id: id, user_id: userId, name: item.name, category_id: 'other', quantity: item.quantity, unit: item.unit, price: item.price, checked: false, created_at: now, updated_at: now })));
    if (itemsError) { await supabase.from('lists').delete().eq('id', id); throw itemsError; }
  }
}
