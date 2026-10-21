import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { listCapabilities } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { AppButton, AppText, IconButton, SurfaceCard } from '../../ui/primitives';
import { theme } from '../../ui/theme';
import { listMetrics, selectVisibleLists, type ListsSortBy, type ListsSubTab } from './selectors';
import { CreateListModal } from './CreateListModal';
import { getErrorMessage } from '../../ui/error';

type MaybePromise = void | Promise<void>;

export interface ListsOverviewProps {
  lists: readonly ShoppingList[];
  activeListId?: string;
  ownerNameById?: Readonly<Record<string, string>>;
  onSelectList: (list: ShoppingList) => MaybePromise;
  onCreateList: (name: string) => MaybePromise;
  onEditList: (list: ShoppingList) => MaybePromise;
  onShareList: (list: ShoppingList) => MaybePromise;
  onDuplicateList: (list: ShoppingList) => MaybePromise;
  onDeleteList: (list: ShoppingList) => MaybePromise;
  onReopenList: (list: ShoppingList) => MaybePromise;
  onRenameList?: (list: ShoppingList, name: string) => MaybePromise;
  onRefresh?: () => Promise<void>;
  onJoinList?: () => MaybePromise;
  onScanList?: () => MaybePromise;
}

const sortOptions: readonly { value: ListsSortBy; label: string }[] = [
  { value: 'recent', label: 'Recentes' }, { value: 'az', label: 'Nome (A-Z)' }, { value: 'items', label: 'Qtd Itens' },
];

export function ListsOverview(props: ListsOverviewProps) {
  const [tab, setTab] = useState<ListsSubTab>('active');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ListsSortBy>('recent');
  const [filterOpen, setFilterOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionList, setActionList] = useState<ShoppingList | null>(null);
  const visibleLists = useMemo(() => selectVisibleLists(props.lists, tab, search, sortBy, props.ownerNameById), [props.lists, tab, search, sortBy, props.ownerNameById]);
  const activeCount = props.lists.filter(list => !list.isCompleted).length;
  const completedCount = props.lists.length - activeCount;

  const execute = async (operation: () => MaybePromise) => {
    try { await operation(); } catch (error) { Alert.alert('Não foi possível concluir', getErrorMessage(error)); }
  };
  const confirmDelete = (list: ShoppingList) => Alert.alert('Excluir lista?', `A lista “${list.name}” e seus itens serão removidos.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => void execute(() => props.onDeleteList(list)) },
  ]);

  return <View style={styles.root}>
    <FlatList
      data={visibleLists}
      keyExtractor={item => item.id}
      refreshing={refreshing}
      onRefresh={props.onRefresh ? async () => {
        setRefreshing(true);
        try { await props.onRefresh?.(); }
        catch (error) { Alert.alert('Não foi possível atualizar', getErrorMessage(error)); }
        finally { setRefreshing(false); }
      } : undefined}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={[0]}
      ListHeaderComponent={<View style={styles.top}>
        <View style={styles.tabBar} accessibilityRole="tablist">
          <StatusTab label="Em Aberto" count={activeCount} active={tab === 'active'} onPress={() => setTab('active')} />
          <StatusTab label="Finalizadas" count={completedCount} active={tab === 'completed'} onPress={() => setTab('completed')} />
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.ink} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Buscar listas por nome, loja ou produto..." placeholderTextColor={theme.placeholder} accessibilityLabel="Buscar listas" style={styles.searchInput} returnKeyType="search" />
          {!!search && <IconButton label="Limpar busca" onPress={() => setSearch('')} icon={<Ionicons name="close" size={19} color={theme.ink} />} />}
          <IconButton label="Filtrar listas" onPress={() => setFilterOpen(true)} icon={<Ionicons name="options-outline" size={20} color={sortBy === 'recent' ? theme.ink : theme.blue} />} />
        </View>
      </View>}
      ListEmptyComponent={<EmptyState tab={tab} search={search} filtered={sortBy !== 'recent'} onClearSearch={() => setSearch('')} onClearSort={() => setSortBy('recent')} />}
      renderItem={({ item }) => <ListCard list={item} ownerName={props.ownerNameById?.[item.ownerId]} active={item.id === props.activeListId} onPress={() => void execute(() => props.onSelectList(item))} onOptions={() => setActionList(item)} />}
    />
    <View style={styles.floating} pointerEvents="box-none">
      <AppButton label="Nova lista" icon={<Ionicons name="add" size={21} color={theme.surface} />} onPress={() => setCreating(true)} style={styles.newList} />
    </View>
    <ModalSheet visible={filterOpen} title="Filtrar Listas" onClose={() => setFilterOpen(false)}>
      <AppText style={styles.modalLabel}>Ordenar por</AppText>
      <View style={styles.sortRow}>{sortOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: sortBy === option.value }} onPress={() => setSortBy(option.value)} style={[styles.sortButton, sortBy === option.value && styles.sortActive]}><AppText style={[styles.sortText, sortBy === option.value && styles.sortTextActive]}>{option.label}</AppText></Pressable>)}</View>
      <View style={styles.filterActions}><AppButton label="Limpar filtros" variant="ghost" onPress={() => setSortBy('recent')} style={styles.filterButton} /><AppButton label="Aplicar" onPress={() => setFilterOpen(false)} style={styles.filterButton} /></View>
    </ModalSheet>
    <ModalSheet visible={!!actionList} title="Opções da lista" subtitle={actionList?.name} onClose={() => setActionList(null)}>
      {!!actionList && <ActionRows list={actionList} onClose={() => setActionList(null)} props={props} execute={execute} confirmDelete={confirmDelete} />}
    </ModalSheet>
    <CreateListModal visible={creating} listCount={props.lists.length} onClose={() => setCreating(false)} onCreate={props.onCreateList} onJoinList={props.onJoinList} onScanList={props.onScanList} />
  </View>;
}

function StatusTab({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityLabel={`${label}, ${count} listas`} accessibilityState={{ selected: active }} style={[styles.tab, active && styles.tabActive]}><AppText style={[styles.tabText, active && styles.tabTextActive]}>{label}</AppText>{count > 0 && <AppText style={[styles.tabCount, active && styles.tabTextActive]}>{count}</AppText>}</Pressable>;
}

function ListCard({ list, ownerName, active, onPress, onOptions }: { list: ShoppingList; ownerName?: string; active: boolean; onPress: () => void; onOptions: () => void }) {
  const { totalItems, checkedItems, progress, estimatedTotal } = listMetrics(list);
  const accessed = list.permission !== 'owner';
  const store = list.storeName?.split(/\s+[-–—]\s+|\s*,\s*/)[0].trim();
  const date = new Date(list.updatedAt || list.createdAt).toLocaleDateString('pt-BR');
  const total = list.isCompleted && list.totalSpent !== undefined ? list.totalSpent : estimatedTotal;
  const paymentLabel = list.paymentMethod ? list.paymentMethod.charAt(0).toUpperCase() + list.paymentMethod.slice(1) : '';
  return <SurfaceCard style={StyleSheet.flatten([styles.card, list.isCompleted && styles.completedCard, active && styles.activeCard])}>
    <View style={styles.cardTop}>
      <Pressable style={styles.cardMain} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir lista ${list.name}`}>
        <View style={styles.cardIcon}><Ionicons name={accessed ? 'link-outline' : list.icon === 'Flame' ? 'flame-outline' : 'cart-outline'} size={20} color={accessed ? theme.blue : theme.muted} /></View>
        <View style={styles.cardHeading}>
          <AppText numberOfLines={1} style={styles.cardTitle}>{list.name}</AppText>
          <View style={styles.metadata}><Ionicons name={store ? 'storefront-outline' : 'location-outline'} size={14} color={store ? theme.blue : theme.subtle} /><AppText numberOfLines={1} style={[styles.metadataText, !!store && styles.storeText]}>{store || 'Sem local'}</AppText></View>
          <View style={styles.metadata}><Ionicons name="calendar-outline" size={13} color={theme.subtle} /><AppText tone="caption" style={styles.date}>{date}</AppText></View>
        </View>
      </Pressable>
      <IconButton label={`Opções da lista ${list.name}`} onPress={onOptions} icon={<Ionicons name="ellipsis-vertical" size={20} color={theme.ink} />} />
    </View>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${list.name}, ${checkedItems} de ${totalItems} itens comprados`}>
      <View style={styles.metrics}><AppText style={styles.metricText}>{checkedItems} de {totalItems} itens comprados</AppText><AppText style={styles.percent}>{progress}%</AppText></View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <View style={styles.cardBottom}>
        {total > 0 ? <AppText style={styles.totalLabel}>{list.isCompleted ? 'Total Pago: ' : 'Previsto: '}<AppText style={styles.totalValue}>R$ {total.toFixed(2)}</AppText></AppText> : <View />}
        {list.isCompleted && <View style={styles.finishedPill}><Ionicons name="checkmark-circle" size={15} color={theme.success} /><AppText style={styles.finishedText}>Finalizada{paymentLabel ? ` · ${paymentLabel}` : ''}</AppText>{!!list.receiptPhotoUrl && <Ionicons name="receipt-outline" size={13} color={theme.success} />}{!!list.receiptQrCode && <Ionicons name="qr-code-outline" size={13} color={theme.success} />}</View>}
      </View>
      {accessed && <View style={styles.ownerRow}><Ionicons name="link-outline" size={13} color={theme.blue} /><AppText tone="caption">Criado por <AppText style={styles.ownerName}>{ownerName || 'outro usuário'}</AppText></AppText></View>}
    </Pressable>
  </SurfaceCard>;
}

function EmptyState({ tab, search, filtered, onClearSearch, onClearSort }: { tab: ListsSubTab; search: string; filtered: boolean; onClearSearch: () => void; onClearSort: () => void }) {
  const querying = !!search.trim();
  return <SurfaceCard style={styles.empty}>
    <View style={styles.emptyIcon}><Ionicons name={querying ? 'search' : tab === 'completed' ? 'checkmark-circle-outline' : 'cart-outline'} size={27} color={theme.blue} /></View>
    <AppText style={styles.emptyTitle}>{querying ? `Nenhuma lista encontrada para “${search}”` : tab === 'active' ? 'Nenhuma lista em aberto' : 'Nenhuma compra concluída ainda'}</AppText>
    <AppText tone="muted" style={styles.emptyDescription}>{querying ? 'Tente buscar por outro termo ou nome de produto contido na lista.' : filtered ? 'Você tem filtros ativos. Tente redefinir a ordenação das listas.' : tab === 'active' ? 'Crie uma nova lista ou reabra uma lista anterior para começar suas compras.' : 'Quando você finalizar uma lista de compras, ela será arquivada aqui com o valor pago e recibos.'}</AppText>
    {querying && <AppButton label="Limpar busca" variant="secondary" onPress={onClearSearch} style={styles.emptyAction} />}
    {filtered && <AppButton label="Redefinir filtros" variant="secondary" onPress={onClearSort} style={styles.emptyAction} />}
  </SurfaceCard>;
}

function ActionRows({ list, onClose, props, execute, confirmDelete }: { list: ShoppingList; onClose: () => void; props: ListsOverviewProps; execute: (operation: () => MaybePromise) => Promise<void>; confirmDelete: (list: ShoppingList) => void }) {
  const capabilities = listCapabilities(list);
  const action = (label: string, icon: keyof typeof Ionicons.glyphMap, callback: () => MaybePromise, danger = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} style={styles.actionRow} onPress={() => { onClose(); void execute(callback); }}><Ionicons name={icon} size={20} color={danger ? theme.danger : theme.blue} /><AppText style={[styles.actionText, danger && styles.dangerText]}>{label}</AppText><Ionicons name="chevron-forward" size={17} color={theme.subtle} /></Pressable>;
  return <View>
    {capabilities.editList && action('Editar lista', 'create-outline', () => props.onEditList(list))}
    {list.isCompleted && capabilities.completeList && action('Reabrir lista', 'refresh-outline', () => props.onReopenList(list))}
    {capabilities.manageMembers && action('Compartilhar', 'share-social-outline', () => props.onShareList(list))}
    {action('Duplicar', 'copy-outline', () => props.onDuplicateList(list))}
    {capabilities.deleteList && <Pressable accessibilityRole="button" accessibilityLabel="Excluir lista" style={styles.actionRow} onPress={() => { onClose(); confirmDelete(list); }}><Ionicons name="trash-outline" size={20} color={theme.danger} /><AppText style={[styles.actionText, styles.dangerText]}>Excluir lista</AppText><Ionicons name="chevron-forward" size={17} color={theme.subtle} /></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 112 },
  top: { paddingBottom: 13, paddingTop: 8, gap: 12, backgroundColor: theme.background, borderRadius: 16 },
  tabBar: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#E9EDF3', borderRadius: 14, padding: 4, gap: 4 },
  tab: { minHeight: theme.touchTarget, paddingHorizontal: 13, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  tabActive: { backgroundColor: theme.blue },
  tabText: { fontFamily: theme.font.semibold, color: theme.muted, fontSize: 15 }, tabTextActive: { color: theme.surface }, tabCount: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 14, paddingHorizontal: 6, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.20)' },
  searchBar: { minHeight: 48, backgroundColor: '#E9EDF3', borderWidth: 1, borderColor: '#D9E1EA', borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 1 },
  searchInput: { flex: 1, minWidth: 0, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 16, paddingHorizontal: 10, paddingVertical: 9 },
  card: { borderRadius: 18, marginBottom: 12, padding: 16, elevation: 1, shadowColor: theme.ink, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, completedCard: { backgroundColor: '#EFF6FF', borderColor: '#A8D1FC' }, activeCard: { borderColor: theme.blue },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' }, cardMain: { flex: 1, flexDirection: 'row', minHeight: 62 }, cardIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, cardHeading: { flex: 1, minWidth: 0 }, cardTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 },
  metadata: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }, metadataText: { flex: 1, color: theme.subtle, fontFamily: theme.font.semibold, fontSize: 14 }, storeText: { color: theme.blue }, date: { color: theme.subtle },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, metricText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14 }, percent: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: theme.border, marginTop: 6, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 4, backgroundColor: theme.blue },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 11 }, totalLabel: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14 }, totalValue: { color: theme.blue, fontFamily: theme.font.bold },
  finishedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: '#D1FAE5', borderRadius: 20 }, finishedText: { color: theme.success, fontFamily: theme.font.bold, fontSize: 13 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }, ownerName: { color: theme.ink, fontFamily: theme.font.bold },
  empty: { alignItems: 'center', padding: 28, marginTop: 20 }, emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16, textAlign: 'center' }, emptyDescription: { textAlign: 'center', marginTop: 6 }, emptyAction: { marginTop: 10 },
  floating: { position: 'absolute', bottom: 92, alignSelf: 'center' }, newList: { borderRadius: 28, paddingHorizontal: 20, elevation: 6 },
  modalLabel: { fontFamily: theme.font.bold, marginBottom: 10 }, sortRow: { flexDirection: 'row', gap: 7 }, sortButton: { flex: 1, minHeight: 48, backgroundColor: theme.surfaceMuted, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, sortActive: { backgroundColor: theme.blue }, sortText: { fontFamily: theme.font.bold, fontSize: 13, textAlign: 'center' }, sortTextActive: { color: theme.surface }, filterActions: { borderTopWidth: 1, borderColor: theme.border, flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 16 }, filterButton: { flex: 1 },
  actionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: theme.border }, actionText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold }, dangerText: { color: theme.danger },
});
