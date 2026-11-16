import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
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

const AnimatedPath = Animated.createAnimatedComponent(Path);

function SquareCheckAnimated({ checked }: { checked: boolean }) {
  const dashOffset = useRef(new Animated.Value(checked ? 0 : 32)).current;
  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: checked ? 0 : 32,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [checked, dashOffset]);

  return (
    <View style={[styles.squareCheckbox, checked && styles.squareCheckboxChecked]}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <AnimatedPath
          d="M4.5 12.5 L9.8 18 L19.5 6.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={32}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </View>
  );
}

const VOICE_RECOGNITION_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
(function(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'unsupported' })); return; }
  var rec = new SR();
  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = function(e) {
    var transcript = '';
    var isFinal = false;
    for (var i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
      if (e.results[i].isFinal) isFinal = true;
    }
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: isFinal ? 'final' : 'interim', text: transcript.trim() }));
  };
  rec.onerror = function(e) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: e.error || 'unknown' })); };
  rec.onend = function() { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'end' })); };
  try { rec.start(); } catch (err) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: String(err) })); }
})();
</script></body></html>`;

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
  onScanItem?: (item: ShoppingItem) => void;
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
  onFinish?: () => void;
  onAttachReceipt?: () => void;
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
  onScanItem,
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
  onFinish,
  onAttachReceipt,
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
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [cartExpanded, setCartExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [receiptExpanded, setReceiptExpanded] = useState(false);
  const readOnly = list.isCompleted || list.permission === 'viewer';

  useEffect(() => {
    const term = parseQuickItemInput(newItem).name.trim();
    if (term.length < 2 || !onAddProduct) {
      setProductSuggestions([]);
      setSearchingProducts(false);
      return;
    }
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

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!recordingAudio) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 480, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recordingAudio, pulseAnim]);

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

  const rows: Row[] = pendingRows;
  const estimatedTotal = list.items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  const purchasedTotal = purchased.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
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
    {/* Header alinhado idêntico ao PWA */}
    <View style={styles.header}>
      <Pressable style={styles.headerIconButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar para listas">
        <Ionicons name="arrow-back" size={20} color={theme.ink} />
      </Pressable>

      <Pressable
        style={[styles.storePill, list.isCompleted && styles.storePillCompleted]}
        onPress={!list.isCompleted && list.permission === 'owner' ? onSelectStore : undefined}
        accessibilityRole="button"
        accessibilityLabel={list.storeName ? `Local vinculado: ${list.storeName}` : list.isCompleted ? 'Lista finalizada' : 'Vincular local à lista'}
      >
        <CanetoIcon name={list.isCompleted && !list.storeName ? 'check' : 'store'} size={16} color={list.isCompleted ? theme.success : 'white'} />
        <Text style={[styles.storePillText, list.isCompleted && styles.storePillCompletedText]} numberOfLines={1}>
          {list.storeName ? list.storeName : list.isCompleted ? 'Compra finalizada' : '+ Vincular local'}
        </Text>
      </Pressable>

      <Pressable style={styles.headerIconButton} onPress={onOptions} accessibilityRole="button" accessibilityLabel="Opções da lista">
        <Ionicons name="ellipsis-vertical" size={20} color={theme.ink} />
      </Pressable>
    </View>

    <FlatList
      data={rows}
      keyExtractor={row => row.kind === 'cart' ? 'cart-heading' : row.kind === 'category' ? `category-${row.id}` : row.item.id}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } catch (error) { Alert.alert('Não foi possível atualizar', getErrorMessage(error)); } finally { setRefreshing(false); } }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<>
        {list.items.length > 0 && !list.isCompleted && <View style={styles.search}><Ionicons name="search-outline" size={18} color={theme.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Filtrar itens na lista..." placeholderTextColor={theme.muted} style={styles.searchInput} accessibilityLabel="Filtrar itens na lista" />{!!search && <Pressable onPress={() => setSearch('')} accessibilityLabel="Limpar filtro"><Ionicons name="close" size={18} color={theme.muted} /></Pressable>}</View>}
        {list.isCompleted && <View style={styles.completed}>
          <View style={styles.completedTitleRow}>
            <View style={styles.completedHeaderLeft}>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={theme.success} />
                <Text style={styles.completedBadgeText}>Finalizada</Text>
              </View>
              <AppText style={styles.completedTitle}>{list.name}</AppText>
            </View>
            {!!onReopen && (
              <Pressable accessibilityRole="button" accessibilityLabel="Reabrir lista" style={styles.reopen} onPress={() => void onReopen()}>
                <Ionicons name="refresh-outline" size={15} color={theme.ink} />
                <AppText style={styles.reopenText}>Reabrir</AppText>
              </Pressable>
            )}
          </View>
          <View style={styles.completedMetaGroup}>
            <View style={styles.completedMetaRow}>
              <Ionicons name="storefront-outline" size={14} color={theme.muted} />
              <AppText style={styles.completedMetaText} numberOfLines={1}>
                {list.storeName || 'Sem local informado'} · {list.completedAt ? new Date(list.completedAt).toLocaleDateString('pt-BR') : 'Data não informada'}
              </AppText>
            </View>
            {!!list.storeAddress && (
              <View style={styles.completedMetaRow}>
                <Ionicons name="location-outline" size={14} color={theme.muted} />
                <AppText style={styles.completedMetaText} numberOfLines={2}>{list.storeAddress}</AppText>
              </View>
            )}
          </View>
          <View style={styles.completedTotals}>
            <View style={styles.completedStatTile}>
              <AppText style={styles.completedStatLabel}>Itens</AppText>
              <AppText style={styles.completedMetric}>{list.items.filter(item => item.checked).length}/{list.items.length}</AppText>
            </View>
            <View style={styles.completedStatTile}>
              <AppText style={styles.completedStatLabel}>Pagamento</AppText>
              <AppText style={styles.completedMetric} numberOfLines={1}>{list.paymentMethod ? list.paymentMethod.charAt(0).toUpperCase() + list.paymentMethod.slice(1) : 'Não inf.'}</AppText>
            </View>
            <View style={[styles.completedStatTile, styles.completedTotalTile]}>
              <AppText style={styles.completedStatLabel}>Total pago</AppText>
              <AppText style={styles.completedTotalValue} numberOfLines={1}>{currency(list.totalSpent ?? referenceTotal)}</AppText>
            </View>
          </View>
        </View>}
        {pendingReceipt && <View style={styles.pendingReceipt}><Ionicons name="alert-circle-outline" size={22} color={theme.warning} /><View style={styles.flex}><AppText style={styles.pendingTitle}>Nota fiscal pendente</AppText><AppText tone="caption">{totalDifference ? `O total pago (${currency(list.totalSpent ?? 0)}) difere da lista (${currency(referenceTotal)}). Anexe a nota para validar.` : 'Anexe a nota fiscal ou escaneie o recibo para completar a compra.'}</AppText>{!!onAttachReceipt && <Pressable style={styles.pendingAction} onPress={onAttachReceipt} accessibilityRole="button" accessibilityLabel="Anexar nota fiscal"><Ionicons name="scan-outline" size={16} color="white" /><Text style={styles.pendingActionText}>Anexar nota ou escanear recibo</Text></Pressable>}</View></View>}
        {list.isCompleted && !!(list.receiptPhotoUrl || list.receiptQrCode) && <View style={styles.receipt}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: receiptExpanded }} accessibilityLabel="Nota fiscal" onPress={() => setReceiptExpanded(value => !value)} style={styles.receiptHeader}><View style={styles.receiptTitleRow}><Ionicons name="receipt-outline" size={18} color={theme.blueLight} /><AppText style={styles.receiptTitle}>Nota fiscal</AppText></View><AppText tone="caption">{list.completedAt ? new Date(list.completedAt).toLocaleDateString('pt-BR') : 'Ver comprovante'}</AppText><Ionicons name={receiptExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} /></Pressable>
          {receiptExpanded && <View style={styles.receiptBody}>{!!list.receiptPhotoUrl && <Image source={{ uri: list.receiptPhotoUrl }} style={styles.receiptImage} resizeMode="contain" accessibilityLabel="Foto da nota fiscal" />}{!!list.receiptQrCode && <AppText tone="caption" selectable>QR da nota: {list.receiptQrCode}</AppText>}</View>}
        </View>}
      </>}
      ListEmptyComponent={<View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <CanetoIcon name="cart" size={26} color={theme.blue} />
        </View>
        <AppText style={styles.emptyTitle}>
          {list.items.length ? 'Nenhum item encontrado' : list.isCompleted ? 'Nenhum item nesta lista finalizada' : 'Sua lista está vazia'}
        </AppText>
        <AppText style={styles.emptyDescription}>
          {list.items.length ? 'Tente outro termo de busca.' : list.isCompleted ? 'Esta compra foi arquivada sem itens.' : 'Digite itens no rodapé, use o microfone ou clique nas sugestões:'}
        </AppText>
        {!readOnly && !list.items.length && (
          <View style={styles.suggestions}>
            {suggestions.map(suggestion => (
              <Pressable
                key={suggestion}
                style={styles.suggestion}
                onPress={() => add(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`Adicionar ${suggestion}`}
              >
                <AppText style={styles.suggestionText}>{suggestion}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>}
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
            onScanItem={onScanItem ? () => onScanItem(item.item) : undefined}
          />}
    />
    {!readOnly && !!newItem.trim() && !!onAddProduct && (searchingProducts || productSuggestions.length > 0) && <View style={styles.predictions}>
      <Text style={styles.predictionsTitle}>Resultados com foto {searchingProducts ? '· buscando...' : ''}</Text>
      <ScrollView style={styles.predictionsScroll} contentContainerStyle={styles.predictionsList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
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
      </ScrollView>
    </View>}
    {!readOnly && (purchased.length > 0 || (!!onFinish && list.items.length > 0 && list.items.every(item => item.checked))) && (
      <View style={styles.finishFooterWrap} pointerEvents="box-none">
        {purchased.length > 0 && (
          <Pressable
            style={styles.cartFooterButton}
            onPress={() => setCartExpanded(value => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: cartExpanded }}
          >
            <View style={styles.cartLabel}>
              <CanetoIcon name="cart" size={18} color={theme.blueLight} />
              <AppText style={styles.cartTitle}>No carrinho ({purchased.length})</AppText>
            </View>
            <AppText style={styles.expand}>{cartExpanded ? 'Recolher' : 'Expandir'}</AppText>
          </Pressable>
        )}
        {cartExpanded && purchased.length > 0 && (
          <ScrollView style={styles.cartItemsScroll} contentContainerStyle={styles.cartItemsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {purchased.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                readOnly={readOnly}
                showCategoryBadge={!showCategoryHeaders}
                checkboxStyle={checkboxStyle}
                onToggle={() => void handleToggle(item)}
                onEdit={() => onEdit(item)}
                onScanItem={onScanItem ? () => onScanItem(item) : undefined}
              />
            ))}
          </ScrollView>
        )}
        {!!onFinish && list.items.length > 0 && list.items.every(item => item.checked) && (
          <Pressable style={styles.finishButton} onPress={onFinish} accessibilityRole="button" accessibilityLabel={`Finalizar compra de ${list.name}`}>
            <Ionicons name="checkmark-done-outline" size={20} color="white" />
            <Text style={styles.finishText}>Finalizar compra</Text>
          </Pressable>
        )}
      </View>
    )}
    {!readOnly && (
      <View style={[styles.composerContainer, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insets.bottom, 10) }]}>
        <View style={styles.composerCard}>
          <TextInput
            style={styles.composerInput}
            value={newItem}
            onChangeText={setNewItem}
            placeholder={recordingAudio ? 'Ouvindo áudio...' : 'Digite itens (ex: 2 kg banana)'}
            placeholderTextColor={recordingAudio ? theme.danger : theme.muted}
            onSubmitEditing={() => add()}
            returnKeyType="done"
          />

          {newItem.length > 0 && (
            <Pressable
              style={styles.clearButton}
              onPress={() => {
                setNewItem('');
                setProductSuggestions([]);
              }}
              accessibilityLabel="Limpar texto do item"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={20} color={theme.muted} />
            </Pressable>
          )}

          <View style={styles.composerActions}>
            {!!onScan && (
              <Pressable
                style={styles.composerButton}
                onPress={onScan}
                accessibilityLabel="Leitor em tempo real (produtos, textos e códigos EAN)"
              >
                <Ionicons name="camera-outline" size={20} color={theme.ink} />
              </Pressable>
            )}

            {newItem.trim() ? (
              <Pressable
                style={[styles.composerButton, styles.composerSubmitActive]}
                onPress={() => add()}
                disabled={busy}
                accessibilityLabel="Adicionar à lista"
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </Pressable>
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Pressable
                  style={[styles.composerButton, recordingAudio && styles.composerMicRecording]}
                  onPress={async () => {
                    if (recordingAudio) {
                      setRecordingAudio(false);
                      return;
                    }
                    if (Platform.OS === 'android') {
                      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
                        title: 'Permissão de microfone',
                        message: 'O Caneto precisa acessar o microfone para transcrever itens por voz.',
                        buttonPositive: 'Permitir',
                        buttonNegative: 'Cancelar',
                      });
                      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        Alert.alert('Microfone bloqueado', 'Permita o acesso ao microfone nas configurações para usar a entrada por voz.');
                        return;
                      }
                    }
                    setRecordingAudio(true);
                  }}
                  accessibilityLabel={recordingAudio ? 'Parar gravação de áudio' : 'Gravar item por voz'}
                >
                  <Ionicons name={recordingAudio ? 'stop' : 'mic-outline'} size={20} color={recordingAudio ? '#FFFFFF' : theme.ink} />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    )}
    {recordingAudio && (
      <View style={{ width: 1, height: 1, opacity: 0, overflow: 'hidden', position: 'absolute' }} pointerEvents="none">
        <WebView
          originWhitelist={['*']}
          source={{ html: VOICE_RECOGNITION_HTML, baseUrl: 'https://localhost' }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          onMessage={event => {
            try {
              const payload = JSON.parse(event.nativeEvent.data) as { type: string; text?: string };
              if ((payload.type === 'interim' || payload.type === 'final') && payload.text) {
                setNewItem(payload.text);
              }
              if (payload.type === 'final' || payload.type === 'end') {
                setRecordingAudio(false);
              } else if (payload.type === 'unsupported') {
                setRecordingAudio(false);
                Alert.alert('Voz indisponível', 'O reconhecimento de voz não está disponível neste dispositivo.');
              } else if (payload.type === 'error') {
                setRecordingAudio(false);
              }
            } catch {
              setRecordingAudio(false);
            }
          }}
        />
      </View>
    )}
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
  onScanItem,
}: {
  item: ShoppingItem;
  readOnly: boolean;
  showCategoryBadge: boolean;
  checkboxStyle?: CheckboxStyle;
  onToggle: () => void;
  onEdit: () => void;
  onScanItem?: () => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const category = categoryFor(item.categoryId);
  const total = item.price == null ? null : item.price * item.quantity;

  return <Pressable style={[styles.item, item.checked && styles.itemChecked]} onPress={readOnly ? undefined : onEdit} accessibilityRole="button" accessibilityLabel={readOnly ? item.name : `Editar ${item.name}`}>
    <View style={styles.itemTop}>
      <View style={styles.thumbnail}>{item.photoUrl && !photoFailed ? <Image source={{ uri: item.photoUrl }} style={styles.photo} onError={() => setPhotoFailed(true)} /> : <CanetoIcon name={item.categoryId} size={24} color={theme.ink} />}</View>
      <View style={styles.flex} />

      {!readOnly && onScanItem && (
        <Pressable
          style={styles.itemScanButton}
          onPress={event => {
            event.stopPropagation();
            onScanItem();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Escanear produto para auto-preencher e marcar: ${item.name}`}
        >
          <Ionicons name="camera-outline" size={16} color="white" />
        </Pressable>
      )}

      {checkboxStyle === 'switch' ? (
        <Pressable
          style={[styles.switchTrack, item.checked && styles.switchTrackChecked]}
          hitSlop={{ top: 21, bottom: 21, left: 21, right: 21 }}
          onPress={readOnly ? undefined : event => { event.stopPropagation(); onToggle(); }}
          accessibilityRole="switch"
          accessibilityState={{ checked: item.checked, disabled: readOnly }}
          accessibilityLabel={`${item.checked ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        >
          <View style={[styles.switchThumb, item.checked && styles.switchThumbChecked]} />
        </Pressable>
      ) : checkboxStyle === 'square' ? (
        <Pressable
          hitSlop={{ top: 21, bottom: 21, left: 21, right: 21 }}
          onPress={readOnly ? undefined : event => { event.stopPropagation(); onToggle(); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked, disabled: readOnly }}
          accessibilityLabel={`${item.checked ? 'Desmarcar' : 'Marcar como comprado'}: ${item.name}`}
        >
          <SquareCheckAnimated checked={item.checked} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.checkbox, item.checked && styles.checkboxChecked]}
          hitSlop={{ top: 21, bottom: 21, left: 21, right: 21 }}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerIconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  storePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.blue },
  storePillCompleted: { backgroundColor: theme.successSoft, borderWidth: 1, borderColor: theme.success },
  storePillText: { color: 'white', fontFamily: theme.font.bold, fontSize: 14, maxWidth: '85%' },
  storePillCompletedText: { color: theme.success },
  predictions: { marginHorizontal: 12, marginBottom: 5, padding: 9, backgroundColor: theme.surface, borderRadius: 15, borderWidth: 1, borderColor: theme.border, maxHeight: 196, elevation: 5 },
  predictionsScroll: { maxHeight: 156 },
  predictionsList: { gap: 5 },
  predictionsTitle: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 12, marginBottom: 4 },
  prediction: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, backgroundColor: theme.surfaceMuted, padding: 5 },
  predictionImage: { width: 38, height: 38, borderRadius: 9 },
  predictionImageFallback: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.blueSoft },
  predictionName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  predictionBrand: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  trashBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: theme.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: theme.background },
  trashBadgeText: { color: 'white', fontSize: 10, fontFamily: theme.font.bold },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, marginBottom: 2, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 14, backgroundColor: theme.surface },
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
  finishFooterWrap: { paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center', gap: 8 },
  cartFooterButton: { width: '100%', minHeight: 50, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartItemsScroll: { width: '100%', maxHeight: 220 },
  cartItemsList: { gap: 8 },
  finishButton: { width: '70%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.blue, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, elevation: 4 },
  finishText: { color: 'white', fontFamily: theme.font.bold, fontSize: 15 },
  pendingAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: theme.blue, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginTop: 10, alignSelf: 'stretch' },
  pendingActionText: { color: 'white', fontFamily: theme.font.bold, fontSize: 13 },
  completed: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 16, gap: 12, marginTop: 6, marginBottom: 4 },
  completedTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  completedHeaderLeft: { flex: 1, gap: 6 },
  completedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.successSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  completedBadgeText: { color: theme.success, fontFamily: theme.font.bold, fontSize: 11 },
  completedTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 19, lineHeight: 24 },
  reopen: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12 },
  reopenText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  completedMetaGroup: { gap: 4 },
  completedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedMetaText: { flex: 1, color: theme.muted, fontFamily: theme.font.regular, fontSize: 13 },
  completedTotals: { flexDirection: 'row', gap: 8, marginTop: 2 },
  completedStatTile: { flex: 1, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, gap: 2 },
  completedTotalTile: { borderColor: theme.borderStrong },
  completedStatLabel: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 11 },
  completedMetric: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  completedTotalValue: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 14 },
  pendingReceipt: { borderWidth: 1, borderColor: theme.warning, backgroundColor: theme.warningSoft, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, marginBottom: 4 }, pendingTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15, marginBottom: 3 },
  receipt: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, marginTop: 4, marginBottom: 4 }, receiptHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, receiptTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }, receiptTitle: { color: theme.ink, fontFamily: theme.font.bold }, receiptBody: { gap: 10, paddingTop: 12 }, receiptImage: { width: '100%', height: 260, backgroundColor: theme.surfaceMuted, borderRadius: 12 },
  empty: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.borderStrong, borderRadius: 20, padding: 24, gap: 10, marginTop: 14 },
  emptyIcon: { width: 52, height: 52, backgroundColor: theme.blueSoft, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 17, textAlign: 'center' },
  emptyDescription: { color: theme.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: '90%' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  suggestion: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  suggestionText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  cartHeading: { minHeight: 72, marginTop: 8, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cartLabel: { flexDirection: 'row', gap: 8, alignItems: 'center' }, cartTitle: { fontFamily: theme.font.semibold, color: theme.ink }, expand: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 14 },
  categoryHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, marginTop: 5 }, categoryIcon: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, categoryName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15, flexShrink: 1 }, categoryCount: { color: theme.muted, backgroundColor: theme.border, borderRadius: 14, paddingHorizontal: 8, overflow: 'hidden', fontFamily: theme.font.bold, fontSize: 13 }, categoryTotal: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 14 },
  item: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, gap: 8 }, itemChecked: { backgroundColor: theme.background }, itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumbnail: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, photo: { width: '100%', height: '100%' },
  itemScanButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.blue, marginRight: 6 },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: theme.borderStrong, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: theme.blue, borderColor: theme.blue },
  squareCheckbox: { width: 28, height: 28, borderWidth: 2.5, borderColor: theme.borderStrong, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  squareCheckboxChecked: { backgroundColor: theme.blue, borderColor: theme.blue },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.surfaceMuted, borderWidth: 2, borderColor: theme.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  switchTrackChecked: { backgroundColor: theme.blue, borderColor: theme.blue },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.muted },
  switchThumbChecked: { backgroundColor: 'white', alignSelf: 'flex-end' },
  itemName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, strike: { textDecorationLine: 'line-through', color: theme.subtle }, categoryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: theme.border }, categoryBadgeText: { fontFamily: theme.font.semibold, fontSize: 12, lineHeight: 17 }, notes: { color: theme.warning, backgroundColor: theme.surfaceMuted, alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, fontSize: 11 }, itemBottom: { borderTopWidth: 1, borderTopColor: theme.surfaceMuted, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }, quantityRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }, quantity: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14, flexShrink: 1 }, labelThumbnail: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: theme.border }, photoOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 }, labelPreview: { width: '100%', height: '70%' }, price: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 14 }, noPrice: { color: theme.muted, fontSize: 14 },
  composerContainer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  composerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceMuted, borderRadius: 16, borderWidth: 1, borderColor: theme.borderStrong, paddingLeft: 14, paddingRight: 6, paddingVertical: 4, minHeight: 52 },
  composerInput: { flex: 1, minHeight: 44, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15, paddingVertical: 4 },
  clearButton: { paddingHorizontal: 6, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  composerSubmitActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  composerMicRecording: { backgroundColor: theme.danger, borderColor: theme.danger },
}));
