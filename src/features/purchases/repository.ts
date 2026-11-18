import { supabase } from '../../supabase';
import type { List } from '../../data';
import { createListPayload, patchLists } from '../../data';
import { generateUUID, getErrorMessage } from '../../ui/error';
import { syncWrite } from '../../core/sync/outbox';

export type PaymentMethod = 'pix' | 'debito' | 'credito' | 'dinheiro';
export type Purchase = {
  id: string; list_id: string | null; list_name: string; completed_at: number; total_items: number;
  total_spent: number; detected_items_total?: number | null; payment_method: PaymentMethod | null;
  pending_receipt?: boolean; store_name: string | null; store_address?: string | null; store_cnpj?: string | null;
  receipt_photo_url?: string | null; receipt_qr_code?: string | null;
  items: { id?: string; name: string; categoryId?: string; quantity: number; unit: string; price: number | null }[];
};

export type PurchaseReceipt = {
  photoUrl?: string;
  qrCode?: string;
  total?: number;
  pendingReceipt?: boolean;
  storeName?: string;
  storeAddress?: string;
  storeCnpj?: string;
};

export async function finishPurchase(list: List, userId: string, paymentMethod: PaymentMethod, receipt: PurchaseReceipt = {}): Promise<void> {
  const items = list.items.some(item => item.checked) ? list.items.filter(item => item.checked) : list.items;
  if (!items.length) throw new Error('Adicione ao menos um produto antes de finalizar.');
  const now = Date.now();
  const calculated = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const total = receipt.total != null && receipt.total >= 0 ? receipt.total : calculated;
  const pending = receipt.pendingReceipt ?? !(receipt.photoUrl || receipt.qrCode);
  const history = {
    id: `history-${list.id}`, list_id: list.id, list_name: list.name, completed_at: now, total_items: items.length,
    total_spent: total, detected_items_total: calculated, pending_receipt: pending,
    items: items.map(item => ({ id: item.id, name: item.name, categoryId: item.category_id, quantity: item.quantity, unit: item.unit, price: item.price, checked: item.checked, createdAt: item.created_at })),
    user_id: userId, payment_method: paymentMethod, store_name: receipt.storeName || list.store_name,
    store_address: receipt.storeAddress ?? null, store_cnpj: receipt.storeCnpj ?? null,
    receipt_photo_url: receipt.photoUrl ?? null, receipt_qr_code: receipt.qrCode ?? null,
  };
  patchLists(lists => lists.map(row => row.id === list.id ? {
    ...row, is_completed: true, updated_at: now, store_name: receipt.storeName || row.store_name,
    domain: row.domain ? {
      ...row.domain, isCompleted: true, completedAt: now, paymentMethod, totalSpent: total, detectedItemsTotal: calculated,
      pendingReceipt: pending, receiptPhotoUrl: receipt.photoUrl, receiptQrCode: receipt.qrCode,
      storeName: receipt.storeName || row.domain.storeName,
      storeAddress: receipt.storeAddress || row.domain.storeAddress, updatedAt: now,
    } : row.domain,
  } : row));
  await syncWrite({ table: 'purchase_history', action: 'upsert', entityId: history.id, match: { id: history.id }, payload: history, onConflict: 'id', userId });
  await syncWrite({
    table: 'lists', action: 'update', entityId: list.id, match: { id: list.id }, userId,
    payload: {
      is_completed: true, completed_at: now, total_spent: total, detected_items_total: calculated, payment_method: paymentMethod,
      pending_receipt: pending, receipt_photo_url: receipt.photoUrl ?? null, receipt_qr_code: receipt.qrCode ?? null,
      store_name: receipt.storeName || list.store_name || null, store_address: receipt.storeAddress ?? list.domain?.storeAddress ?? null,
      ...(receipt.storeCnpj ? { store_cnpj: receipt.storeCnpj } : {}), updated_at: now,
    },
  });
}

export async function attachReceipt(list: List, userId: string, receipt: PurchaseReceipt): Promise<void> {
  if (!receipt.photoUrl && !receipt.qrCode) throw new Error('Anexe uma foto ou leia o QR da nota fiscal.');
  const items = list.items.some(item => item.checked) ? list.items.filter(item => item.checked) : list.items;
  const now = Date.now();
  const calculated = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const total = receipt.total != null && receipt.total >= 0
    ? receipt.total
    : list.domain?.totalSpent ?? calculated;
  const storeName = receipt.storeName || list.store_name || undefined;
  const storeAddress = receipt.storeAddress ?? list.domain?.storeAddress ?? null;
  const historyId = `history-${list.id}`;
  const history = {
    id: historyId, list_id: list.id, list_name: list.name, completed_at: list.domain?.completedAt ?? now,
    total_items: items.length, total_spent: total, detected_items_total: list.domain?.detectedItemsTotal ?? calculated,
    pending_receipt: false, user_id: userId,
    payment_method: list.domain?.paymentMethod ?? null,
    store_name: storeName, store_address: storeAddress, store_cnpj: receipt.storeCnpj ?? null,
    receipt_photo_url: receipt.photoUrl ?? null, receipt_qr_code: receipt.qrCode ?? null,
    items: items.map(item => ({
      id: item.id, name: item.name, categoryId: item.category_id, quantity: item.quantity, unit: item.unit,
      price: item.price, checked: item.checked, createdAt: item.created_at,
    })),
  };

  patchLists(lists => lists.map(row => row.id === list.id ? {
    ...row, updated_at: now, store_name: storeName,
    domain: row.domain ? {
      ...row.domain, pendingReceipt: false, receiptPhotoUrl: receipt.photoUrl,
      receiptQrCode: receipt.qrCode, storeName, storeAddress: storeAddress ?? undefined, updatedAt: now,
    } : row.domain,
  } : row));
  await syncWrite({
    table: 'lists', action: 'update', entityId: list.id, match: { id: list.id }, userId,
    payload: {
      pending_receipt: false, receipt_photo_url: receipt.photoUrl ?? null, receipt_qr_code: receipt.qrCode ?? null,
      store_name: storeName ?? null, store_address: storeAddress, ...(receipt.storeCnpj ? { store_cnpj: receipt.storeCnpj } : {}), updated_at: now,
    },
  });
  await syncWrite({ table: 'purchase_history', action: 'upsert', entityId: historyId, match: { id: historyId }, payload: history, onConflict: 'id', userId });
}

export async function loadHistory(userId: string): Promise<Purchase[]> {
  const { data, error } = await supabase.from('purchase_history').select('id,list_id,list_name,completed_at,total_items,total_spent,detected_items_total,payment_method,pending_receipt,store_name,store_address,store_cnpj,receipt_photo_url,receipt_qr_code,items').eq('user_id', userId).order('completed_at', { ascending: false }).limit(100);
  if (error) throw new Error(getErrorMessage(error));
  return (data ?? []).map((row: Record<string, unknown>) => {
    let parsedItems: Purchase['items'] = [];
    if (Array.isArray(row.items)) {
      parsedItems = row.items as Purchase['items'];
    } else if (typeof row.items === 'string') {
      try {
        const parsed = JSON.parse(row.items);
        if (Array.isArray(parsed)) parsedItems = parsed;
      } catch {}
    }
    return {
      ...row,
      id: String(row.id ?? ''),
      list_id: String(row.list_id ?? ''),
      list_name: String(row.list_name ?? 'Compra'),
      completed_at: String(row.completed_at ?? ''),
      total_items: Number(row.total_items ?? parsedItems.length ?? 0),
      total_spent: Number(row.total_spent ?? 0),
      payment_method: row.payment_method ? String(row.payment_method) : undefined,
      listId: String(row.list_id ?? ''),
      listName: String(row.list_name ?? 'Compra'),
      completedAt: String(row.completed_at ?? ''),
      totalItems: Number(row.total_items ?? parsedItems.length ?? 0),
      totalSpent: Number(row.total_spent ?? 0),
      detectedItemsTotal: row.detected_items_total != null ? Number(row.detected_items_total) : undefined,
      paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
      pendingReceipt: Boolean(row.pending_receipt),
      storeName: row.store_name ? String(row.store_name) : undefined,
      storeAddress: row.store_address ? String(row.store_address) : undefined,
      storeCnpj: row.store_cnpj ? String(row.store_cnpj) : undefined,
      receiptPhotoUrl: row.receipt_photo_url ? String(row.receipt_photo_url) : undefined,
      receiptQrCode: row.receipt_qr_code ? String(row.receipt_qr_code) : undefined,
      items: parsedItems,
    } as unknown as Purchase;
  });
}

export async function recreatePurchase(
  record: Purchase | { list_name?: string; listName?: string; store_name?: string; storeName?: string; items: { name: string; quantity: number; unit: string; price?: number | null; categoryId?: string }[] },
  userId: string
): Promise<void> {
  const name = ('listName' in record && record.listName) ? record.listName : ('list_name' in record && record.list_name) ? record.list_name : 'Lista recriada';
  const store = ('storeName' in record && record.storeName) ? record.storeName : ('store_name' in record && record.store_name) ? record.store_name : undefined;
  const payload = createListPayload({
    name,
    userId,
    storeName: store,
  });
  const now = Date.now();
  const items = record.items.map(item => ({
    id: generateUUID(), list_id: payload.id, user_id: userId, name: item.name,
    category_id: item.categoryId || 'other',
    quantity: item.quantity, unit: item.unit, price: item.price ?? null, checked: false, created_at: now, updated_at: now,
  }));
  patchLists(lists => [{
    id: payload.id, name: payload.name, color: 'emerald', user_id: userId, is_completed: false,
    store_name: store, created_at: now, updated_at: now,
    items: items.map(item => ({ ...item, checked_at: null })),
  }, ...lists]);
  await syncWrite({ table: 'lists', action: 'insert', entityId: payload.id, match: { id: payload.id }, payload, userId });
  for (const item of items) {
    await syncWrite({ table: 'items', action: 'insert', entityId: item.id, match: { id: item.id }, payload: item, userId });
  }
}
