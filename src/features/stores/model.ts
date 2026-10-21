export const STORE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'supermarket', label: 'Supermercados' },
  { id: 'wholesale', label: 'Atacadistas' },
  { id: 'bakery', label: 'Padarias' },
  { id: 'pharmacy', label: 'Farmácias' },
  { id: 'butcher', label: 'Açougues' },
  { id: 'produce', label: 'Hortifrúti' },
  { id: 'beverages', label: 'Bebidas' },
  { id: 'petshop', label: 'Pet shop' },
  { id: 'convenience', label: 'Conveniência' },
  { id: 'other', label: 'Outros' },
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number]['id'];
export type Coordinates = { lat: number; lng: number };

export type Store = {
  id: string;
  name: string;
  category: StoreCategory;
  categoryLabel: string;
  address: string;
  distance?: string;
  rating?: number;
  reviewsCount?: number;
  openStatus?: string;
  thumbnailUrl?: string;
  photos?: string[];
  lat?: number;
  lon?: number;
  phoneNumber?: string;
  website?: string;
  googleMapsUrl?: string;
  weekdayText?: string[];
  placeId?: string;
  source: 'google' | 'community';
};

export type StorePrice = {
  id: string;
  product_name: string;
  canonical_name: string;
  category_id: string;
  price: number;
  unit: string;
  price_type: 'confirmed' | 'estimated';
  observed_at: number;
};

export function normalizeStoreText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function categoryLabel(category: StoreCategory): string {
  return STORE_CATEGORIES.find(entry => entry.id === category)?.label ?? 'Loja';
}
