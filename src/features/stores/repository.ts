import { supabase } from '../../supabase';
import { categoryLabel, normalizeStoreText, type Coordinates, type Store, type StoreCategory, type StorePrice } from './model';

const API_ORIGIN = (process.env.EXPO_PUBLIC_CANETO_API_URL || 'https://www.caneto.online').replace(/\/$/, '');

type PlaceResponse = { stores?: unknown[]; store?: unknown; error?: string };
type CommunityRow = { id: string; name: string; category: string; latitude: number; longitude: number };

function categoryOf(value: unknown): StoreCategory {
  const valid: StoreCategory[] = ['supermarket', 'wholesale', 'bakery', 'pharmacy', 'butcher', 'produce', 'beverages', 'petshop', 'convenience', 'other'];
  return typeof value === 'string' && valid.includes(value as StoreCategory) ? value as StoreCategory : 'other';
}

function absolutePhoto(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if (value.startsWith('/api/places/photo?')) return `${API_ORIGIN}${value}`;
  return value.startsWith('https://') ? value : undefined;
}

function parsePlace(value: unknown): Store | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || !row.name.trim()) return null;
  const category = categoryOf(row.category);
  const photos = Array.isArray(row.photos) ? row.photos.map(absolutePhoto).filter((photo): photo is string => !!photo) : [];
  const rating = typeof row.rating === 'number' && row.rating >= 0 && row.rating <= 5 ? row.rating : undefined;
  return {
    id: row.id, placeId: typeof row.placeId === 'string' ? row.placeId : row.id,
    name: row.name, category, categoryLabel: typeof row.categoryLabel === 'string' ? row.categoryLabel : categoryLabel(category),
    address: typeof row.address === 'string' ? row.address : '', distance: typeof row.distance === 'string' ? row.distance : undefined,
    rating, reviewsCount: typeof row.reviewsCount === 'number' ? row.reviewsCount : undefined,
    openStatus: typeof row.openStatus === 'string' ? row.openStatus : undefined,
    thumbnailUrl: absolutePhoto(row.thumbnailUrl) ?? photos[0], photos,
    lat: typeof row.lat === 'number' ? row.lat : undefined, lon: typeof row.lon === 'number' ? row.lon : undefined,
    phoneNumber: typeof row.phoneNumber === 'string' ? row.phoneNumber : undefined,
    website: typeof row.website === 'string' ? row.website : undefined,
    googleMapsUrl: typeof row.googleMapsUrl === 'string' ? row.googleMapsUrl : undefined,
    weekdayText: Array.isArray(row.weekdayText) ? row.weekdayText.filter((v): v is string => typeof v === 'string') : undefined,
    source: 'google',
  };
}

async function getJson(url: string): Promise<PlaceResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('A busca de locais está indisponível. Tente novamente.');
    return await response.json() as PlaceResponse;
  } finally { clearTimeout(timeout); }
}

function communityStore(row: CommunityRow, coords?: Coordinates): Store {
  const category = categoryOf(row.category);
  const distanceKm = coords ? haversine(coords.lat, coords.lng, row.latitude, row.longitude) : null;
  return { id: `community-${row.id}`, name: row.name, category, categoryLabel: categoryLabel(category), address: '',
    distance: distanceKm === null ? undefined : distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
    lat: row.latitude, lon: row.longitude, source: 'community' };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchStores(query = '', category: StoreCategory = 'all', coords?: Coordinates): Promise<Store[]> {
  const q = query.trim().slice(0, 160);
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  } else if (category !== 'all') {
    params.set('category', category);
  } else if (!coords) {
    params.set('q', 'supermercado');
  }
  if (coords) {
    params.set('lat', String(coords.lat));
    params.set('lng', String(coords.lng));
  }

  let communityQuery = supabase.from('store_submissions')
    .select('id,name,category,latitude,longitude')
    .eq('status', 'approved');
  if (q) communityQuery = communityQuery.ilike('name', `%${q.replace(/[%_]/g, '')}%`);
  else if (category !== 'all') communityQuery = communityQuery.eq('category', category);

  const [places, community] = await Promise.allSettled([
    getJson(`${API_ORIGIN}/api/places?${params}`),
    communityQuery.order('created_at', { ascending: false }).limit(80),
  ]);
  const remote = places.status === 'fulfilled' && Array.isArray(places.value.stores)
    ? places.value.stores.map(parsePlace).filter((store): store is Store => !!store) : [];
  const rows = community.status === 'fulfilled' && !community.value.error ? (community.value.data ?? []) as CommunityRow[] : [];
  const submitted = rows.map(row => communityStore(row, coords));
  if (places.status === 'rejected' && (community.status === 'rejected' || community.value.error)) {
    throw new Error('Não foi possível carregar os locais. Verifique a conexão e tente novamente.');
  }
  const filteredRemote = category === 'all' ? remote : remote.filter(store => store.category === category);
  const filteredSubmitted = submitted.filter(store => {
    if (q) {
      const value = normalizeStoreText(`${store.name} ${store.address} ${store.categoryLabel}`);
      return value.includes(normalizeStoreText(q));
    }
    return category === 'all' || store.category === category;
  });
  const matches = [...filteredRemote, ...filteredSubmitted];
  return [...new Map(matches.map(store => [store.id, store])).values()];
}

export async function loadStoreDetails(store: Store): Promise<Store> {
  if (store.source !== 'google' || !store.placeId) return store;
  const data = await getJson(`${API_ORIGIN}/api/places?placeId=${encodeURIComponent(store.placeId)}`);
  return parsePlace(data.store) ?? store;
}

export async function loadStorePrices(storeId: string): Promise<StorePrice[]> {
  const { data, error } = await supabase.from('store_prices')
    .select('id,product_name,canonical_name,category_id,price,unit,price_type,observed_at')
    .eq('store_id', storeId).order('observed_at', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row, price: Number(row.price) })) as StorePrice[];
}

export async function linkStoreToList(listId: string, store: Store | null): Promise<void> {
  const { error } = await supabase.from('lists').update({
    store_id: store?.id ?? null, store_name: store?.name ?? null, store_address: store?.address || null,
    updated_at: Date.now(),
  }).eq('id', listId);
  if (error) throw error;
}
