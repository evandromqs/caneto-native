import { supabase } from '../../supabase';
import type { List } from '../../data';

export type AccessRequest = { id: string; requester_name: string; created_at: string };

export async function ensureShareCode(list: List): Promise<string> {
  if (list.share_code) return list.share_code;
  const prefix = list.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const code = `${prefix}${String(Date.now()).slice(-3)}`;
  const { error } = await supabase.from('lists').update({ share_code: code, updated_at: Date.now() }).eq('id', list.id);
  if (error) throw error;
  return code;
}

export async function joinListByCode(code: string): Promise<'joined' | 'pending'> {
  const { data, error } = await supabase.rpc('join_list_by_code', { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  const response = typeof data === 'string' ? JSON.parse(data) : data;
  if (response?.success) return 'joined';
  if (response?.error === 'aguardando_aprovacao') return 'pending';
  if (response?.error === 'codigo_nao_encontrado') throw new Error('Código não encontrado. Verifique e tente novamente.');
  throw new Error('Não foi possível entrar na lista.');
}

export async function loadAccessRequests(listId: string): Promise<AccessRequest[]> {
  const { data, error } = await supabase.from('list_access_requests').select('id,requester_name,created_at').eq('list_id', listId).eq('status', 'pending').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function respondAccessRequest(id: string, approve: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('respond_list_access_request', { p_request_id: id, p_approve: approve });
  if (error) throw error;
  if (data !== true) throw new Error('A solicitação já foi respondida.');
}
