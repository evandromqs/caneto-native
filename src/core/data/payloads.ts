import { generateUUID } from '../../ui/error';

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
