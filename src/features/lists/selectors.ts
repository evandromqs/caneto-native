import type { ShoppingList } from '../../core/models/caneto';

export type ListsSubTab = 'active' | 'completed';
export type ListsSortBy = 'recent' | 'az' | 'items';

export function selectVisibleLists(lists: readonly ShoppingList[], tab: ListsSubTab, search: string, sortBy: ListsSortBy, ownerNameById?: Readonly<Record<string, string>>): ShoppingList[] {
  const query = search.toLocaleLowerCase('pt-BR').trim();
  const filtered = lists.filter(list => {
    if (list.isCompleted !== (tab === 'completed')) return false;
    if (!query) return true;
    return list.name.toLocaleLowerCase('pt-BR').includes(query)
      || (list.storeName?.toLocaleLowerCase('pt-BR').includes(query) ?? false)
      || (ownerNameById?.[list.ownerId]?.toLocaleLowerCase('pt-BR').includes(query) ?? false)
      || list.items.some(item => item.name.toLocaleLowerCase('pt-BR').includes(query));
  });
  return filtered.sort((a, b) => {
    if (sortBy === 'az') return a.name.localeCompare(b.name, 'pt-BR');
    if (sortBy === 'items') return b.items.length - a.items.length;
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });
}

export function listMetrics(list: ShoppingList) {
  const totalItems = list.items.length;
  const checkedItems = list.items.filter(item => item.checked).length;
  const progress = totalItems ? Math.round(checkedItems * 100 / totalItems) : 0;
  const estimatedTotal = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  return { totalItems, checkedItems, progress, estimatedTotal };
}
