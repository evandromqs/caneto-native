import { CANETO_API } from '../../core/api';

export type ProductSuggestion = {
  name: string;
  categoryId: string;
  brand?: string;
  ean?: string;
  image?: string;
};

const PRODUCT_CACHE_KEY = 'caneto.products.search.cache.v1';
const CACHE_TTL_MS = 1000 * 60 * 15;
const memoryCache = new Map<string, { at: number; items: ProductSuggestion[] }>();

function readPersisted(term: string): ProductSuggestion[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { at: number; items: ProductSuggestion[] }>;
    const entry = map[term];
    if (entry && Date.now() - entry.at < CACHE_TTL_MS && Array.isArray(entry.items)) {
      memoryCache.set(term, entry);
      return entry.items;
    }
  } catch {}
  return null;
}

function writePersisted(term: string, items: ProductSuggestion[]) {
  const entry = { at: Date.now(), items };
  memoryCache.set(term, entry);
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { at: number; items: ProductSuggestion[] }>) : {};
    map[term] = entry;
    const keys = Object.keys(map);
    if (keys.length > 40) delete map[keys[0]];
    localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

export async function searchProductSuggestions(query: string, signal?: AbortSignal): Promise<ProductSuggestion[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const normalized = term.toLowerCase();
  const cached = memoryCache.get(normalized);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.items;
  const persisted = readPersisted(normalized);
  if (persisted) return persisted;

  const response = await fetch(`${CANETO_API}/api/products/search?q=${encodeURIComponent(term)}&limit=4&source=app`, { signal });
  if (!response.ok) throw new Error('Busca de produtos indisponível.');
  const body = await response.json() as { results?: unknown };
  if (!Array.isArray(body.results)) return [];
  const items = body.results.filter((row): row is ProductSuggestion => !!row && typeof row === 'object'
    && typeof row.name === 'string' && !!row.name.trim() && typeof row.categoryId === 'string').slice(0, 4);
  writePersisted(normalized, items);
  return items;
}
