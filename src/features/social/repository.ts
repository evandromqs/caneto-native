import { supabase } from '../../supabase';
import * as Crypto from 'expo-crypto';
import type { AccessedList, RankingSummary, SocialFriend, SocialInvitation, SocialScreenProps, SocialSearchResult } from './SocialScreen';

type ListStats = { id: string; name: string; user_id: string; items?: { price?: number | null }[] };
type PurchaseStats = { total_items: number };
type FriendRow = {
  id: string; user_id: string; friend_id: string | null; friend_username: string;
  friend_name: string; requester_username: string | null; requester_name: string | null;
  status: string; created_at: number;
};
type ShareRow = {
  id: string; list_id: string; list_name: string; sender_id: string;
  sender_name: string; sender_username: string; recipient_id: string | null;
  recipient_username: string; status: string; updated_at: number; created_at: number;
};
type PublicProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

export type SocialDataProps = Pick<SocialScreenProps, 'friends' | 'invitations' | 'accessedLists' | 'ranking'>;

async function currentUser(expectedId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedId) throw new Error('Entre com a mesma conta usada no Caneto.');
  return data.user;
}

function rankFromRealData(
  name: string, avatarUrl: string | undefined, userId: string,
  lists: ListStats[], purchaseRows: PurchaseStats[], acceptedFriends: number,
): RankingSummary {
  const itemCount = lists.reduce((total, list) => total + (list.items?.length ?? 0), 0);
  const pricedCount = lists.reduce((total, list) => total + (list.items?.filter(item => Number(item.price) > 0).length ?? 0), 0);
  const purchasedItems = purchaseRows.reduce((total, purchase) => total + Number(purchase.total_items || 0), 0);
  const purchases = purchaseRows.length;
  // Same own-account scoring formula as SocialTab.tsx. Friends have no readable
  // shopping history under RLS, so we never manufacture their scores.
  const score = itemCount * 10 + purchasedItems * 15 + pricedCount * 25 + purchases * 50 + lists.length * 40 + acceptedFriends * 50;
  const level = score >= 1500 ? ['Nível 5 • Lenda do Caneto', 3000, 'Lenda das Compras'] as const :
    score >= 800 ? ['Nível 4 • Mestre dos Carrinhos', 1500, 'Mestre dos Carrinhos'] as const :
      score >= 400 ? ['Nível 3 • Radar de Ofertas', 800, 'Caçador de Ofertas'] as const :
        score >= 150 ? ['Nível 2 • Comprador Esperto', 400, 'Comprador Frequente'] as const :
          ['Nível 1 • Iniciante', 200, 'Novato em Compras'] as const;
  const achievement = (id: string, title: string, description: string, current: number, goal: number) => ({
    id, title, description, unlocked: current >= goal, progress: `${Math.min(current, goal)}/${goal}`,
  });
  return {
    name, levelName: level[0], score, nextLevelScore: level[1],
    listsCreated: lists.length, itemsInLists: itemCount, purchases,
    achievements: [
      achievement('ach-1', 'Criador de Listas', 'Criou sua primeira lista de compras', lists.length, 1),
      achievement('ach-2', 'Carrinho Cheio', 'Adicionou 10 ou mais itens às listas', itemCount, 10),
      achievement('ach-3', 'Radar de Preços', 'Cadastrou valores nos itens para economizar', pricedCount, 3),
      achievement('ach-4', 'Compra Concluída', 'Finalizou uma compra completa no mercado', purchases, 1),
      achievement('ach-5', 'Social & Conectado', 'Conectou com amigos para compras em equipe', acceptedFriends, 1),
    ],
    people: [{ id: userId, name: `${name} (Você)`, score, badge: level[2], isMe: true, avatarUrl }],
  };
}

/**
 * Read-only snapshot for SocialScreen. Pass already-loaded lists/purchases to
 * avoid duplicate queries; omit them to let this repository fetch narrow data.
 */
export async function loadSocialData(
  userId: string,
  preloaded?: { lists?: ListStats[]; purchases?: PurchaseStats[] },
): Promise<SocialDataProps> {
  const user = await currentUser(userId);
  const [ownProfileResult, friendResult, shareResult, listResult, purchaseResult] = await Promise.all([
    supabase.from('profiles').select('username,display_name,avatar_url').eq('id', userId).maybeSingle(),
    // RLS exposes only friendships involving the current account, including
    // pending username invitations that do not yet have friend_id.
    supabase.from('friendships')
      .select('id,user_id,friend_id,friend_username,friend_name,requester_username,requester_name,status,created_at')
      .order('created_at', { ascending: false }).limit(300),
    supabase.from('list_shares')
      .select('id,list_id,list_name,sender_id,sender_name,sender_username,recipient_id,recipient_username,status,updated_at,created_at')
      .neq('status', 'declined').order('created_at', { ascending: false }).limit(300),
    preloaded?.lists ? Promise.resolve({ data: preloaded.lists, error: null }) :
      supabase.from('lists').select('id,name,user_id').order('updated_at', { ascending: false }),
    preloaded?.purchases ? Promise.resolve({ data: preloaded.purchases, error: null }) :
      supabase.from('purchase_history').select('total_items').eq('user_id', userId),
  ]);
  if (ownProfileResult.error) throw ownProfileResult.error;
  if (friendResult.error) throw friendResult.error;
  if (shareResult.error) throw shareResult.error;
  if (listResult.error) throw listResult.error;
  if (purchaseResult.error) throw purchaseResult.error;

  const ownProfile = ownProfileResult.data;
  const username = String(ownProfile?.username ?? '').toLowerCase();
  const friendsRaw = (friendResult.data ?? []) as FriendRow[];
  const shares = (shareResult.data ?? []) as ShareRow[];
  const lists = (listResult.data ?? []) as ListStats[];
  const purchases = (purchaseResult.data ?? []) as PurchaseStats[];
  const accessedRows = lists.filter(list => list.user_id !== userId);
  const otherIds = [...new Set([
    ...friendsRaw.map(friend => friend.user_id === userId ? friend.friend_id : friend.user_id),
    ...accessedRows.map(list => list.user_id),
  ].filter((id): id is string => !!id && id !== userId))];
  const publicProfilesResult = otherIds.length ? await supabase.from('public_profiles')
    .select('id,username,display_name,avatar_url').in('id', otherIds) : { data: [], error: null };
  // Missing public_profiles must not hide actual friendship/list rows.
  const profiles = new Map(((publicProfilesResult.data ?? []) as PublicProfileRow[]).map(row => [row.id, row]));

  const sharedCounts = new Map<string, Set<string>>();
  for (const share of shares) {
    const otherId = share.sender_id === userId ? share.recipient_id : share.sender_id;
    if (!otherId) continue;
    const count = sharedCounts.get(otherId) ?? new Set<string>();
    count.add(share.list_id);
    sharedCounts.set(otherId, count);
  }
  const friends: SocialFriend[] = friendsRaw
    .filter(row => row.user_id === userId || row.friend_id === userId ||
      (username && row.friend_username.toLowerCase().replace(/^@/, '') === username))
    .map(row => {
      const outgoing = row.user_id === userId;
      const otherId = outgoing ? row.friend_id : row.user_id;
      const other = otherId ? profiles.get(otherId) : undefined;
      const status: SocialFriend['status'] = row.status === 'accepted' ? 'accepted' : outgoing ? 'pending_sent' : 'pending_received';
      return {
        id: row.id, name: other?.display_name || (outgoing ? row.friend_name : row.requester_name || row.friend_name),
        username: other?.username || (outgoing ? row.friend_username : row.requester_username || ''),
        avatarUrl: other?.avatar_url ?? undefined, status,
        sharedListsCount: otherId ? sharedCounts.get(otherId)?.size ?? 0 : 0,
      };
    });
  const invitations: SocialInvitation[] = shares
    .filter(share => share.status === 'pending' && share.recipient_id === userId)
    .map(share => ({ id: share.id, listName: share.list_name,
      senderName: share.sender_name, senderUsername: share.sender_username }));

  const acceptedSharesResult = accessedRows.length ? await supabase.from('list_shares')
    .select('list_id,updated_at').eq('recipient_id', userId).eq('status', 'accepted') : { data: [], error: null };
  const joined = new Map<string, number>();
  if (!acceptedSharesResult.error) for (const row of acceptedSharesResult.data ?? []) {
    if (Number.isFinite(Number(row.updated_at))) joined.set(row.list_id, Number(row.updated_at));
  }
  const accessedLists: AccessedList[] = accessedRows.map(list => ({
    id: list.id, name: list.name,
    ownerName: profiles.get(list.user_id)?.display_name ||
      (profiles.get(list.user_id)?.username ? `@${profiles.get(list.user_id)?.username}` : undefined),
    joinedAt: joined.get(list.id),
  }));

  // Without item counts and prices, the score would be misleading. Fetch only
  // the two columns needed when callers have not supplied full list objects.
  if (!preloaded?.lists && lists.length > 0) {
    const { data: itemRows, error } = await supabase.from('items').select('list_id,price').in('list_id', lists.map(list => list.id));
    if (error) throw error;
    const byList = new Map<string, { price: number | null }[]>();
    for (const item of itemRows ?? []) {
      const group = byList.get(item.list_id) ?? [];
      group.push({ price: item.price });
      byList.set(item.list_id, group);
    }
    for (const list of lists) list.items = byList.get(list.id) ?? [];
  }
  const name = ownProfile?.display_name || user.email?.split('@')[0] || 'Usuário Caneto';
  return {
    friends, invitations, accessedLists,
    ranking: rankFromRealData(name, ownProfile?.avatar_url ?? undefined, userId, lists, purchases,
      friends.filter(friend => friend.status === 'accepted').length),
  };
}

const cleanUsername = (value: string) => value.trim().toLowerCase().replace(/^@/, '');

async function ownUsername(userId: string): Promise<string> {
  const { data, error } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  if (error) throw error;
  return cleanUsername(data?.username ?? '');
}

type SearchRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };

/** Approximate search uses the same privacy-aware RPC as SocialTab.tsx with direct profiles fallback. */
export async function searchSocialUsers(userId: string, term: string): Promise<SocialSearchResult[]> {
  await currentUser(userId);
  const query = cleanUsername(term);
  if (query.length < 2) return [];

  let matches: SearchRow[] = [];

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_users_approximate', {
      search_term: query, current_user_id: userId,
    });
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      matches = (rpcData as SearchRow[]).filter(row => row.id !== userId);
    }
  } catch (rpcErr) {
    console.warn('search_users_approximate RPC failed, using profiles fallback:', rpcErr);
  }

  // Fallback se RPC não retornou resultados ou falhou
  if (!matches.length) {
    const clean = query.toLowerCase().replace(/[,()]/g, '');
    const noAccents = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const terms = Array.from(new Set([clean, noAccents].filter(t => t.length >= 2)));
    if (terms.length > 0) {
      const orConditions = terms.flatMap(t => [
        `username.ilike.%${t}%`,
        `display_name.ilike.%${t}%`,
        `email.ilike.%${t}%`,
      ]).join(',');

      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url')
        .or(orConditions)
        .neq('id', userId)
        .limit(20);

      if (fallbackData && fallbackData.length > 0) {
        matches = fallbackData as SearchRow[];
      }
    }
  }

  if (!matches.length) return [];
  const { data: relationships, error: relationError } = await supabase.from('friendships')
    .select('user_id,friend_id,friend_username,status').limit(300);
  if (relationError) throw relationError;
  return matches.map(match => {
    const existing = (relationships ?? []).find(row =>
      (row.user_id === userId && (row.friend_id === match.id || cleanUsername(row.friend_username) === cleanUsername(match.username))) ||
      (row.user_id === match.id && row.friend_id === userId));
    const relationship: SocialFriend['status'] | undefined = !existing ? undefined :
      existing.status === 'accepted' ? 'accepted' : existing.user_id === userId ? 'pending_sent' : 'pending_received';
    return { id: match.id, name: match.display_name || match.username, username: match.username,
      avatarUrl: match.avatar_url ?? undefined, relationship };
  });
}

type FriendMutationRow = Pick<FriendRow, 'id' | 'user_id' | 'friend_id' | 'friend_username' | 'status'>;

async function findFriendship(userId: string, targetId: string, targetUsername: string): Promise<FriendMutationRow | undefined> {
  const { data, error } = await supabase.from('friendships')
    .select('id,user_id,friend_id,friend_username,status').limit(300);
  if (error) throw error;
  return ((data ?? []) as FriendMutationRow[]).find(row =>
    (row.user_id === userId && (row.friend_id === targetId || cleanUsername(row.friend_username) === targetUsername)) ||
    (row.user_id === targetId && (row.friend_id === userId || cleanUsername(row.friend_username) === targetUsername)));
}

/** Creates a request for a verified public profile ID; never creates a local-only friend. */
export async function sendFriendRequest(userId: string, targetUserId: string): Promise<string> {
  const user = await currentUser(userId);
  if (targetUserId === userId) throw new Error('Você não pode adicionar seu próprio perfil.');
  const [targetResult, ownResult] = await Promise.all([
    supabase.from('public_profiles').select('id,username,display_name').eq('id', targetUserId).maybeSingle(),
    supabase.from('profiles').select('username,display_name').eq('id', userId).maybeSingle(),
  ]);
  let target = targetResult.data;
  if (!target) {
    const { data: fallbackProfile } = await supabase.from('profiles').select('id,username,display_name').eq('id', targetUserId).maybeSingle();
    target = fallbackProfile;
  }
  if (!target?.id || !target.username) throw new Error('Perfil não encontrado no Caneto.');
  if (!ownResult.data?.username) throw new Error('Defina seu @usuário no perfil antes de enviar convites.');
  const existing = await findFriendship(userId, target.id, cleanUsername(target.username));
  if (existing?.status === 'accepted') throw new Error('Vocês já são amigos conectados.');
  if (existing?.status === 'pending_sent' && existing.user_id === userId) {
    throw new Error('Você já enviou uma solicitação pendente para este amigo.');
  }
  if (existing?.status === 'pending_sent' && existing.user_id === target.id) {
    await acceptFriendRequest(userId, existing.id);
    return existing.id;
  }
  const id = Crypto.randomUUID();
  const now = Date.now();
  const { error } = await supabase.from('friendships').insert({
    id, user_id: user.id, friend_id: target.id,
    friend_username: target.username,
    friend_name: target.display_name || target.username,
    requester_username: ownResult.data.username,
    requester_name: ownResult.data.display_name || user.email?.split('@')[0] || ownResult.data.username,
    status: 'pending_sent', created_at: now, updated_at: now,
  });
  if (error) throw error;
  return id;
}

async function getFriendshipForAction(userId: string, friendshipId: string): Promise<FriendMutationRow> {
  await currentUser(userId);
  const { data, error } = await supabase.from('friendships')
    .select('id,user_id,friend_id,friend_username,status').eq('id', friendshipId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Solicitação de amizade não encontrada.');
  return data as FriendMutationRow;
}

async function isRecipient(userId: string, row: FriendMutationRow): Promise<boolean> {
  if (row.friend_id === userId) return true;
  // Legacy requests can be addressed by username before friend_id is linked.
  const username = await ownUsername(userId);
  return !!username && row.user_id !== userId && cleanUsername(row.friend_username) === username;
}

export async function acceptFriendRequest(userId: string, friendshipId: string): Promise<void> {
  const row = await getFriendshipForAction(userId, friendshipId);
  if (row.status !== 'pending_sent' || !(await isRecipient(userId, row))) {
    throw new Error('Esta solicitação não está pendente para você.');
  }
  const { data, error } = await supabase.from('friendships')
    .update({ status: 'accepted', friend_id: userId, updated_at: Date.now() })
    .eq('id', friendshipId).eq('status', 'pending_sent').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('A solicitação já foi alterada. Atualize a lista.');
}

export async function declineFriendRequest(userId: string, friendshipId: string): Promise<void> {
  const row = await getFriendshipForAction(userId, friendshipId);
  if (row.status !== 'pending_sent' || !(await isRecipient(userId, row))) {
    throw new Error('Esta solicitação não está pendente para você.');
  }
  const { data, error } = await supabase.from('friendships').delete()
    .eq('id', friendshipId).eq('status', 'pending_sent').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('A solicitação já foi alterada. Atualize a lista.');
}

export async function cancelFriendRequest(userId: string, friendshipId: string): Promise<void> {
  const row = await getFriendshipForAction(userId, friendshipId);
  if (row.status !== 'pending_sent' || row.user_id !== userId) {
    throw new Error('Você só pode cancelar uma solicitação enviada por você.');
  }
  const { data, error } = await supabase.from('friendships').delete()
    .eq('id', friendshipId).eq('status', 'pending_sent').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('A solicitação já foi alterada. Atualize a lista.');
}

type InvitationMutationRow = Pick<ShareRow, 'id' | 'list_id' | 'recipient_id' | 'status'> & { permission: 'editor' | 'viewer' };

async function getInvitationForAction(userId: string, invitationId: string): Promise<InvitationMutationRow> {
  await currentUser(userId);
  const { data, error } = await supabase.from('list_shares')
    .select('id,list_id,recipient_id,status,permission').eq('id', invitationId).maybeSingle();
  if (error) throw error;
  if (!data || data.recipient_id !== userId || data.status !== 'pending') {
    throw new Error('Convite não encontrado ou já respondido.');
  }
  return data as InvitationMutationRow;
}

/** Accepts invitation and guarantees list_members membership before success. */
export async function acceptListInvitation(userId: string, invitationId: string): Promise<string> {
  const invitation = await getInvitationForAction(userId, invitationId);
  const { data: accepted, error } = await supabase.from('list_shares')
    .update({ status: 'accepted', updated_at: Date.now() })
    .eq('id', invitationId).eq('status', 'pending').select('id').maybeSingle();
  if (error) throw error;
  if (!accepted) throw new Error('O convite já foi respondido. Atualize a lista.');
  try {
    const { data: membership, error: readError } = await supabase.from('list_members')
      .select('permission').eq('list_id', invitation.list_id).eq('user_id', userId).maybeSingle();
    if (readError) throw readError;
    if (membership && membership.permission !== invitation.permission) {
      throw new Error('O acesso à lista precisa ser atualizado pelo dono antes de aceitar este convite.');
    }
    if (!membership) {
      const { error: insertError } = await supabase.from('list_members').insert({
        list_id: invitation.list_id, user_id: userId, permission: invitation.permission,
      });
      if (insertError) throw insertError;
    }
  } catch (cause) {
    // A migration may be absent or the owner may have granted a different role.
    // Restore pending status so the UI does not claim access that was not granted.
    await supabase.from('list_shares').update({ status: 'pending', updated_at: Date.now() }).eq('id', invitationId);
    throw cause;
  }
  return invitation.list_id;
}

/** Declines the invitation. Existing list membership, if any, is owner-managed by RLS. */
export async function declineListInvitation(userId: string, invitationId: string): Promise<void> {
  await getInvitationForAction(userId, invitationId);
  const { data, error } = await supabase.from('list_shares')
    .update({ status: 'declined', updated_at: Date.now() })
    .eq('id', invitationId).eq('status', 'pending').select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('O convite já foi respondido. Atualize a lista.');
}
