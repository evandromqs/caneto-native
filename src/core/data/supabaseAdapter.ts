import { supabase } from '../../supabase';
import type { Profile, Purchase, ShoppingItem, ShoppingList, StorePrice, StoreSubmission } from '../models/caneto';
import { itemFromRow, listFromRow, profileFromRow, purchaseFromRow, storePriceFromRow, storeSubmissionFromRow } from './rows';
import type { ItemRow, ListMembershipRow, ListRow, ProfileRow, PurchaseRow, StorePriceRow, StoreSubmissionRow } from './rows';
import { generateUUID, getErrorMessage } from '../../ui/error';
import { createListPayload } from '../../data';
import { parseQuickItemInput } from '../categories';

const LIST_COLUMNS = 'id,user_id,name,icon,color,is_default,share_code,permission,access_mode,budget,store_id,store_name,store_address,is_completed,completed_at,payment_method,receipt_photo_url,receipt_qr_code,receipt_key,total_spent,detected_items_total,pending_receipt,created_at,updated_at';
const ITEM_COLUMNS = 'id,list_id,user_id,name,category_id,quantity,unit,price,checked,notes,photo_url,label_photo_url,ean,brand,created_at,updated_at,checked_at';
const PURCHASE_COLUMNS = 'id,user_id,list_id,list_name,completed_at,total_items,total_spent,items,detected_items_total,pending_receipt,payment_method,store_id,store_name,store_address,store_cnpj,receipt_photo_url,receipt_qr_code,receipt_key';
const PROFILE_COLUMNS = 'id,email,username,display_name,avatar_url,visibility,is_photo_public,preferences,updated_at,plan_tier,ai_scans_used_this_month,ai_scans_limit,ai_scans_reset_at,subscription_expires_at';
const STORE_PRICE_COLUMNS = 'id,store_id,store_name,store_cnpj,ean,product_name,canonical_name,category_id,price,unit,price_type,observed_at,updated_at';

async function requireUser(expectedId?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Entre na sua conta para acessar os dados.');
  if (expectedId && expectedId !== data.user.id) throw new Error('Conta diferente da sessão atual.');
  return data.user.id;
}

/** The adapter does not expose service-role credentials. RLS remains authoritative. */
export const canetoData = {
  async lists(expectedUserId?: string): Promise<ShoppingList[]> {
    const userId = await requireUser(expectedUserId);
    const { data: lists, error: listError } = await supabase.from('lists')
      .select(LIST_COLUMNS).order('updated_at', { ascending: false });
    if (listError) throw listError;
    const rows = (lists ?? []) as unknown as ListRow[];
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const [itemResult, membershipResult] = await Promise.all([
      supabase.from('items').select(ITEM_COLUMNS).in('list_id', ids).order('created_at'),
      supabase.from('list_members').select('list_id,user_id,permission').eq('user_id', userId),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (membershipResult.error && rows.some(row => row.user_id !== userId)) throw membershipResult.error;
    const items = ((itemResult.data ?? []) as unknown as ItemRow[]).map(itemFromRow);
    const memberships = (membershipResult.data ?? []) as unknown as ListMembershipRow[];
    const itemsByList = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      const group = itemsByList.get(item.listId) ?? [];
      group.push(item);
      itemsByList.set(item.listId, group);
    }
    const membershipByList = new Map(memberships.map(member => [member.list_id, member]));
    return rows.map(row => listFromRow(row, itemsByList.get(row.id) ?? [], userId,
      membershipByList.get(row.id)));
  },

  async purchases(expectedUserId?: string): Promise<Purchase[]> {
    const userId = await requireUser(expectedUserId);
    const { data, error } = await supabase.from('purchase_history').select(PURCHASE_COLUMNS)
      .eq('user_id', userId).order('completed_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as PurchaseRow[]).map(purchaseFromRow);
  },

  async profile(expectedUserId?: string): Promise<Profile | null> {
    const userId = await requireUser(expectedUserId);
    const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS)
      .eq('id', userId).maybeSingle();
    if (error) throw error;
    return data ? profileFromRow(data as unknown as ProfileRow) : null;
  },

  async storePrices(storeId: string): Promise<StorePrice[]> {
    await requireUser();
    if (!storeId) return [];
    const { data, error } = await supabase.from('store_prices').select(STORE_PRICE_COLUMNS)
      .eq('store_id', storeId).order('observed_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as StorePriceRow[]).map(storePriceFromRow);
  },

  async myStoreSubmissions(expectedUserId?: string): Promise<StoreSubmission[]> {
    const userId = await requireUser(expectedUserId);
    const { data, error } = await supabase.from('store_submissions')
      .select('id,user_id,name,category,latitude,longitude,photo_path,status,created_at,reviewed_at,review_reason')
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as StoreSubmissionRow[]).map(storeSubmissionFromRow);
  },

  async createList(name: string, expectedUserId?: string): Promise<string> {
    const userId = await requireUser(expectedUserId);
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Informe o nome da lista.');
    const payload = createListPayload({ name: cleanName, userId });
    const { error } = await supabase.from('lists').insert(payload);
    if (error) {
      console.error('Erro ao criar lista no Supabase:', error);
      throw new Error(getErrorMessage(error));
    }
    return payload.id;
  },

  async addItem(list: ShoppingList, name: string, expectedUserId?: string): Promise<string> {
    const userId = await requireUser(expectedUserId);
    if (list.permission === 'viewer') throw new Error('Você tem acesso somente para leitura.');
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Informe o nome do produto.');
    const parsed = parseQuickItemInput(cleanName);
    const id = generateUUID();
    const now = Date.now();
    const { error } = await supabase.from('items').insert({
      id, list_id: list.id, user_id: userId, name: parsed.name, category_id: parsed.categoryId,
      quantity: parsed.quantity, unit: parsed.unit, price: parsed.price ?? null, checked: false, created_at: now, updated_at: now,
    });
    if (error) throw new Error(getErrorMessage(error));
    // A política de listas permite atualizar o relógio apenas ao dono.
    if (list.ownerId === userId) {
      const { error: touchError } = await supabase.from('lists').update({ updated_at: now }).eq('id', list.id);
      if (touchError) throw new Error(getErrorMessage(touchError));
    }
    return id;
  },

  async setItemChecked(list: ShoppingList, item: ShoppingItem, checked: boolean, expectedUserId?: string): Promise<void> {
    const userId = await requireUser(expectedUserId);
    if (list.permission === 'viewer' || item.listId !== list.id) throw new Error('Sem permissão para editar este item.');
    const now = Date.now();
    const { error } = await supabase.from('items').update({
      checked, checked_at: checked ? now : null, updated_at: now,
    }).eq('id', item.id).eq('list_id', list.id);
    if (error) throw error;
    if (list.ownerId === userId) {
      const { error: touchError } = await supabase.from('lists').update({ updated_at: now }).eq('id', list.id);
      if (touchError) throw touchError;
    }
  },
};
