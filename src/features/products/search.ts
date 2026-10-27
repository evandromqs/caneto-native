import { CANETO_API } from '../../core/api';

export type ProductSuggestion = {
  name: string;
  categoryId: string;
  brand?: string;
  ean?: string;
  image?: string;
};

export async function searchProductSuggestions(query: string, signal?: AbortSignal): Promise<ProductSuggestion[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const response = await fetch(`${CANETO_API}/api/products/search?q=${encodeURIComponent(term)}&limit=4&source=app`, { signal });
  if (!response.ok) throw new Error('Busca de produtos indisponível.');
  const body = await response.json() as { results?: unknown };
  if (!Array.isArray(body.results)) return [];
  return body.results.filter((row): row is ProductSuggestion => !!row && typeof row === 'object'
    && typeof row.name === 'string' && !!row.name.trim() && typeof row.categoryId === 'string').slice(0, 4);
}
