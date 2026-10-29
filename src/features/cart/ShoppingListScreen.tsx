import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem, ShoppingList } from '../../core/models/caneto';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { AppText } from '../../ui/primitives';
import { createThemedStyles, theme } from '../../ui/theme';
import { UndoDeleteToast } from '../../ui/UndoDeleteToast';
import { getErrorMessage } from '../../ui/error';
import { CATEGORIES, categoryFor, parseQuickItemInput } from '../../core/categories';
import { searchProductSuggestions, type ProductSuggestion } from '../products/search';
import { useKeepScreenAwake } from '../../core/device/keepAwake';
import { triggerHaptic } from '../../core/device/haptics';
import { playSound } from '../../core/device/sounds';
import type { CheckboxStyle } from '../../core/checkboxStyles';

const suggestions = ['Leite', 'Pão Francês', 'Café', 'Ovos', 'Banana', 'Arroz', 'Feijão', 'Detergente', 'Açúcar', 'Manteiga'];
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
type Row = { kind: 'item'; item: ShoppingItem } | { kind: 'cart'; count: number } | { kind: 'category'; id: string; items: ShoppingItem[] };

type Props = {
  list: ShoppingList;
  busy?: boolean;
  onBack: () => void;
  onOptions: () => void;
  onSelectStore: () => void;
  onToggle: (item: ShoppingItem) => void | Promise<void>;
  onEdit: (item: ShoppingItem) => void;
  onAdd: (name: string) => void | Promise<void>;
  onAddProduct?: (product: ProductSuggestion) => void | Promise<void>;
  onScan?: () => void;
  onRefresh: () => Promise<void>;
  showCategoryHeaders?: boolean;
  sortByCategory?: boolean;
  onReopen?: () => void | Promise<void>;
  trashCount?: number;
  onOpenTrash?: () => void;
  deletedToastItem?: ShoppingItem | null;
  onUndoDelete?: (item: ShoppingItem) => void;
  onDismissDeleteToast?: (item: ShoppingItem) => void;
  onOpenBatchImport?: () => void;
  onUncheckAll?: () => void | Promise<void>;
  onClearPurchased?: () => void | Promise<void>;
  checkboxStyle?: CheckboxStyle;
  vibrationEnabled?: boolean;
  soundEffectsEnabled?: boolean;
  keepScreenAwakeEnabled?: boolean;
};

export function ShoppingListScreen({
  list,
  busy,
  onBack,
  onOptions,
  onSelectStore,
  onToggle,
  onEdit,
  onAdd,
  onAddProduct,
  onScan,
  onRefresh,
  showCategoryHeaders = false,
  sortByCategory = false,
  onReopen,
  trashCount,
  onOpenTrash,
  deletedToastItem,
  onUndoDelete,
  onDismissDeleteToast,
  onOpenBatchImport,
  onUncheckAll,
  onClearPurchased,
  checkboxStyle = 'circle',
  vibrationEnabled = true,
  soundEffectsEnabled = true,
  keepScreenAwakeEnabled = true,
}: Props) {
  const insets = useSafeAreaInsets();
  useKeepScreenAwake(keepScreenAwakeEnabled && !list.isCompleted);

  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestion[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [receiptExpanded, setReceiptExpanded] = useState(false);
  const readOnly = list.isCompleted || list.permission === 'viewer';

  useEffect(() => {
    const term = parseQuickItemInput(newItem).name.trim();
    if (term.length < 2 || !onAddProduct) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingProducts(true);
      void searchProductSuggestions(term, controller.signal)
        .then(setProductSuggestions)
        .catch(() => { if (!controller.signal.aborted) setProductSuggestions([]); })
        .finally(() => { if (!controller.signal.aborted) setSearchingProducts(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [newItem, onAddProduct]);

  const matching = useMemo(() => list.items.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), [list.items, search]);
  const pending = matching.filter(item => !item.checked);
  const purchased = matching.filter(item => item.checked).sort((a, b) => (b.checkedAt ?? b.createdAt) - (a.checkedAt ?? a.createdAt));

  const pendingRows: Row[] = showCategoryHeaders ? (() => {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of pending) {
      const id = CATEGORIES[item.categoryId] ? item.categoryId : 'outros';
      const group = groups.get(id) ?? [];
      group.push(item);
      groups.set(id, group);
    }
    const entries = [...groups.entries()];
    if (sortByCategory) entries.sort(([a], [b]) => categoryFor(a).order - categoryFor(b).order);
    return entries.flatMap(([id, items]): Row[] => [{ kind: 'category', id, items }, ...(collapsedCategories[id] ? [] : items.map(item => ({ kind: 'item' as const, item }))) ]);
  })() : pending.map(item => ({ kind: 'item' as const, item }));

  const rows: Row[] = [...pendingRows, ...(purchased.length ? [{ kind: 'cart' as const, count: purchased.length }, ...(cartExpanded ? purchased.map(item => ({ kind: 'item' as const, item })) : [])] : [])];
  const estimatedTotal = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const referenceTotal = list.detectedItemsTotal ?? estimatedTotal;
  const pendingReceipt = list.isCompleted && (list.pendingReceipt || (!list.receiptPhotoUrl && !list.receiptQrCode && !list.receiptKey));
  const totalDifference = list.totalSpent !== undefined && Math.abs(list.totalSpent - referenceTotal) >= 0.01;

  const add = (name = newItem) => {
    const clean = name.trim();
    if (!clean || busy) return;
    void Promise.resolve(onAdd(clean)).then(() => {
      setNewItem('');
      void playSound('add', soundEffectsEnabled);
      void triggerHaptic('light', vibrationEnabled);
    }).catch(() => {});
  };

  const handleToggle = async (item: ShoppingItem) => {
    void triggerHaptic('selection', vibrationEnabled);
    void playSound(item.checked ? 'uncheck' : 'check', soundEffectsEnabled);
    await onToggle(item);
  };

  const handleUncheckAll = () => {
    if (!onUncheckAll || purchased.length === 0) return;
    Alert.alert(
      'Desmarcar todos',
      'Deseja desmarcar todos os itens comprados desta lista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desmarcar todos',
          onPress: () => {
            void triggerHaptic('medium', vibrationEnabled);
            void onUncheckAll();
          },
        },
      ]
    );
  };

  const handleClearPurchased = () => {
    if (!onClearPurchased || purchased.length === 0) return;
    Alert.alert(
      'Limpar comprados',
      `Deseja mover ${purchased.length} item(ns) comprados para a lixeira?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Mover para lixeira',
          style: 'destructive',
          onPress: () => {
            void triggerHaptic('warning', vibrationEnabled);
            void onClearPurchased();
          },
        },
      ]
    );
  };

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {deletedToastItem && onUndoDelete && onDismissDeleteToast && (
      <UndoDeleteToast
        item={deletedToastItem}
        onUndo={onUndoDelete}
        onDismiss={onDismissDeleteToast}
      />
    )}
    <View style={styles.actions}>
      <Pressable style={styles.round} onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar para listas"><Ionicons name="arrow-back" size={22} color={theme.blue} /></Pressable>
      <View style={styles.flex} />
      {onOpenBatchImport && !readOnly && (
        <Pressable
          style={styles.round}
          onPress={onOpenBatchImport}
          accessibilityRole="button"
          accessibilityLabel="Colar lista completa"
        >
          <Ionicons name="clipboard-outline" size={20} color={theme.blue} />
        </Pressable>
      )}
      {list.permission === 'owner' && <Pressable style={styles.round} onPress={onSelectStore} accessibilityRole="button" accessibilityLabel="Selecionar local da lista"><CanetoIcon name="store" size={21} color={theme.blue} /></Pressable>}
      {onOpenTrash && !list.isCompleted && list.permission !== 'viewer' && (
        <Pressable
          style={styles.round}
          onPress={onOpenTrash}
          accessibilityRole="button"
          accessibilityLabel={`Lixeira da lista${trashCount ? `, ${trashCount} itens` : ''}`}
        >
          <Ionicons name="trash-outline" size={20} color={theme.blue} />
          {!!trashCount && trashCount > 0 && (
            <View style={styles.trashBadge}>
              <Text style={styles.trashBadgeText}>{trashCount > 9 ? '9+' : String(trashCount)}</Text>
            </View>
          )}
        </Pressable>
      )}
      <Pressable style={styles.round} onPress={onOptions} accessibilityRole="button" accessibilityLabel="Opções da lista"><Ionicons name="ellipsis-vertical" size={21} color={theme.blue} /></Pressable>
    </View>
    <Pressable style={styles.storeHeader} onPress={list.permission === 'owner' ? onSelectStore : undefined} accessibilityRole="button" accessibilityLabel={list.storeName ? `Local vinculado: ${list.storeName}` : 'Vincular local à lista'}>
      <CanetoIcon name="store" size={19} color={theme.blue} />
      <Text style={styles.storeHeaderText} numberOfLines={1}>{list.storeName || 'Vincular local'}</Text>
      {list.permission === 'owner' && <Ionicons name="chevron-down" size={17} color={theme.blue} />}
    </Pressable>

    <FlatList
      data={rows}
      keyExtractor={row => row.kind === 'cart' ? 'cart-heading' : row.kind === 'category' ? `category-${row.id}` : row.item.id}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } catch (error) { Alert.alert('Não foi possível atualizar', getErrorMessage(error)); } finally { setRefreshing(false); } }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<>
        {!list.isCompleted && <View style={styles.search}><Ionicons name="search-outline" size={18} color={theme.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Filtrar itens na lista..." placeholderTextColor={theme.muted} style={styles.searchInput} accessibilityLabel="Filtrar itens na lista" />{!!search && <Pressable onPress={() => setSearch('')} accessibilityLabel="Limpar filtro"><Ionicons name="close" size={18} color={theme.muted} /></Pressable>}</View>}
        {list.isCompleted && <View style={styles.completed}>
          <View style={styles.completedTitleRow}><AppText style={styles.completedTitle}>{list.name}</AppText>{!!onReopen && <Pressable accessibilityRole="button" accessibilityLabel="Reabrir lista" style={styles.reopen} onPress={() => void onReopen()}><Ionicons name="refresh-outline" size={16} color={theme.blue} /><AppText style={styles.reopenText}>Reabrir</AppText></Pressable>}</View>
          <AppText tone="caption">{list.storeName || 'Sem local informado'} · {list.completedAt ? new Date(list.completedAt).toLocaleDateString('pt-BR') : 'Data não informada'}</AppText>
          <View style={styles.completedTotals}>
            <View><AppText tone="caption">Itens</AppText><AppText style={styles.completedMetric}>{list.items.filter(item => item.checked).length}/{list.items.length}</AppText></View>
            <View><AppText tone="caption">Pagamento</AppText><AppText style={styles.completedMetric}>{list.paymentMethod ? list.paymentMethod.charAt(0).toUpperCase() + list.paymentMethod.slice(1) : 'Não informado'}</AppText></View>
            <View style={styles.completedTotal}><AppText tone="caption">Total pago</AppText><AppText style={styles.price}>{currency(list.totalSpent ?? referenceTotal)}</AppText></View>
          </View>
        </View>}
        {pendingReceipt && <View style={styles.pendingReceipt}><Ionicons name="alert-circle-outline" size={24} color={theme.warning} /><View style={styles.flex}><AppText style={styles.pendingTitle}>Nota fiscal pendente</AppText><AppText tone="caption">{totalDifference ? `O total pago (${currency(list.totalSpent ?? 0)}) difere da lista (${currency(referenceTotal)}). Anexe a nota para validar.` : 'Anexe a nota fiscal ou escaneie o recibo para completar a compra.'}</AppText></View></View>}
        {list.isCompleted && !!(list.receiptPhotoUrl || list.receiptQrCode) && <View style={styles.receipt}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: receiptExpanded }} accessibilityLabel="Nota fiscal" onPress={() => setReceiptExpanded(value => !value)} style={styles.receiptHeader}><View style={styles.receiptTitleRow}><Ionicons name="receipt-outline" size={19} color={theme.blue} /><AppText style={styles.receiptTitle}>Nota fiscal</AppText></View><AppText tone="caption">{list.completedAt ? new Date(list.completedAt).toLocaleDateString('pt-BR') : 'Ver comprovante'}</AppText><Ionicons name={receiptExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} /></Pressable>
          {receiptExpanded && <View style={styles.receiptBody}>{!!list.receiptPhotoUrl && <Image source={{ uri: list.receiptPhotoUrl }} style={styles.receiptImage} resizeMode="contain" accessibilityLabel="Foto da nota fiscal" />}{!!list.receiptQrCode && <AppText tone="caption" selectable>QR da nota: {list.receiptQrCode}</AppText>}</View>}
        </View>}
        {!list.isCompleted && (
          <View style={styles.marketBar}>
            <View style={styles.marketBarCounts}>
              <Text style={styles.marketCountText}>
                <Text style={styles.boldText}>{pending.length}</Text> pendentes · <Text style={styles.boldText}>{purchased.length}</Text> comprados
              </Text>
            </View>
            {!readOnly && (
              <View style={styles.marketBarActions}>
                {purchased.length > 0 && !!onUncheckAll && (
                  <Pressable style={styles.marketPill} onPress={handleUncheckAll} accessibilityLabel="Desmarcar todos">
                    <Ionicons name="refresh-outline" size={13} color={theme.blue} />
                    <Text style={styles.marketPillText}>Desmarcar</Text>
                  </Pressable>
                )}
                {purchased.length > 0 && !!onClearPurchased && (
                  <Pressable style={[styles.marketPill, styles.marketPillDanger]} onPress={handleClearPurchased} accessibilityLabel="Limpar comprados">
                    <Ionicons name="trash-outline" size={13} color={theme.danger} />
                    <Text style={[styles.marketPillText, styles.marketPillDangerText]}>Limpar</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="bag-handle-outline" size={25} color={theme.blue} /></View><AppText style={styles.emptyTitle}>{list.items.length ? 'Nenhum item encontrado' : list.isCompleted ? 'Nenhum item nesta lista finalizada' : 'Sua lista está vazia'}</AppText><AppText style={styles.emptyDescription}>{list.items.length ? 'Tente outro termo de busca.' : list.isCompleted ? 'Esta compra foi arquivada sem itens.' : 'Digite itens no rodapé, cole uma lista ou toque nas sugestões:'}</AppText>{!readOnly && !list.items.length && <View style={styles.suggestions}>{suggestions.map(suggestion => <Pressable key={suggestion} style={styles.suggestion} onPress={() => add(suggestion)}><Ionicons name="add-circle-outline" size={14} color={theme.blue} /><AppText style={styles.suggestionText}>{suggestion}</AppText></Pressable>)}</View>}</View>}
      renderItem={({ item }) => item.kind === 'cart'
        ? <Pressable style={styles.cartHeading} onPress={() => setCartExpanded(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: cartExpanded }}><View style={styles.cartLabel}><CanetoIcon name="cart" size={20} color={theme.blueLight} /><AppText style={styles.cartTitle}>No carrinho ({item.count})</AppText></View><AppText style={styles.expand}>{cartExpanded ? 'Recolher' : 'Expandir'}</AppText></Pressable>
        : item.kind === 'category' ? <CategoryHeader id={item.id} items={item.items} collapsed={!!collapsedCategories[item.id]} onToggle={() => setCollapsedCategories(current => ({ ...current, [item.id]: !current[item.id] }))} />
        : <ItemCard
            item={item.item}
            readOnly={readOnly}
            showCategoryBadge={!showCategoryHeaders}
            checkboxStyle={checkboxStyle}
            onToggle={() => void handleToggle(item.item)}
            onEdit={() => onEdit(item.item)}
          />}
    />
    {!readOnly && !!newItem.trim() && !!onAddProduct && (searchingProducts || productSuggestions.length > 0) && <View style={styles.predictions}>
      <Text style={styles.predictionsTitle}>Resultados com foto {searchingProducts ? '· buscando...' : ''}</Text>
      {productSuggestions.map(product => <Pressable key={`${product.ean || product.name}`} style={styles.prediction} onPress={() => {
        void Promise.resolve(onAddProduct(product)).then(() => {
          setNewItem('');
          setProductSuggestions([]);
          void playSound('add', soundEffectsEnabled);
          void triggerHaptic('light', vibrationEnabled);
        }).catch(() => undefined);
      }} accessibilityRole="button" accessibilityLabel={`Adicionar ${product.name}`}>
        {product.image ? <Image source={{ uri: product.image }} style={styles.predictionImage} /> : <View style={styles.predictionImageFallback}><CanetoIcon name={product.categoryId} size={20} color={theme.blue} /></View>}
        <View style={styles.flex}><Text style={styles.predictionName} numberOfLines={1}>{product.name}</Text><Text style={styles.predictionBrand} numberOfLines={1}>{product.brand || 'Open Food Facts'}</Text></View>
        <Ionicons name="add-circle" size={22} color={theme.blue} />
      </Pressable>)}
    </View>}
    {!readOnly && <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{!!onScan && <Pressable style={styles.scanButton} onPress={onScan} accessibilityLabel="Ler código, produto ou nota"><Ionicons name="scan-outline" size={22} color={theme.blue} /></Pressable>}<TextInput style={styles.composerInput} value={newItem} onChangeText={value => { setNewItem(value); setProductSuggestions([]); }} placeholder="Adicionar produto (ex: 2kg de maçã)" placeholderTextColor={theme.muted} onSubmitEditing={() => add()} returnKeyType="done" /><Pressable style={styles.addButton} onPress={() => add()} disabled={!newItem.trim() || busy} accessibilityLabel="Adicionar produto"><CanetoIcon name="plus" size={22} color="white" /></Pressable></View>}
  </KeyboardAvoidingView>;
}

function CategoryHeader({ id, items, collapsed, onToggle }: { id: string; items: ShoppingItem[]; collapsed: boolean; onToggle: () => void }) {
  const category = categoryFor(id);
  const subtotal = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  return <Pressable style={styles.categoryHeader} onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} accessibilityLabel={`${category.name}, ${items.length} itens`}>
    <View style={[styles.categoryIcon, { backgroundColor: category.background }]}><CanetoIcon name={id} size={15} color={category.color} /></View>
    <AppText numberOfLines={1} style={styles.categoryName}>{category.name}</AppText>
    <AppText style={styles.categoryCount}>{items.length}</AppText>
    <View style={styles.flex} />
    {subtotal > 0 && <AppText style={styles.categoryTotal}>{currency(subtotal)}</AppText>}
    <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={theme.ink} />
  </Pressable>;
}

function ItemCard({
  item,
  readOnly,
  showCategoryBadge,
  checkboxStyle = 'circle',
  onToggle,
  onEdit,
}: {
  item: ShoppingItem;
  readOnly: boolean;
  showCategoryBadge: boolean;
  checkboxStyle?: CheckboxStyle;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const category = categoryFor(item.categoryId);
  const total = item.price == null ? null : item.price * item.quantity;

  return <Pressable style={[styles.item, item.checked && styles.itemChecked]} onPress={readOnly ? undefined : onEdit} accessibilityRole="button" accessibilityLabel={readOnly ? item.name : `Editar ${item.name}`}>
    <View style={styles.itemTop}>
      <View style={styles.thumbnail}>{item.photoUrl && !photoFailed ? <Image source={{ uri: item.photoUrl }} style={styles.photo} onError={() => setPhotoFailed(true)} /> : <CanetoIcon name={item.categoryId} size={24} color={theme.ink} />}</View>
      <View style={styles.flex} />
      {checkboxStyle === 'switch' ? (
        <Pressable
          style={[styles.switchTrack, item.checked && styles.switchTrackChecked]}
          onPress={readOnly ? undefined : event => { event.stopPropagation(); onToggle(); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: item.checked, disabled: readOnly }}
          accessibilityLabel={`${item.checked ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        >
          <View style={[styles.switchThumb, item.checked && styles.switchThumbChecked]} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.checkbox, item.checked && styles.checkboxChecked]}
          onPress={readOnly ? undefined : event => { event.stopPropagation(); onToggle(); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked, disabled: readOnly }}
          accessibilityLabel={`${item.checked ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        >
          {item.checked && <Ionicons name="checkmark" size={18} color="white" />}
        </Pressable>
      )}
    </View>
    <AppText style={[styles.itemName, item.checked && styles.strike]}>{item.name}</AppText>
    {showCategoryBadge && <View style={[styles.categoryBadge, { backgroundColor: category.background }]}><CanetoIcon name={item.categoryId} size={12} color={category.color} /><AppText style={[styles.categoryBadgeText, { color: category.color }]}>{category.name}</AppText></View>}
    {!!item.notes && <AppText style={styles.notes} numberOfLines={1}>{item.notes}</AppText>}
    <View style={styles.itemBottom}><View style={styles.quantityRow}><AppText style={styles.quantity}>{item.quantity} {item.unit}{item.price != null ? ` × ${currency(item.price)}` : ''}</AppText>{!!item.labelPhotoUrl && <Pressable accessibilityRole="button" accessibilityLabel={`Ver etiqueta de ${item.name}`} onPress={event => { event.stopPropagation(); setLabelOpen(true); }}><Image source={{ uri: item.labelPhotoUrl }} style={styles.labelThumbnail} /></Pressable>}</View><AppText style={total == null ? styles.noPrice : styles.price}>{total == null ? 'Sem preço' : currency(total)}</AppText></View>
    {!!item.labelPhotoUrl && <Modal visible={labelOpen} transparent animationType="fade" onRequestClose={() => setLabelOpen(false)} statusBarTranslucent><Pressable style={styles.photoOverlay} onPress={() => setLabelOpen(false)} accessibilityRole="button" accessibilityLabel="Fechar foto da etiqueta"><Image source={{ uri: item.labelPhotoUrl }} style={styles.labelPreview} resizeMode="contain" accessibilityLabel={`Etiqueta de ${item.name}`} /><Ionicons name="close-circle" size={32} color={theme.surface} /></Pressable></Modal>}
  </Pressable>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background }, flex: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 5 }, round: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' },
  storeHeader: { minHeight: 42, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, backgroundColor: theme.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  storeHeaderText: { maxWidth: '78%', color: theme.blue, fontFamily: theme.font.bold, fontSize: 15, textAlign: 'center' },
  predictions: { marginHorizontal: 12, marginBottom: 5, padding: 9, backgroundColor: theme.surface, borderRadius: 15, borderWidth: 1, borderColor: theme.border, maxHeight: 232, gap: 5, elevation: 5 },
  predictionsTitle: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 12, marginBottom: 2 },
  prediction: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, backgroundColor: theme.surfaceMuted, padding: 5 },
  predictionImage: { width: 38, height: 38, borderRadius: 9 },
  predictionImageFallback: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.blueSoft },
  predictionName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  predictionBrand: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  trashBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: theme.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: theme.background },
  trashBadgeText: { color: 'white', fontSize: 10, fontFamily: theme.font.bold },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 16, backgroundColor: theme.surface },
  searchInput: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 16 },
  marketBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  marketBarCounts: { flex: 1 },
  marketCountText: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 },
  boldText: { color: theme.ink, fontFamily: theme.font.bold },
  marketBarActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marketPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.blueSoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  marketPillText: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 12 },
  marketPillDanger: { backgroundColor: theme.dangerSoft },
  marketPillDangerText: { color: theme.danger },
  completed: { borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 14, gap: 10, marginBottom: 6 }, completedTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, completedTitle: { fontFamily: theme.font.bold, fontSize: 20, flex: 1 }, reopen: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12 }, reopenText: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 14 }, completedTotals: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 7 }, completedMetric: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15 }, completedTotal: { alignItems: 'flex-end' },
  pendingReceipt: { borderWidth: 1, borderColor: '#FBBF24', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }, pendingTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15, marginBottom: 3 },
  receipt: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12, marginBottom: 8 }, receiptHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, receiptTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }, receiptTitle: { color: theme.ink, fontFamily: theme.font.bold }, receiptBody: { gap: 10, paddingTop: 12 }, receiptImage: { width: '100%', height: 260, backgroundColor: theme.surfaceMuted, borderRadius: 12 },
  empty: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.borderStrong, borderRadius: 16, padding: 24, gap: 8, marginTop: 14 }, emptyIcon: { width: 48, height: 48, backgroundColor: theme.blueSoft, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 16, textAlign: 'center' }, emptyDescription: { color: theme.muted, fontSize: 15, textAlign: 'center' }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 5 }, suggestion: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, suggestionText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 13 },
  cartHeading: { minHeight: 72, marginTop: 8, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cartLabel: { flexDirection: 'row', gap: 8, alignItems: 'center' }, cartTitle: { fontFamily: theme.font.semibold, color: theme.ink }, expand: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 14 },
  categoryHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, marginTop: 5 }, categoryIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, categoryName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15, flexShrink: 1 }, categoryCount: { color: theme.muted, backgroundColor: theme.border, borderRadius: 14, paddingHorizontal: 8, overflow: 'hidden', fontFamily: theme.font.bold, fontSize: 13 }, categoryTotal: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 14 },
  item: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12, gap: 7 }, itemChecked: { backgroundColor: theme.background }, itemTop: { flexDirection: 'row', alignItems: 'center', gap: 7 }, thumbnail: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, photo: { width: '100%', height: '100%' }, checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: theme.borderStrong, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: theme.blue, borderColor: theme.blue },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.surfaceMuted, borderWidth: 2, borderColor: theme.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  switchTrackChecked: { backgroundColor: theme.blue, borderColor: theme.blue },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.muted },
  switchThumbChecked: { backgroundColor: 'white', alignSelf: 'flex-end' },
  itemName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16, paddingHorizontal: 4 }, strike: { textDecorationLine: 'line-through', color: theme.subtle }, categoryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: theme.border }, categoryBadgeText: { fontFamily: theme.font.semibold, fontSize: 12, lineHeight: 17 }, notes: { color: theme.warning, backgroundColor: theme.surfaceMuted, alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, fontSize: 11 }, itemBottom: { borderTopWidth: 1, borderTopColor: theme.surfaceMuted, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }, quantityRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }, quantity: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14, flexShrink: 1 }, labelThumbnail: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: theme.border }, photoOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 }, labelPreview: { width: '100%', height: '70%' }, price: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 14 }, noPrice: { color: theme.muted, fontSize: 14 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border }, composerInput: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, borderRadius: 14, paddingHorizontal: 13, fontFamily: theme.font.regular, fontSize: 16, color: theme.ink }, scanButton: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.blue, alignItems: 'center', justifyContent: 'center' }, addButton: { width: 50, height: 50, borderRadius: 14, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
}));
