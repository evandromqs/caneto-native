import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../ui/theme';

export type SocialFriend = {
  id: string; name: string; username: string; avatarUrl?: string; online?: boolean;
  sharedListsCount?: number; status: 'accepted' | 'pending_received' | 'pending_sent';
};
export type SocialSearchResult = Pick<SocialFriend, 'id' | 'name' | 'username' | 'avatarUrl' | 'online'> &
  { relationship?: SocialFriend['status'] };
export type SocialInvitation = { id: string; listName: string; senderName: string; senderUsername: string };
export type AccessedList = { id: string; name: string; ownerName?: string; joinedAt?: number };
export type RankingPerson = { id: string; name: string; score: number; badge: string; isMe?: boolean; avatarUrl?: string; online?: boolean };
export type RankingSummary = {
  name: string; levelName: string; score: number; nextLevelScore: number;
  listsCreated: number; itemsInLists: number; purchases: number;
  achievements: { id: string; title: string; description: string; unlocked: boolean; progress: string }[];
  people: RankingPerson[];
};

export type SocialScreenProps = {
  friends: SocialFriend[];
  invitations?: SocialInvitation[];
  accessedLists?: AccessedList[];
  searchQuery?: string;
  searchResults?: SocialSearchResult[];
  searchLoading?: boolean;
  friendsLoading?: boolean;
  friendsError?: boolean;
  ranking?: RankingSummary;
  onSearchChange?: (value: string) => void;
  onSendRequest?: (user: SocialSearchResult) => void;
  onAcceptFriend?: (friend: SocialFriend) => void;
  onDeclineFriend?: (friend: SocialFriend) => void;
  onCancelRequest?: (friend: SocialFriend) => void;
  onOpenFriend?: (friend: SocialFriend) => void;
  onAcceptInvitation?: (invitation: SocialInvitation) => void;
  onDeclineInvitation?: (invitation: SocialInvitation) => void;
  onOpenList?: (listId: string) => void;
  onOpenJoin?: () => void;
  onRetryFriends?: () => void;
  onOpenRankingPerson?: (person: RankingPerson) => void;
};

function Avatar({ name, url, online, size = 44 }: { name: string; url?: string; online?: boolean; size?: number }) {
  const isImage = url?.startsWith('http') || url?.startsWith('data:');
  return <View style={{ width: size, height: size }}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {isImage ? <Image source={{ uri: url }} style={{ width: size, height: size }} /> :
        <Text style={styles.avatarText}>{url?.replace(/^emoji:/, '') || name.charAt(0).toUpperCase()}</Text>}
    </View>
    {online && <View style={styles.onlineDot} accessibilityLabel="Online agora" />}
  </View>;
}
function Action({ label, onPress, danger = false }: { label: string; onPress?: () => void; danger?: boolean }) {
  if (!onPress) return null;
  return <Pressable onPress={onPress} accessibilityRole="button"
    style={[styles.action, danger ? styles.actionDanger : styles.actionBlue]}>
    <Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text>
  </Pressable>;
}
function Section({ title, children, highlight = false }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return <View style={[styles.card, highlight && styles.highlightCard]}>
    <Text style={[styles.sectionTitle, highlight && styles.highlightTitle]}>{title}</Text>
    {children}
  </View>;
}

export function SocialScreen(props: SocialScreenProps) {
  const [tab, setTab] = useState<'friends' | 'rankings'>('friends');
  const [allFriendsOpen, setAllFriendsOpen] = useState(false);
  const accepted = props.friends.filter(friend => friend.status === 'accepted');
  const received = props.friends.filter(friend => friend.status === 'pending_received');
  const sent = props.friends.filter(friend => friend.status === 'pending_sent');
  const invitations = props.invitations ?? [];
  const accessed = props.accessedLists ?? [];
  const query = props.searchQuery?.trim() ?? '';
  const results = props.searchResults ?? [];
  const badge = received.length + invitations.length || accepted.length;

  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <Pressable onPress={() => setTab('friends')} style={[styles.segmentButton, tab === 'friends' && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'friends' }}>
            <Ionicons name="people-outline" size={18} color={tab === 'friends' ? '#FFFFFF' : theme.ink} />
            <Text style={[styles.segmentText, tab === 'friends' && styles.segmentTextActive]}>Amigos</Text>
            {badge > 0 && <View style={[styles.badge, tab === 'friends' && styles.badgeActive]}><Text style={[styles.badgeText, tab === 'friends' && styles.badgeTextActive]}>{badge}</Text></View>}
          </Pressable>
          <Pressable onPress={() => setTab('rankings')} style={[styles.segmentButton, tab === 'rankings' && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === 'rankings' }}>
            <Ionicons name="trophy-outline" size={18} color={tab === 'rankings' ? '#FFFFFF' : theme.ink} />
            <Text style={[styles.segmentText, tab === 'rankings' && styles.segmentTextActive]}>Rankings</Text>
          </Pressable>
        </View>
      </View>

      {props.onSearchChange && <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={19} color={theme.ink} />
        <TextInput style={styles.searchInput} value={props.searchQuery ?? ''}
          onChangeText={value => { props.onSearchChange?.(value); if (value.trim()) setTab('friends'); }}
          placeholder="Buscar amigos por @usuário ou nome..." placeholderTextColor={theme.muted}
          autoCapitalize="none" accessibilityLabel="Buscar amigos" />
        {query ? <Pressable onPress={() => props.onSearchChange?.('')} accessibilityLabel="Limpar busca"><Ionicons name="close" size={19} color={theme.ink} /></Pressable> : null}
      </View>}
      {query && <View style={styles.card}>
        {query.length < 2 ? <Text style={styles.emptyText}>Digite pelo menos 2 caracteres para pesquisar amigos...</Text> :
          props.searchLoading ? <View style={styles.loadingRow}><ActivityIndicator color={theme.blue} /><Text style={styles.blueText}>Buscando usuários...</Text></View> :
            results.length === 0 ? <Text style={styles.emptyText}>Nenhum perfil listado para “{query}”.</Text> : <>
              <Text style={styles.sectionTitle}>Resultados encontrados ({results.length})</Text>
              {results.map(user => <View key={user.id} style={styles.personRow}>
                <Avatar name={user.name} url={user.avatarUrl} online={user.online} size={40} />
                <View style={styles.personInfo}><Text style={styles.personName} numberOfLines={1}>{user.name}</Text><Text style={styles.personSub} numberOfLines={1}>@{user.username}</Text></View>
                {user.relationship === 'accepted' ? <Text style={styles.pill}>Amigo</Text> : user.relationship === 'pending_sent' ? <Text style={styles.pill}>Aguardando</Text> : user.relationship === 'pending_received' ? <Text style={styles.pill}>Solicitação recebida</Text> :
                  <Action label="Adicionar" onPress={props.onSendRequest ? () => props.onSendRequest?.(user) : undefined} />}
              </View>)}
            </>}
      </View>}

      {tab === 'friends' ? <>
        {invitations.length > 0 && <Section title={`Listas compartilhadas com você (${invitations.length})`} highlight>
          {invitations.map(invitation => <View key={invitation.id} style={styles.stackRow}>
            <View style={styles.personRow}><View style={styles.listIcon}><Ionicons name="cart-outline" size={20} color="#FFFFFF" /></View><View style={styles.personInfo}><Text style={styles.personName}>{invitation.listName}</Text><Text style={styles.personSub}>Por: {invitation.senderName} (@{invitation.senderUsername})</Text></View></View>
            <View style={styles.actions}><Action label="Abrir lista" onPress={props.onAcceptInvitation ? () => props.onAcceptInvitation?.(invitation) : undefined} /><Action label="Recusar" danger onPress={props.onDeclineInvitation ? () => props.onDeclineInvitation?.(invitation) : undefined} /></View>
          </View>)}
        </Section>}
        {received.length > 0 && <Section title={`Solicitações de amizade recebidas (${received.length})`} highlight>
          {received.map(friend => <View key={friend.id} style={styles.stackRow}>
            <View style={styles.personRow}><Avatar name={friend.name} url={friend.avatarUrl} size={40} /><View style={styles.personInfo}><Text style={styles.personName}>{friend.name}</Text><Text style={styles.personSub}>@{friend.username} · quer ser seu amigo</Text></View></View>
            <View style={styles.actions}><Action label="Aceitar" onPress={props.onAcceptFriend ? () => props.onAcceptFriend?.(friend) : undefined} /><Action label="Recusar" danger onPress={props.onDeclineFriend ? () => props.onDeclineFriend?.(friend) : undefined} /></View>
          </View>)}
        </Section>}
        {sent.length > 0 && <Section title={`Solicitações enviadas (${sent.length})`}>
          {sent.map(friend => <View key={friend.id} style={styles.personRow}><Avatar name={friend.name} url={friend.avatarUrl} size={34} /><View style={styles.personInfo}><Text style={styles.personName}>@{friend.username}</Text><Text style={styles.blueText}>Aguardando resposta...</Text></View><Action label="Cancelar" danger onPress={props.onCancelRequest ? () => props.onCancelRequest?.(friend) : undefined} /></View>)}
        </Section>}
        <Section title={`Meus amigos conectados (${accepted.length})`}>
          {props.friendsLoading ? <ActivityIndicator color={theme.blue} /> : accepted.length === 0 ?
            <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="people-outline" size={25} color={theme.blue} /></View>
              <Text style={styles.emptyTitle}>{props.friendsError ? 'Não foi possível carregar seus amigos.' : 'Nenhum amigo conectado ainda'}</Text>
              <Text style={styles.emptyText}>{props.friendsError ? 'Verifique sua conexão e tente novamente.' : 'Use a busca no topo para encontrar amigos e comprar juntos.'}</Text>
              {props.friendsError && props.onRetryFriends && <Pressable onPress={props.onRetryFriends}><Text style={styles.blueText}>Tentar novamente</Text></Pressable>}
            </View> : <>{accepted.slice(0, 4).map(friend => <Pressable key={friend.id} style={styles.personRow} onPress={props.onOpenFriend ? () => props.onOpenFriend?.(friend) : undefined} disabled={!props.onOpenFriend}>
              <Avatar name={friend.name} url={friend.avatarUrl} online={friend.online} /><View style={styles.personInfo}><Text style={styles.personName}>{friend.name}</Text><Text style={styles.personSub}>@{friend.username}{friend.sharedListsCount ? ` · ${friend.sharedListsCount} listas` : ''}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </Pressable>)}{accepted.length > 4 && <Pressable onPress={() => setAllFriendsOpen(true)}><Text style={styles.more}>Ver todos os amigos</Text></Pressable>}</>}
        </Section>
        <Section title={`Listas que acesso (${accessed.length})`}>
          {accessed.length === 0 ? <Text style={styles.emptyText}>As listas compartilhadas por outras pessoas aparecerão aqui.</Text> : accessed.map(list => <Pressable key={list.id} style={styles.personRow} onPress={props.onOpenList ? () => props.onOpenList?.(list.id) : undefined} disabled={!props.onOpenList}>
            <View style={styles.personInfo}><Text style={styles.personName}>{list.name}</Text><Text style={styles.personSub}>{list.ownerName ? `De ${list.ownerName}` : 'Lista compartilhada'}{list.joinedAt ? ` · Acesso em ${new Date(list.joinedAt).toLocaleDateString('pt-BR')}` : ''}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.blue} />
          </Pressable>)}
        </Section>
        {props.onOpenJoin && <Pressable style={styles.joinButton} onPress={props.onOpenJoin}><Ionicons name="qr-code-outline" size={18} color="#FFFFFF" /><Text style={styles.joinText}>Acessar outra lista</Text></Pressable>}
      </> : props.ranking ? <RankingContent ranking={props.ranking} onOpenPerson={props.onOpenRankingPerson} /> :
        <View style={styles.card}><Text style={styles.emptyTitle}>Classificação indisponível</Text><Text style={styles.emptyText}>Os dados de compras ainda não foram carregados.</Text></View>}
    </ScrollView>
    <Modal visible={allFriendsOpen} transparent animationType="fade" onRequestClose={() => setAllFriendsOpen(false)}>
      <Pressable style={styles.modalShade} onPress={() => setAllFriendsOpen(false)}><View style={styles.modalCard}>
        <Text style={styles.sectionTitle}>Todos os amigos</Text><ScrollView>{accepted.map(friend => <Pressable key={friend.id} style={styles.personRow} onPress={() => { setAllFriendsOpen(false); props.onOpenFriend?.(friend); }}><Avatar name={friend.name} url={friend.avatarUrl} online={friend.online} size={40} /><View style={styles.personInfo}><Text style={styles.personName}>{friend.name}</Text><Text style={styles.personSub}>@{friend.username}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.muted} /></Pressable>)}</ScrollView>
        <Pressable onPress={() => setAllFriendsOpen(false)}><Text style={styles.more}>Fechar</Text></Pressable>
      </View></Pressable>
    </Modal>
  </View>;
}

function RankingContent({ ranking, onOpenPerson }: { ranking: RankingSummary; onOpenPerson?: (person: RankingPerson) => void }) {
  const progress = ranking.nextLevelScore > 0 ? Math.min(100, 100 * ranking.score / ranking.nextLevelScore) : 0;
  return <>
    <View style={[styles.card, styles.highlightCard]}>
      <View style={styles.personRow}><View style={styles.listIcon}><Ionicons name="ribbon-outline" size={24} color="#FFFFFF" /></View><View style={styles.personInfo}><Text style={styles.personName}>{ranking.name}</Text><Text style={styles.blueText}>{ranking.levelName}</Text></View><Text style={styles.score}>{ranking.score} pts</Text></View>
      <Text style={styles.personSub}>Progresso para o próximo nível · {ranking.score} / {ranking.nextLevelScore} pts</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <View style={styles.statsRow}>{([['Listas criadas', ranking.listsCreated], ['Itens em listas', ranking.itemsInLists], ['Compras feitas', ranking.purchases]] as const).map(([label, value]) => <View key={label} style={styles.statMini}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
    </View>
    <Section title="Conquistas e emblemas reais">{ranking.achievements.length === 0 ? <Text style={styles.emptyText}>Nenhuma conquista disponível.</Text> : ranking.achievements.map(achievement => <View key={achievement.id} style={[styles.personRow, achievement.unlocked && styles.achievementUnlocked]}><Ionicons name="trophy-outline" size={23} color={achievement.unlocked ? theme.success : theme.muted} /><View style={styles.personInfo}><Text style={styles.personName}>{achievement.title}</Text><Text style={styles.personSub}>{achievement.description}</Text></View><Text style={styles.pill}>{achievement.unlocked ? 'Desbloqueado' : achievement.progress}</Text></View>)}</Section>
    <Section title="Classificação entre conexões">{ranking.people.map((person, index) => <Pressable key={person.id} style={[styles.personRow, person.isMe && styles.highlightCard]} onPress={onOpenPerson && !person.isMe ? () => onOpenPerson(person) : undefined} disabled={!onOpenPerson || person.isMe}><Text style={styles.rank}>{index + 1}º</Text><Avatar name={person.name} url={person.avatarUrl} online={person.online} size={36} /><View style={styles.personInfo}><Text style={styles.personName}>{person.name}</Text><Text style={styles.personSub}>{person.badge}</Text></View><Text style={styles.blueText}>{person.score} pts</Text></Pressable>)}{ranking.people.length <= 1 && <Text style={styles.emptyText}>Adicione amigos na aba Amigos para comparar compras.</Text>}</Section>
  </>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background }, content: { gap: 14, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 124 },
  segmentWrap: { alignItems: 'center' }, segment: { width: '100%', backgroundColor: '#E7E9ED', borderColor: theme.border, borderWidth: 1, borderRadius: 17, flexDirection: 'row', padding: 5, gap: 5 },
  segmentButton: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, segmentActive: { backgroundColor: theme.blue }, segmentText: { fontFamily: theme.font.bold, fontSize: 15, color: theme.ink }, segmentTextActive: { color: '#FFFFFF' },
  badge: { backgroundColor: '#DCE5F8', paddingHorizontal: 7, borderRadius: 20, minWidth: 22, alignItems: 'center' }, badgeActive: { backgroundColor: '#FFFFFF' }, badgeText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 11 }, badgeTextActive: { color: theme.blue },
  searchBar: { minHeight: 49, backgroundColor: '#E7E9ED', borderRadius: 16, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 }, searchInput: { flex: 1, fontFamily: theme.font.semibold, fontSize: 14, color: theme.ink, paddingVertical: 8 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 15, gap: 10 }, highlightCard: { backgroundColor: '#F0F4FF', borderColor: '#AEC4FC' }, sectionTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 }, highlightTitle: { color: theme.blue },
  personRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 13, borderWidth: 1, borderColor: theme.border, padding: 9 }, stackRow: { gap: 8 }, personInfo: { flex: 1, minWidth: 0 }, personName: { fontFamily: theme.font.bold, fontSize: 14, color: theme.ink }, personSub: { fontFamily: theme.font.regular, fontSize: 12, color: theme.muted }, blueText: { fontFamily: theme.font.semibold, fontSize: 12, color: theme.blue },
  avatar: { backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 18 }, onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: theme.success },
  listIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, action: { borderRadius: 10, paddingHorizontal: 11, minHeight: 33, alignItems: 'center', justifyContent: 'center' }, actionBlue: { backgroundColor: theme.blue }, actionDanger: { backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: '#FECACA' }, actionText: { fontFamily: theme.font.bold, fontSize: 12, color: '#FFFFFF' }, actionDangerText: { color: theme.danger },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 }, emptyIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { textAlign: 'center', fontFamily: theme.font.bold, fontSize: 14, color: theme.ink }, emptyText: { textAlign: 'center', fontFamily: theme.font.regular, fontSize: 13, color: theme.muted }, loadingRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 }, more: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13, textAlign: 'center', paddingVertical: 8 }, pill: { color: theme.blue, backgroundColor: theme.blueSoft, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, fontFamily: theme.font.bold, fontSize: 11 },
  joinButton: { alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: theme.blue, paddingHorizontal: 20, minHeight: 47, borderRadius: 30 }, joinText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },
  modalShade: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', padding: 18 }, modalCard: { maxHeight: '75%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 12 },
  score: { fontFamily: theme.font.bold, fontSize: 17, color: theme.ink }, progressTrack: { height: 10, borderRadius: 6, backgroundColor: theme.border, overflow: 'hidden' }, progressFill: { height: 10, borderRadius: 6, backgroundColor: theme.blue }, statsRow: { flexDirection: 'row', gap: 7 }, statMini: { flex: 1, borderRadius: 11, padding: 7, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.border }, statValue: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 }, statLabel: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 10, textAlign: 'center' }, achievementUnlocked: { backgroundColor: theme.successSoft, borderColor: '#A7F3D0' }, rank: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 15 },
});
