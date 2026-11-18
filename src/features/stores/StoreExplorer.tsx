import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSheet } from '../../ui/ModalSheet';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { AppButton } from '../../ui/primitives';
import { createThemedStyles, theme } from '../../ui/theme';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { categoryFor } from '../../core/categories';
import { getErrorMessage } from '../../ui/error';
import { normalizeStoreText, type Coordinates, type Store, type StoreCategory, type StorePrice } from './model';
import { linkStoreToList, loadStoreDetails, loadStorePrices, searchStores } from './repository';
import { OsmMap } from './OsmMap';
import { NewStoreModal } from './NewStoreModal';
import { useDeviceLocation } from './useDeviceLocation';
import { searchProductSuggestions } from '../products/search';
import type { Item } from '../../data';

export type CatalogProductInput = { name: string; categoryId: string; price?: number; unit?: string; photoUrl?: string; ean?: string };
export type AvailableListOption = { id: string; name: string; itemCount?: number };
type ExplorerProps = { onSelectStore?: (store: Store) => void | Promise<void>; onAddProduct?: (product: CatalogProductInput) => void | Promise<void>; availableLists?: AvailableListOption[]; onImportItems?: (store: Store, items: CatalogProductInput[], targetListId?: string | 'new', newListName?: string) => void | Promise<void>; coordinates?: Coordinates; selectedStoreId?: string; savedStores?: Store[]; savedCatalog?: Record<string, Item[]>; mode?: 'explore' | 'picker' };

const STORE_CACHE_PREFIX = 'caneto.stores.cache.v2';
const STORE_DETAILS_CACHE_KEY = 'caneto.stores.details.v2';
const PRODUCT_PHOTO_CACHE_KEY = 'caneto.products.photos.v1';
const STORE_QUERY_TTL_MS = 1000 * 60 * 5;
const storeQueryCache = new Map<string, { at: number; rows: Store[] }>();
const isValidStoreRow = (store: Store) => !/giant food/i.test(store.name) && !/ashburn/i.test(store.address ?? '');

const productPhotoKey = (price: StorePrice) =>
  (price.ean && /^\d{8,14}$/.test(price.ean.trim()) ? `ean:${price.ean.trim()}` : `name:${price.canonical_name || normalizeStoreText(price.product_name)}`);

function readCachedProductPhotos(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(PRODUCT_PHOTO_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedProductPhotos(photos: Record<string, string>) {
  try {
    if (typeof localStorage !== 'undefined') {
      const entries = Object.entries(photos).slice(-200);
      localStorage.setItem(PRODUCT_PHOTO_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {}
}

async function resolveStorePricePhoto(price: StorePrice): Promise<string> {
  const ean = price.ean?.trim();
  if (ean && /^\d{8,14}$/.test(ean)) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=image_front_small_url,image_small_url,image_url`);
      if (res.ok) {
        const data = (await res.json()) as { status?: number; product?: { image_front_small_url?: string; image_small_url?: string; image_url?: string } };
        const offImage = data.product?.image_front_small_url || data.product?.image_small_url || data.product?.image_url;
        if (offImage && offImage.startsWith('http')) return offImage;
      }
    } catch {}
  }
  try {
    const suggestions = await searchProductSuggestions(price.product_name);
    const match = suggestions.find(item => item.image && item.image.startsWith('http'));
    if (match?.image) return match.image;
  } catch {}
  return '';
}

function readCachedStores(mode: 'explore' | 'picker'): Store[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(`${STORE_CACHE_PREFIX}.${mode}`);
    const parsed = raw ? (JSON.parse(raw) as Store[]) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidStoreRow) : [];
  } catch {
    return [];
  }
}

function writeCachedStores(mode: 'explore' | 'picker', rows: Store[]) {
  try {
    const clean = rows.filter(isValidStoreRow);
    if (typeof localStorage !== 'undefined' && clean.length > 0) {
      localStorage.setItem(`${STORE_CACHE_PREFIX}.${mode}`, JSON.stringify(clean.slice(0, 40)));
    }
  } catch {}
}

function readCachedStoreDetails(): Record<string, Store> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORE_DETAILS_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Store>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCachedStoreDetails(details: Record<string, Store>) {
  try {
    if (typeof localStorage !== 'undefined') {
      const entries = Object.entries(details).slice(-60);
      localStorage.setItem(STORE_DETAILS_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {}
}

export function StoreExplorer({ onSelectStore, onAddProduct, availableLists, onImportItems, coordinates, selectedStoreId, savedStores = [], savedCatalog, mode = 'explore' }: ExplorerProps) {
  const insets = useSafeAreaInsets();
  const device = useDeviceLocation(!coordinates);
  const activeCoordinates = coordinates ?? device.coords ?? undefined;
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [category] = useState<StoreCategory>('all');
  const [stores, setStores] = useState<Store[]>(() => readCachedStores(mode));
  const [enrichedById, setEnrichedById] = useState<Record<string, Store>>(() => readCachedStoreDetails());
  const [selected, setSelected] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lat = activeCoordinates?.lat;
  const lng = activeCoordinates?.lng;

  useEffect(() => {
    let active = true;
    const latKey = lat != null ? lat.toFixed(3) : '';
    const lngKey = lng != null ? lng.toFixed(3) : '';
    const cacheKey = `${mode}:${category}:${query.trim().toLowerCase()}:${latKey}:${lngKey}`;
    const cachedQuery = storeQueryCache.get(cacheKey);
    if (cachedQuery && Date.now() - cachedQuery.at < STORE_QUERY_TTL_MS) {
      setStores(cachedQuery.rows);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      searchStores(query, category, lat != null && lng != null ? { lat, lng } : undefined, mode === 'explore').then(rows => {
        if (!active) return;
        const cleanRows = rows.filter(isValidStoreRow);
        setStores(cleanRows);
        storeQueryCache.set(cacheKey, { at: Date.now(), rows: cleanRows });
        if (!query && category === 'all') writeCachedStores(mode, cleanRows);
      })
        .catch(reason => { if (active) setError(getErrorMessage(reason)); })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 350 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, lat, lng, retry, mode]);

  const featured = useMemo(() => {
    const local = mode === 'explore' ? savedStores.filter(store =>
      isValidStoreRow(store)
      && (category === 'all' || store.category === category)
      && (!query || normalizeStoreText(`${store.name} ${store.address}`).includes(normalizeStoreText(query)))) : [];
    const merged = new Map<string, Store>();
    for (const store of [...local, ...stores]) {
      if (!isValidStoreRow(store)) continue;
      const existing = merged.get(store.id);
      const cached = enrichedById[store.id];
      const combined: Store = {
        ...(existing ?? store),
        ...store,
        ...(cached ?? {}),
        thumbnailUrl: store.thumbnailUrl || cached?.thumbnailUrl || existing?.thumbnailUrl,
        photos: store.photos?.length ? store.photos : (cached?.photos ?? existing?.photos),
        address: store.address || cached?.address || existing?.address || '',
        lat: store.lat ?? cached?.lat ?? existing?.lat,
        lon: store.lon ?? cached?.lon ?? existing?.lon,
        rating: store.rating ?? cached?.rating ?? existing?.rating,
        distance: store.distance ?? existing?.distance ?? cached?.distance,
        categoryLabel: store.categoryLabel !== 'Loja' ? store.categoryLabel : (cached?.categoryLabel ?? existing?.categoryLabel ?? store.categoryLabel),
      };
      merged.set(store.id, combined);
    }
    return [...merged.values()].slice(0, 80);
  }, [stores, savedStores, enrichedById, mode, category, query]);

  useEffect(() => {
    const missing = featured.filter(store => store.source === 'google' && !!store.placeId && !store.thumbnailUrl && !enrichedById[store.id]).slice(0, 8);
    if (!missing.length) return;
    let active = true;
    void Promise.allSettled(missing.map(store => loadStoreDetails(store))).then(results => {
      if (!active) return;
      const next: Record<string, Store> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          next[missing[index].id] = result.value;
        }
      });
      if (Object.keys(next).length > 0) {
        setEnrichedById(prev => {
          const updated = { ...prev, ...next };
          writeCachedStoreDetails(updated);
          return updated;
        });
      }
    });
    return () => { active = false; };
  }, [featured, enrichedById]);

  const searchControl = <View style={[styles.searchBox, mode === 'picker' && styles.searchBoxPicker]}><Ionicons name="search-outline" size={19} color={theme.muted} /><TextInput style={styles.searchInput} placeholder="Buscar locais por perto" placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} returnKeyType="search" accessibilityLabel="Buscar locais por perto" />{!!query && <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')}><Ionicons name="close" size={18} color={theme.muted} /></Pressable>}</View>;
  const markers = featured.flatMap(store => store.lat != null && store.lon != null ? [{ id: store.id, name: store.name, lat: store.lat, lng: store.lon }] : []);
  return <View style={mode === 'picker' ? styles.pickerExplorer : styles.explorer}>
    {mode === 'explore' && <OsmMap user={activeCoordinates} markers={markers} onSelect={id => setSelected(featured.find(store => store.id === id) ?? null)} />}
    {mode === 'explore' && !!device.message && <Text style={styles.noticeText}>{device.message}</Text>}
    {mode === 'explore' && searchControl}
    {mode === 'explore' && <View style={styles.resultsHeading}><Ionicons name="storefront-outline" size={18} color={theme.blueLight} /><Text style={styles.resultsTitle}>{query || !activeCoordinates ? 'Locais encontrados' : 'Locais próximos encontrados'} ({featured.length})</Text>{loading && <ActivityIndicator size="small" color={theme.blueLight} />}</View>}
    {mode !== 'explore' && loading && stores.length === 0 && <ActivityIndicator style={styles.loader} color={theme.blueLight} />}
    {!!error && <View style={styles.notice}><Text style={styles.noticeText}>{error}</Text><Pressable onPress={() => setRetry(value => value + 1)}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View>}
    <ScrollView style={mode === 'picker' ? styles.pickerScroll : undefined} contentContainerStyle={mode === 'picker' ? styles.pickerResults : styles.results} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {!loading && !featured.length && !error && <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={28} color={theme.blue} /></View><Text style={styles.emptyTitle}>{query ? `Nenhum local com produtos salvos para “${query}”` : 'Nenhum local com produtos salvos'}</Text><Text style={styles.emptyDescription}>Aqui aparecem apenas lojas com produtos e preços cadastrados. Escaneie uma compra para iniciar o catálogo.</Text></View>}
      {featured.map(store => <StoreCard key={store.id} store={store} selected={store.id === selectedStoreId} onPress={() => setSelected(store)} picker={mode === 'picker'} />)}
    </ScrollView>
    {mode === 'explore' && (
      <View style={[styles.floating, { bottom: Math.max(insets.bottom, 12) + 76 }]} pointerEvents="box-none">
        <AppButton label="Novo Local" icon={<Ionicons name="add" size={21} color="#FFFFFF" />} onPress={() => setCreating(true)} style={styles.createStore} />
      </View>
    )}
    {mode === 'picker' && searchControl}
    <StoreDetailsModal visible={!!selected} store={selected} localItems={selected ? savedCatalog?.[selected.id] : undefined} onClose={() => setSelected(null)} onSelect={onSelectStore ? async store => { await onSelectStore(store); setSelected(null); } : undefined} onAddProduct={onAddProduct} availableLists={availableLists} onImportItems={onImportItems} />
    <NewStoreModal visible={creating} onClose={() => setCreating(false)} />
  </View>;
}

type StorePickerProps = { visible: boolean; listId: string; onClose: () => void; onLinked?: () => void | Promise<void>; coordinates?: Coordinates; selectedStoreId?: string; selectedStoreName?: string };
export function StorePickerModal(props: StorePickerProps) {
  return props.visible ? <StorePickerDialog key={props.listId} {...props} /> : null;
}

function StorePickerDialog({ listId, onClose, onLinked, coordinates, selectedStoreId, selectedStoreName }: StorePickerProps) {
  const [message, setMessage] = useState('');
  return <ModalSheet visible title="Vincular Loja à Lista" onClose={onClose}>
    <View style={styles.pickerBody}>
      {!!message && <Text style={styles.error}>{message}</Text>}
      {selectedStoreId && <View style={styles.linkedBanner}><View style={styles.linkedIcon}><Ionicons name="checkmark" size={22} color={theme.success} /></View><View style={styles.linkedCopy}><Text style={styles.linkedEyebrow}>LOJA VINCULADA ATUAL</Text>{!!selectedStoreName && <Text style={styles.linkedName} numberOfLines={1}>{selectedStoreName}</Text>}<Text style={styles.linkedText}>Selecione outra loja abaixo para trocar.</Text></View><Pressable style={styles.unlink} onPress={async () => { try { await linkStoreToList(listId, null); await onLinked?.(); onClose(); } catch (error) { setMessage(getErrorMessage(error)); } }}><Ionicons name="close" size={16} color={theme.danger} /><Text style={styles.unlinkText}>Desvincular</Text></Pressable></View>}
      <StoreExplorer mode="picker" coordinates={coordinates} selectedStoreId={selectedStoreId} onSelectStore={async store => { try { setMessage(''); await linkStoreToList(listId, store); await onLinked?.(); onClose(); } catch (error) { setMessage(getErrorMessage(error)); throw error; } }} />
    </View>
  </ModalSheet>;
}

export function StoreDetailsModal({ visible, store, localItems, onClose, onSelect, onAddProduct, availableLists, onImportItems }: { visible: boolean; store: Store | null; localItems?: Item[]; onClose: () => void; onSelect?: (store: Store) => void | Promise<void>; onAddProduct?: (product: CatalogProductInput) => void | Promise<void>; availableLists?: AvailableListOption[]; onImportItems?: (store: Store, items: CatalogProductInput[], targetListId?: string | 'new', newListName?: string) => void | Promise<void> }) {
  return visible && store ? <StoreDetailsDialog key={store.id} store={store} localItems={localItems ?? []} onClose={onClose} onSelect={onSelect} onAddProduct={onAddProduct} availableLists={availableLists ?? []} onImportItems={onImportItems} /> : null;
}

function StoreDetailsDialog({ store, localItems, onClose, onSelect, onAddProduct, availableLists, onImportItems }: { store: Store; localItems: Item[]; onClose: () => void; onSelect?: (store: Store) => void | Promise<void>; onAddProduct?: (product: CatalogProductInput) => void | Promise<void>; availableLists: AvailableListOption[]; onImportItems?: (store: Store, items: CatalogProductInput[], targetListId?: string | 'new', newListName?: string) => void | Promise<void> }) {
  const [details, setDetails] = useState<Store>(store);
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [section, setSection] = useState<'catalog' | 'info'>('catalog');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [message, setMessage] = useState('');
  const [remotePhotos, setRemotePhotos] = useState<Record<string, string>>(() => readCachedProductPhotos());
  const [draftItems, setDraftItems] = useState<CatalogProductInput[]>([]);
  const [previewItem, setPreviewItem] = useState<{ product: CatalogProductInput; subtitle: string; categoryName: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newListName, setNewListName] = useState(`Compras · ${store.name}`);
  const [importing, setImporting] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const isInDraft = (name: string) => draftItems.some(entry => normalizeStoreText(entry.name) === normalizeStoreText(name));
  const toggleDraftItem = (product: CatalogProductInput) => {
    setDraftItems(prev => {
      const exists = prev.some(entry => normalizeStoreText(entry.name) === normalizeStoreText(product.name));
      return exists ? prev.filter(entry => normalizeStoreText(entry.name) !== normalizeStoreText(product.name)) : [...prev, product];
    });
  };
  const requestClose = () => {
    if (draftItems.length > 0) {
      setConfirmLeaveOpen(true);
      return;
    }
    onClose();
  };
  const runImport = async (targetListId: string | 'new') => {
    if (!onImportItems || !draftItems.length) return;
    setImporting(true);
    try {
      await onImportItems(current, draftItems, targetListId, newListName);
      setDraftItems([]);
      setImportModalOpen(false);
      onClose();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };
  useEffect(() => {
    let active = true;
    Promise.allSettled([loadStoreDetails(store), loadStorePrices(store.id)]).then(([detailResult, priceResult]) => {
      if (!active) return;
      if (detailResult.status === 'fulfilled') setDetails(detailResult.value);
      if (priceResult.status === 'fulfilled') setPrices(priceResult.value);
      if (detailResult.status === 'rejected' && priceResult.status === 'rejected') setMessage('Detalhes adicionais indisponíveis no momento.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [store]);
  const current = details ?? store;
  const uniqueLocalItems = [...new Map(localItems.map(item => [item.id, item])).values()];
  const remotePrices = prices.filter(price => !uniqueLocalItems.some(item => normalizeStoreText(item.name) === normalizeStoreText(price.product_name)));
  useEffect(() => {
    if (section !== 'catalog' || remotePrices.length === 0) return;
    const missing = remotePrices.filter(price => !(productPhotoKey(price) in remotePhotos)).slice(0, 10);
    if (!missing.length) return;
    let active = true;
    void Promise.allSettled(missing.map(price => resolveStorePricePhoto(price))).then(results => {
      if (!active) return;
      const updates: Record<string, string> = {};
      results.forEach((result, index) => {
        updates[productPhotoKey(missing[index])] = result.status === 'fulfilled' ? result.value : '';
      });
      setRemotePhotos(prev => {
        const next = { ...prev, ...updates };
        writeCachedProductPhotos(next);
        return next;
      });
    });
    return () => { active = false; };
  }, [section, remotePrices, remotePhotos]);
  const productCount = uniqueLocalItems.length + remotePrices.length;
  const mapUrl = current.googleMapsUrl || (current.lat != null && current.lon != null ? `https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lon}` : '');
  return <Modal visible transparent animationType="fade" onRequestClose={requestClose} statusBarTranslucent navigationBarTranslucent>
    <View style={styles.detailsOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityRole="button" accessibilityLabel="Fechar janela" />
      <View style={styles.detailsSheet}>
        <View style={styles.heroHeader}>
          {!!current.thumbnailUrl && (
            <View style={styles.heroImageWrap} pointerEvents="none">
              <Image source={{ uri: current.thumbnailUrl }} style={styles.heroImage} resizeMode="cover" />
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <LinearGradient id="heroFade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={theme.surface} stopOpacity="1" />
                    <Stop offset="0.18" stopColor={theme.surface} stopOpacity="0.94" />
                    <Stop offset="0.55" stopColor={theme.surface} stopOpacity="0.55" />
                    <Stop offset="1" stopColor={theme.surface} stopOpacity="0.18" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
              </Svg>
            </View>
          )}
          <View style={styles.heroContent}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle} numberOfLines={2}>{current.name}</Text>
              <Text style={styles.heroSubtitle} numberOfLines={1}>
                {current.categoryLabel}
                {current.rating != null ? ` · ★ ${current.rating.toFixed(1)}` : ''}
                {current.distance && !/não dispon/i.test(current.distance) ? ` · ${current.distance}` : ''}
              </Text>
              {!!current.address && <Text style={styles.heroAddress} numberOfLines={1}>{current.address}</Text>}
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.detailsBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.detailTabs}><Pressable style={[styles.detailTab, section === 'catalog' && styles.detailTabActive]} onPress={() => setSection('catalog')}><Ionicons name="pricetags-outline" size={15} color={section === 'catalog' ? 'white' : theme.ink} /><Text style={[styles.detailTabText, section === 'catalog' && styles.detailTabTextActive]}>Catálogo</Text></Pressable><Pressable style={[styles.detailTab, section === 'info' && styles.detailTabActive]} onPress={() => setSection('info')}><Ionicons name="information-circle-outline" size={16} color={section === 'info' ? 'white' : theme.ink} /><Text style={[styles.detailTabText, section === 'info' && styles.detailTabTextActive]}>Informações</Text></Pressable></View>
    {section === 'info' && <>
      <View style={styles.infoCard}><View style={styles.detailLine}><Ionicons name="location-outline" size={16} color={theme.blue} /><Text style={styles.detailText}>{current.address || 'Endereço não informado'}</Text></View>
      {current.rating != null && <View style={styles.detailLine}><Ionicons name="star" size={15} color="#F59E0B" /><Text style={styles.detailText}>{current.rating.toFixed(1)} {current.reviewsCount ? `(${current.reviewsCount} avaliações)` : ''}</Text></View>}
      {!!current.openStatus && <View style={styles.detailLine}><Ionicons name="time-outline" size={15} color={theme.blue} /><Text style={styles.detailText}>{current.openStatus}</Text></View>}
      {!!current.phoneNumber && <View style={styles.detailLine}><Ionicons name="call-outline" size={15} color={theme.blue} /><Text style={styles.detailText}>{current.phoneNumber}</Text></View>}
      {current.weekdayText?.map(day => <Text key={day} style={styles.hours}>{day}</Text>)}</View>
    </>}
    {!!message && <Text style={styles.error}>{message}</Text>}
    {loading && <ActivityIndicator color={theme.blue} />}
    {section === 'catalog' && <>{productCount > 0 && <View style={styles.catalogSummary}><Ionicons name="bag-handle-outline" size={20} color={theme.ink} /><Text style={styles.catalogSummaryText}>{productCount} {productCount === 1 ? 'produto cadastrado' : 'produtos cadastrados'}</Text></View>}{!loading && productCount === 0 && <View style={styles.catalogEmpty}><Ionicons name="pricetags-outline" size={30} color={theme.muted} /><Text style={styles.emptyTitle}>Nenhum produto cadastrado</Text><Text style={styles.emptyDescription}>Os produtos salvos neste local aparecerão aqui.</Text></View>}{uniqueLocalItems.map(item => {
      const product: CatalogProductInput = { name: item.name, categoryId: item.category_id, price: item.price ?? undefined, unit: item.unit, photoUrl: item.photo_url ?? undefined, ean: item.ean ?? undefined };
      const marked = isInDraft(item.name);
      return <Pressable key={item.id} style={[styles.priceRow, marked && styles.priceRowMarked]} onPress={() => setPreviewItem({ product, subtitle: `Salvo na lista · ${item.quantity} ${item.unit}`, categoryName: categoryFor(item.category_id).name })}>
        <View>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.productPhoto} /> : <View style={styles.productIcon}><CanetoIcon name={item.category_id} size={23} color={theme.blueLight} /></View>}</View>
        <View style={styles.priceName}><Text style={styles.priceTitle}>{item.name}</Text><Text style={styles.priceSub}>Salvo na lista · {item.quantity} {item.unit}</Text>{item.price != null && <Text style={styles.priceValue}>{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {item.unit}</Text>}</View>
        <Pressable style={[styles.listToggleBtn, marked && styles.listToggleBtnActive]} onPress={event => { event.stopPropagation(); toggleDraftItem(product); }} accessibilityRole="button" accessibilityLabel={marked ? `Remover ${item.name} da lista temporária` : `Adicionar ${item.name} à lista temporária`}>
          <Ionicons name={marked ? 'checkmark-circle' : 'list-outline'} size={18} color={marked ? '#FFFFFF' : theme.ink} />
        </Pressable>
      </Pressable>;
    })}
    {remotePrices.map(price => {
      const pKey = productPhotoKey(price);
      const photoUri = remotePhotos[pKey] || undefined;
      const product: CatalogProductInput = { name: price.product_name, categoryId: price.category_id, price: price.price, unit: price.unit, photoUrl: photoUri, ean: price.ean ?? undefined };
      const marked = isInDraft(price.product_name);
      const subtitle = `${price.price_type === 'confirmed' ? '✓ Confirmado por nota' : 'Valor estimado'} · ${new Date(price.observed_at).toLocaleDateString('pt-BR')}`;
      return <Pressable key={price.id} style={[styles.priceRow, marked && styles.priceRowMarked]} onPress={() => setPreviewItem({ product, subtitle, categoryName: categoryFor(price.category_id).name })}>
        <View>{photoUri ? <Image source={{ uri: photoUri }} style={styles.productPhoto} onError={() => setRemotePhotos(prev => ({ ...prev, [pKey]: '' }))} /> : <View style={styles.productIcon}><CanetoIcon name={price.category_id} size={23} color={theme.blueLight} /></View>}</View>
        <View style={styles.priceName}><Text style={styles.priceTitle}>{price.product_name}</Text><Text style={styles.priceSub}>{subtitle}</Text><Text style={styles.priceValue}>{price.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {price.unit}</Text></View>
        <Pressable style={[styles.listToggleBtn, marked && styles.listToggleBtnActive]} onPress={event => { event.stopPropagation(); toggleDraftItem(product); }} accessibilityRole="button" accessibilityLabel={marked ? `Remover ${price.product_name} da lista temporária` : `Adicionar ${price.product_name} à lista temporária`}>
          <Ionicons name={marked ? 'checkmark-circle' : 'list-outline'} size={18} color={marked ? '#FFFFFF' : theme.ink} />
        </Pressable>
      </Pressable>;
    })}</>}
    {!!mapUrl && <Pressable style={styles.secondary} onPress={() => void Linking.openURL(mapUrl)}><Ionicons name="navigate-outline" size={19} color={theme.ink} /><Text style={styles.secondaryText}>Abrir no mapa</Text></Pressable>}
    {!!onSelect && <Pressable style={[styles.primary, selecting && { opacity: 0.6 }]} disabled={selecting} onPress={async () => { setSelecting(true); try { await onSelect(current); } catch (error) { setMessage(getErrorMessage(error)); } finally { setSelecting(false); } }}><Ionicons name="checkmark" size={20} color="white" /><Text style={styles.primaryText}>{selecting ? 'Selecionando...' : 'Selecionar este local'}</Text></Pressable>}
    <Pressable style={styles.closeBottomButton} onPress={requestClose} accessibilityRole="button" accessibilityLabel="Fechar">
      <Text style={styles.closeBottomText}>Fechar</Text>
    </Pressable>
        </ScrollView>
        {draftItems.length > 0 && (
          <View style={styles.draftBar}>
            <View style={styles.draftBarInfo}>
              <Text style={styles.draftBarCount}>{draftItems.length} {draftItems.length === 1 ? 'item marcado' : 'itens marcados'}</Text>
              <Text style={styles.draftBarStore} numberOfLines={1}>{current.name}</Text>
            </View>
            <Pressable
              style={styles.draftBarButton}
              onPress={() => {
                if (onImportItems) {
                  setImportModalOpen(true);
                } else if (onAddProduct) {
                  void Promise.all(draftItems.map(item => onAddProduct(item))).then(() => { setDraftItems([]); onClose(); });
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Importar itens marcados para lista"
            >
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.draftBarButtonText}>Importar lista</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>

    <Modal visible={!!previewItem} transparent animationType="fade" onRequestClose={() => setPreviewItem(null)} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.detailsOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewItem(null)} accessibilityRole="button" accessibilityLabel="Fechar pré-visualização" />
        {!!previewItem && (
          <View style={styles.previewSheet}>
            <View style={styles.previewBody}>
              <View style={styles.previewMediaWrap}>
                {previewItem.product.photoUrl ? (
                  <Image source={{ uri: previewItem.product.photoUrl }} style={styles.previewPhoto} resizeMode="contain" />
                ) : (
                  <View style={styles.previewIconFallback}>
                    <CanetoIcon name={previewItem.product.categoryId} size={46} color={theme.blueLight} />
                  </View>
                )}
              </View>
              <Text style={styles.previewCategory}>{previewItem.categoryName}</Text>
              <Text style={styles.previewTitle}>{previewItem.product.name}</Text>
              {previewItem.product.price != null && (
                <Text style={styles.previewPrice}>
                  {previewItem.product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {previewItem.product.unit || 'un'}
                </Text>
              )}
              <Text style={styles.previewSub}>{previewItem.subtitle}</Text>
              {!!previewItem.product.ean && <Text style={styles.previewEan}>EAN: {previewItem.product.ean}</Text>}
            </View>
            <View style={styles.previewFooter}>
              <Pressable
                style={styles.primary}
                onPress={() => {
                  const chosen = previewItem.product;
                  if (onAddProduct) {
                    void Promise.resolve(onAddProduct(chosen));
                    setPreviewItem(null);
                  } else {
                    if (!isInDraft(chosen.name)) {
                      setDraftItems(prev => [...prev, chosen]);
                    }
                    setPreviewItem(null);
                    if (onImportItems) setImportModalOpen(true);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Adicionar à lista"
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Adicionar à lista</Text>
              </Pressable>
              <Pressable style={styles.closeBottomButton} onPress={() => setPreviewItem(null)} accessibilityRole="button" accessibilityLabel="Fechar">
                <Text style={styles.closeBottomText}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>

    <Modal visible={importModalOpen} transparent animationType="fade" onRequestClose={() => setImportModalOpen(false)} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.detailsOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setImportModalOpen(false)} accessibilityRole="button" accessibilityLabel="Fechar importação" />
        <View style={styles.previewSheet}>
          <View style={styles.importHeader}>
            <Text style={styles.importTitle}>Importar {draftItems.length} {draftItems.length === 1 ? 'item' : 'itens'}</Text>
            <Text style={styles.importSubtitle}>Escolha uma lista salva ou crie uma nova para {current.name}</Text>
          </View>
          <ScrollView style={styles.importScroll} contentContainerStyle={styles.importBody} keyboardShouldPersistTaps="handled">
            <View style={styles.importSection}>
              <Text style={styles.importLabel}>Criar nova lista</Text>
              <TextInput
                style={styles.importInput}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="Nome da nova lista"
                placeholderTextColor={theme.muted}
                maxLength={80}
              />
              <Pressable style={[styles.primary, importing && { opacity: 0.6 }]} disabled={importing} onPress={() => void runImport('new')}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>{importing ? 'Importando...' : 'Criar nova lista e importar'}</Text>
              </Pressable>
            </View>
            {availableLists.length > 0 && (
              <View style={styles.importSection}>
                <Text style={styles.importLabel}>Ou importar para lista salva</Text>
                {availableLists.map(target => (
                  <Pressable key={target.id} style={styles.importListRow} disabled={importing} onPress={() => void runImport(target.id)}>
                    <Ionicons name="list-outline" size={18} color={theme.blueLight} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.importListName} numberOfLines={1}>{target.name}</Text>
                      {target.itemCount != null && <Text style={styles.importListCount}>{target.itemCount} {target.itemCount === 1 ? 'item' : 'itens'}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={styles.previewFooter}>
            <Pressable style={styles.closeBottomButton} disabled={importing} onPress={() => setImportModalOpen(false)}>
              <Text style={styles.closeBottomText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <ConfirmModal
      visible={confirmLeaveOpen}
      title="Vai sair sem salvar os itens que marcou?"
      message={`Você marcou ${draftItems.length} ${draftItems.length === 1 ? 'item' : 'itens'} em ${current.name}.`}
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar aqui"
      danger
      onCancel={() => setConfirmLeaveOpen(false)}
      onConfirm={() => {
        setConfirmLeaveOpen(false);
        setDraftItems([]);
        onClose();
      }}
    />
  </Modal>;
}

function StoreCard({ store, selected, onPress, picker }: { store: Store; selected: boolean; onPress: () => void; picker: boolean }) {
  return <Pressable onPress={onPress} style={[styles.card, picker && styles.cardCompact, selected && styles.cardSelected]} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${store.name}`}>
    <View style={styles.cardHeader}>
      {store.thumbnailUrl ? <Image source={{ uri: store.thumbnailUrl }} style={picker ? styles.thumbnailCompact : styles.thumbnail} /> : <View style={picker ? styles.thumbnailFallbackCompact : styles.thumbnailFallback}><Ionicons name="storefront-outline" size={picker ? 18 : 22} color="white" /></View>}
      <View style={styles.cardContent}>
        <Text style={picker ? styles.cardNameCompact : styles.cardName} numberOfLines={picker ? 2 : 1}>{store.name}</Text>
        <Text style={styles.metaLine} numberOfLines={1}>
          <Text style={styles.cardCategory}>{store.categoryLabel}</Text>
          {store.rating != null && <Text style={styles.cardRating}> · ★ {store.rating.toFixed(1)}</Text>}
          {!!store.distance && <Text style={styles.cardDistance}> · {store.distance}</Text>}
        </Text>
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={20} color={theme.blueLight} />
    </View>
    {!!store.address && <View style={styles.addressRow}><Ionicons name="location-outline" size={14} color={theme.blueLight} /><Text style={picker ? styles.cardAddressCompact : styles.cardAddress} numberOfLines={picker ? 1 : 2}>{store.address}</Text></View>}
  </Pressable>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  explorer: { flex: 1, minHeight: 340, backgroundColor: theme.background },
  pickerExplorer: { backgroundColor: theme.background, borderRadius: 14, overflow: 'hidden' },
  pickerBody: { marginHorizontal: -6 },
  pickerScroll: { maxHeight: 360 },
  pickerResults: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 8, gap: 8 },
  floating: { position: 'absolute', alignSelf: 'center', zIndex: 20 },
  createStore: { borderRadius: theme.radius.xxl, paddingHorizontal: 20, elevation: 6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 15, minHeight: 46, paddingHorizontal: 13 },
  searchBoxPicker: { marginHorizontal: 4, marginTop: 8, marginBottom: 2 },
  searchInput: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15, paddingVertical: 8 },
  categories: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 }, chip: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 13, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 7 }, chipActive: { borderColor: theme.blue, backgroundColor: theme.blue }, chipText: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 13 }, chipTextActive: { color: 'white' },
  resultsHeading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 8 }, resultsTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  results: { paddingHorizontal: 16, paddingBottom: 112, gap: 10 }, loader: { marginVertical: 8 }, pickerFooter: { backgroundColor: theme.surfaceMuted, borderTopWidth: 1, borderTopColor: theme.border, paddingBottom: 12 },
  notice: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: theme.dangerSoft }, noticeText: { fontFamily: theme.font.regular, color: theme.danger }, retry: { fontFamily: theme.font.semibold, color: theme.blueLight, marginTop: 7 },
  empty: { alignItems: 'center', padding: 28, gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface }, emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 16, textAlign: 'center' }, emptyDescription: { textAlign: 'center', fontFamily: theme.font.regular, color: theme.muted, fontSize: 14, lineHeight: 21 },
  card: { padding: 13, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, gap: 8 },
  cardCompact: { padding: 11, borderRadius: 14, gap: 6 },
  cardSelected: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumbnail: { width: 48, height: 48, borderRadius: 14 }, thumbnailFallback: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  thumbnailCompact: { width: 38, height: 38, borderRadius: 12 }, thumbnailFallbackCompact: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 }, cardName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 }, cardNameCompact: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14, lineHeight: 19 }, metaLine: { marginTop: 2 }, cardCategory: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 12 }, cardDistance: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 12 }, addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, cardAddress: { flex: 1, color: theme.inkStrong, fontFamily: theme.font.regular, fontSize: 13, lineHeight: 18 }, cardAddressCompact: { flex: 1, color: theme.inkStrong, fontFamily: theme.font.regular, fontSize: 12 }, cardRating: { color: theme.warning, fontFamily: theme.font.semibold, fontSize: 12 },
  viewButton: { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }, viewButtonText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  linkedBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, marginBottom: 7, borderWidth: 1, borderColor: theme.success, borderRadius: 16, backgroundColor: theme.successSoft }, linkedIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }, linkedCopy: { flex: 1 }, linkedEyebrow: { color: theme.success, fontFamily: theme.font.bold, fontSize: 11 }, linkedName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 }, linkedText: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 12 },
  detailsOverlay: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', paddingHorizontal: theme.dialog.horizontalMargin, paddingVertical: 16 },
  detailsSheet: { width: '100%', maxWidth: theme.dialog.maxWidth, maxHeight: '90%', alignSelf: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.xxl, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  heroHeader: { position: 'relative', minHeight: 92, borderBottomWidth: 1, borderBottomColor: theme.border, justifyContent: 'center', overflow: 'hidden' },
  heroImageWrap: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '44%' },
  heroImage: { width: '100%', height: '100%' },
  heroContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  heroCopy: { flex: 1, minWidth: 0, gap: 3 },
  heroTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16, lineHeight: 21 },
  heroSubtitle: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 12 },
  heroAddress: { color: theme.ink, opacity: 0.78, fontFamily: theme.font.semibold, fontSize: 11 },
  heroClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  detailsBody: { padding: 14, paddingBottom: 18 },
  headerThumb: { width: '100%', height: '100%', borderRadius: 14 },
  detailTabs: { flexDirection: 'row', gap: 6, marginBottom: 10 }, detailTab: { flex: 1, minHeight: 36, borderRadius: 10, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, detailTabActive: { backgroundColor: theme.blue, borderColor: theme.blue }, detailTabText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 }, detailTabTextActive: { color: 'white' },
  hero: { width: '100%', height: 150, borderRadius: 12, marginBottom: 14 }, infoCard: { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 11 }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }, detailText: { flex: 1, color: theme.ink, fontFamily: theme.font.regular, fontSize: 12, lineHeight: 17 }, hours: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  catalogSummary: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, borderRadius: 10, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, marginBottom: 9 }, catalogSummaryText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 }, catalogEmpty: { alignItems: 'center', padding: 16, gap: 6 }, productIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }, productPhoto: { width: 38, height: 38, borderRadius: 10 }, priceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderWidth: 1, borderColor: theme.border, borderRadius: 12, marginBottom: 7, backgroundColor: theme.surface }, priceRowMarked: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, listToggleBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, listToggleBtnActive: { backgroundColor: theme.blue, borderColor: theme.blue }, priceName: { flex: 1 }, priceTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 }, priceSub: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 10 }, priceValue: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 13, marginTop: 2 },
  draftBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surfaceMuted },
  draftBarInfo: { flex: 1 },
  draftBarCount: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  draftBarStore: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  draftBarButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.blue, borderRadius: 11, paddingHorizontal: 13, minHeight: 38, justifyContent: 'center' },
  draftBarButtonText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },
  previewSheet: { width: '100%', maxWidth: theme.dialog.maxWidth, maxHeight: '86%', alignSelf: 'center', backgroundColor: theme.surface, borderRadius: theme.radius.xxl, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  previewBody: { alignItems: 'center', padding: 18, gap: 6 },
  previewMediaWrap: { width: 112, height: 112, borderRadius: 18, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  previewPhoto: { width: '100%', height: '100%' },
  previewIconFallback: { alignItems: 'center', justifyContent: 'center' },
  previewCategory: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 12 },
  previewTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 17, textAlign: 'center', lineHeight: 22 },
  previewPrice: { color: theme.blueLight, fontFamily: theme.font.bold, fontSize: 18, marginTop: 2 },
  previewSub: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12, textAlign: 'center' },
  previewEan: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 11 },
  previewFooter: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surface },
  importHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'center', gap: 3 },
  importTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 17, textAlign: 'center' },
  importSubtitle: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12, textAlign: 'center' },
  importScroll: { maxHeight: 320 },
  importBody: { padding: 14, gap: 14 },
  importSection: { gap: 8 },
  importLabel: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  importInput: { minHeight: 44, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, paddingHorizontal: 12, fontFamily: theme.font.semibold, fontSize: 14 },
  importListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  importListName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  importListCount: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  secondary: { width: '100%', backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 }, secondaryText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  primary: { width: '100%', backgroundColor: theme.blue, borderRadius: 12, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8 }, primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 13 },
  closeBottomButton: { width: '100%', borderRadius: 12, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger }, closeBottomText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 13 },
  error: { color: theme.danger, fontFamily: theme.font.regular, padding: 8 }, unlink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft }, unlinkText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 11 },
}));
