/** Domain contracts shared by native screens. Times are Unix milliseconds, as in the web app. */
export type Unit = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'pct' | 'cx' | 'dz' | 'lata' | 'garrafa';
export type PaymentMethod = 'debito' | 'credito' | 'dinheiro' | 'pix';
export type ListPermission = 'owner' | 'editor' | 'viewer';
export type AccessMode = 'public' | 'friends_only' | 'private';
export type PriceType = 'confirmed' | 'estimated';

export interface ShoppingItem {
  id: string;
  listId: string;
  authorId?: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: Unit;
  price?: number;
  priceType?: PriceType;
  checked: boolean;
  notes?: string;
  photoUrl?: string;
  labelPhotoUrl?: string;
  ean?: string;
  brand?: string;
  createdAt: number;
  updatedAt: number;
  checkedAt?: number;
}

export interface DeletedShoppingItem extends ShoppingItem {
  deletedAt: number;
  originalListId?: string;
}

export interface ShoppingList {
  id: string;
  ownerId: string;
  permission: ListPermission;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  shareCode?: string;
  accessMode: AccessMode;
  budget?: number;
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
  isCompleted: boolean;
  completedAt?: number;
  paymentMethod?: PaymentMethod;
  receiptPhotoUrl?: string;
  receiptQrCode?: string;
  receiptKey?: string;
  totalSpent?: number;
  detectedItemsTotal?: number;
  pendingReceipt: boolean;
  createdAt: number;
  updatedAt: number;
  items: ShoppingItem[];
  trashItems?: DeletedShoppingItem[];
}

export interface Purchase {
  id: string;
  ownerId: string;
  listId?: string;
  listName: string;
  completedAt: number;
  totalItems: number;
  totalSpent: number;
  detectedItemsTotal?: number;
  pendingReceipt: boolean;
  paymentMethod?: PaymentMethod;
  items: ShoppingItem[];
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
  storeCnpj?: string;
  receiptPhotoUrl?: string;
  receiptQrCode?: string;
  receiptKey?: string;
}

export interface AppPreferences {
  checkboxStyle?: 'circle' | 'switch';
  theme?: 'light' | 'dark' | 'system';
  showCategoryHeaders?: boolean;
  sortByCategory?: boolean;
  soundEffects?: boolean;
  currency?: string;
  keepScreenAwake?: boolean;
  fontSize?: 'small' | 'normal' | 'large';
  highContrast?: boolean;
  vibration?: boolean;
  hasCompletedOnboarding?: boolean;
}

export interface Profile {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  visibility: 'public' | 'discrete' | 'private';
  isPhotoPublic: boolean;
  preferences: AppPreferences;
  planTier?: 'free' | 'pro';
  aiScansUsedThisMonth?: number;
  aiScansLimit?: number;
  aiScansResetAt?: string;
  subscriptionExpiresAt?: string;
  updatedAt: number;
}

export type StoreCategory = 'supermarket' | 'wholesale' | 'produce' | 'butcher' | 'bakery' |
  'pharmacy' | 'beverages' | 'petshop' | 'convenience' | 'other';

/** External map provider store. It is not a row in public.stores. */
export interface Store {
  id: string;
  name: string;
  category: StoreCategory;
  categoryLabel: string;
  address: string;
  distance?: string;
  cnpj?: string;
  rating?: number;
  reviewsCount?: number;
  openStatus?: string;
  thumbnailUrl?: string;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  website?: string;
  googleMapsUrl?: string;
  weekdayText?: string[];
  isOpenNow?: boolean;
  placeId?: string;
  source?: 'google' | 'openstreetmap';
}

export interface StorePrice {
  id?: string;
  storeId: string;
  storeName: string;
  storeCnpj?: string;
  ean?: string;
  productName: string;
  canonicalName: string;
  categoryId: string;
  price: number;
  unit: string;
  priceType: PriceType;
  observedAt: number;
  updatedAt?: number;
}

export interface StoreSubmission {
  id: string;
  userId: string;
  name: string;
  category: StoreCategory;
  latitude: number;
  longitude: number;
  photoPath: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewReason?: string;
}

/** UI hints only; Supabase RLS remains the final authorization boundary. */
export function listCapabilities(list: ShoppingList) {
  const isOwner = list.permission === 'owner';
  return {
    read: true,
    editItems: isOwner || list.permission === 'editor',
    editList: isOwner,
    manageMembers: isOwner,
    deleteList: isOwner,
    completeList: isOwner,
    leaveList: !isOwner,
  } as const;
}
