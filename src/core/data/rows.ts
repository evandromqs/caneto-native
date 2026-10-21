import type { AccessMode, AppPreferences, ListPermission, PaymentMethod, PriceType, Profile, Purchase, ShoppingItem, ShoppingList, StorePrice, StoreSubmission, Unit } from '../models/caneto';

export interface ItemRow {
  id: string; list_id: string; user_id: string | null; name: string; category_id: string;
  quantity: number; unit: string; price: number | null; checked: boolean; notes: string | null;
  photo_url: string | null; label_photo_url: string | null; ean: string | null; brand: string | null;
  created_at: number; updated_at: number; checked_at: number | null;
}
export interface ListRow {
  id: string; user_id: string; name: string; icon: string | null; color: string | null;
  is_default: boolean | null; share_code: string | null; permission: string | null;
  access_mode: string | null; budget: number | null; store_id: string | null;
  store_name: string | null; store_address: string | null; is_completed: boolean | null;
  completed_at: number | null; payment_method: string | null; receipt_photo_url: string | null;
  receipt_qr_code: string | null; receipt_key: string | null; total_spent: number | null;
  detected_items_total: number | null; pending_receipt: boolean | null;
  created_at: number; updated_at: number;
}
export interface PurchaseRow {
  id: string; user_id: string; list_id: string | null; list_name: string;
  completed_at: number; total_items: number; total_spent: number; items: unknown;
  detected_items_total: number | null; pending_receipt: boolean | null;
  payment_method: string | null; store_id: string | null; store_name: string | null;
  store_address: string | null; store_cnpj: string | null; receipt_photo_url: string | null;
  receipt_qr_code: string | null; receipt_key: string | null;
}
export interface ProfileRow {
  id: string; email: string | null; username: string | null; display_name: string | null;
  avatar_url: string | null; visibility: string | null; is_photo_public: boolean | null;
  preferences: unknown; updated_at: number; plan_tier?: string | null;
  ai_scans_used_this_month?: number | null; ai_scans_limit?: number | null;
  ai_scans_reset_at?: string | null; subscription_expires_at?: string | null;
}
export interface StorePriceRow {
  id?: string; store_id: string; store_name: string; store_cnpj: string | null;
  ean: string | null; product_name: string; canonical_name: string; category_id: string;
  price: number; unit: string; price_type: string; observed_at: number; updated_at?: number;
}
export interface StoreSubmissionRow {
  id: string; user_id: string; name: string; category: string; latitude: number;
  longitude: number; photo_path: string; status: string; created_at: string;
  reviewed_at: string | null; review_reason: string | null;
}
export interface ListMembershipRow { list_id: string; user_id: string; permission: 'viewer' | 'editor' }

const present = <T,>(value: T | null | undefined): T | undefined => value ?? undefined;
const finite = (value: unknown, fallback = 0): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const payment = (value: unknown): PaymentMethod | undefined =>
  value === 'debito' || value === 'credito' || value === 'dinheiro' || value === 'pix' ? value : undefined;
const accessMode = (value: unknown): AccessMode =>
  value === 'public' || value === 'friends_only' ? value : 'private';

export function itemFromRow(row: ItemRow): ShoppingItem {
  return {
    id: row.id, listId: row.list_id, authorId: present(row.user_id), name: row.name,
    categoryId: row.category_id, quantity: finite(row.quantity, 1), unit: row.unit as Unit,
    price: present(row.price) === undefined ? undefined : finite(row.price),
    checked: row.checked === true, notes: present(row.notes), photoUrl: present(row.photo_url),
    labelPhotoUrl: present(row.label_photo_url), ean: present(row.ean), brand: present(row.brand),
    createdAt: finite(row.created_at), updatedAt: finite(row.updated_at, finite(row.created_at)),
    checkedAt: present(row.checked_at),
  };
}

export function listFromRow(row: ListRow, items: ShoppingItem[], actorId: string, membership?: ListMembershipRow): ShoppingList {
  const permission: ListPermission = row.user_id === actorId ? 'owner' : membership?.permission ?? 'viewer';
  return {
    id: row.id, ownerId: row.user_id, permission, name: row.name,
    icon: row.icon ?? 'ShoppingCart', color: row.color ?? 'emerald',
    isDefault: row.is_default === true, shareCode: present(row.share_code),
    accessMode: accessMode(row.access_mode), budget: present(row.budget),
    storeId: present(row.store_id), storeName: present(row.store_name),
    storeAddress: present(row.store_address), isCompleted: row.is_completed === true,
    completedAt: present(row.completed_at), paymentMethod: payment(row.payment_method),
    receiptPhotoUrl: present(row.receipt_photo_url), receiptQrCode: present(row.receipt_qr_code),
    receiptKey: present(row.receipt_key), totalSpent: present(row.total_spent),
    detectedItemsTotal: present(row.detected_items_total), pendingReceipt: row.pending_receipt === true,
    createdAt: finite(row.created_at), updatedAt: finite(row.updated_at),
    items: items.filter(item => item.listId === row.id),
  };
}

// Purchase JSONB contains a snapshot in the web domain format, not public.items rows.
function snapshotItem(raw: Record<string, unknown>, listId: string): ShoppingItem {
  return {
    id: String(raw.id ?? ''), listId, authorId: present(raw.userId as string | null),
    name: String(raw.name ?? ''), categoryId: String(raw.categoryId ?? 'other'),
    quantity: finite(raw.quantity, 1), unit: String(raw.unit ?? 'un') as Unit,
    price: raw.price == null ? undefined : finite(raw.price), checked: raw.checked === true,
    notes: present(raw.notes as string | null), photoUrl: present(raw.photoUrl as string | null),
    labelPhotoUrl: present(raw.labelPhotoUrl as string | null),
    ean: present(raw.ean as string | null), brand: present(raw.brand as string | null),
    createdAt: finite(raw.createdAt), updatedAt: finite(raw.updatedAt ?? raw.createdAt),
    checkedAt: raw.checkedAt == null ? undefined : finite(raw.checkedAt),
  };
}
export function purchaseFromRow(row: PurchaseRow): Purchase {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id, ownerId: row.user_id, listId: present(row.list_id), listName: row.list_name,
    completedAt: finite(row.completed_at), totalItems: finite(row.total_items),
    totalSpent: finite(row.total_spent), detectedItemsTotal: present(row.detected_items_total),
    pendingReceipt: row.pending_receipt === true, paymentMethod: payment(row.payment_method),
    items: rawItems.filter((value): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value))
      .map(value => snapshotItem(value, row.list_id ?? '')),
    storeId: present(row.store_id), storeName: present(row.store_name),
    storeAddress: present(row.store_address), storeCnpj: present(row.store_cnpj),
    receiptPhotoUrl: present(row.receipt_photo_url), receiptQrCode: present(row.receipt_qr_code),
    receiptKey: present(row.receipt_key),
  };
}
export function profileFromRow(row: ProfileRow): Profile {
  const preferences = row.preferences && typeof row.preferences === 'object' && !Array.isArray(row.preferences)
    ? row.preferences as AppPreferences : {};
  return {
    id: row.id, email: present(row.email), username: present(row.username),
    displayName: present(row.display_name), avatarUrl: present(row.avatar_url),
    visibility: row.visibility === 'public' || row.visibility === 'discrete' ? row.visibility : 'private',
    isPhotoPublic: row.is_photo_public !== false, preferences, updatedAt: finite(row.updated_at),
    planTier: row.plan_tier === 'pro' ? 'pro' : row.plan_tier === 'free' ? 'free' : undefined,
    aiScansUsedThisMonth: present(row.ai_scans_used_this_month), aiScansLimit: present(row.ai_scans_limit),
    aiScansResetAt: present(row.ai_scans_reset_at), subscriptionExpiresAt: present(row.subscription_expires_at),
  };
}
export function storePriceFromRow(row: StorePriceRow): StorePrice {
  return {
    id: row.id, storeId: row.store_id, storeName: row.store_name,
    storeCnpj: present(row.store_cnpj), ean: present(row.ean), productName: row.product_name,
    canonicalName: row.canonical_name, categoryId: row.category_id, price: finite(row.price),
    unit: row.unit, priceType: row.price_type === 'confirmed' ? 'confirmed' : 'estimated' as PriceType,
    observedAt: finite(row.observed_at), updatedAt: present(row.updated_at),
  };
}
export function storeSubmissionFromRow(row: StoreSubmissionRow): StoreSubmission {
  return {
    id: row.id, userId: row.user_id, name: row.name, category: row.category as StoreSubmission['category'],
    latitude: row.latitude, longitude: row.longitude, photoPath: row.photo_path,
    status: row.status as StoreSubmission['status'], createdAt: row.created_at,
    reviewedAt: present(row.reviewed_at), reviewReason: present(row.review_reason),
  };
}
