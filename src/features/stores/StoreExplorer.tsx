import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { getErrorMessage } from '../../ui/error';
import { STORE_CATEGORIES, normalizeStoreText, type Coordinates, type Store, type StoreCategory, type StorePrice } from './model';
import { linkStoreToList, loadStoreDetails, loadStorePrices, searchStores } from './repository';
import { OsmMap } from './OsmMap';
import { NewStoreModal } from './NewStoreModal';
import { useDeviceLocation } from './useDeviceLocation';
import type { Item } from '../../data';

type ExplorerProps = { onSelectStore?: (store: Store) => void | Promise<void>; coordinates?: Coordinates; selectedStoreId?: string; savedStores?: Store[]; savedCatalog?: Record<string, Item[]>; mode?: 'explore' | 'picker' };

export function StoreExplorer({ onSelectStore, coordinates, selectedStoreId, savedStores = [], savedCatalog, mode = 'explore' }: ExplorerProps) {
  const device = useDeviceLocation(!coordinates);
  const activeCoordinates = coordinates ?? device.coords ?? undefined;
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<StoreCategory>('all');
  const [stores, setStores] = useState<Store[]>([]);
  const [selected, setSelected] = useState<Store | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lat = activeCoordinates?.lat;
  const lng = activeCoordinates?.lng;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      searchStores(query, category, lat != null && lng != null ? { lat, lng } : undefined, mode === 'explore').then(rows => { if (active) setStores(rows); })
        .catch(reason => { if (active) setError(getErrorMessage(reason)); })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, category, lat, lng, retry, mode]);

  const featured = useMemo(() => {
    const local = mode === 'explore' ? savedStores.filter(store =>
      (category === 'all' || store.category === category)
      && (!query || normalizeStoreText(`${store.name} ${store.address}`).includes(normalizeStoreText(query)))) : [];
    return [...new Map([...local, ...stores].map(store => [store.id, store])).values()].slice(0, 80);
  }, [stores, savedStores, mode, category, query]);
  const searchControl = <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={theme.blue} /><TextInput style={styles.searchInput} placeholder={mode === 'picker' ? 'Buscar supermercado, atacadista, endereço...' : 'Busque um local ou loja'} placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} returnKeyType="search" accessibilityLabel="Buscar locais" />{!!query && <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')}><Ionicons name="close" size={18} color={theme.muted} /></Pressable>}</View>;
  const categoryControl = <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{STORE_CATEGORIES.map(entry => <Pressable key={entry.id} style={[styles.chip, category === entry.id && styles.chipActive]} onPress={() => setCategory(entry.id)} accessibilityRole="button" accessibilityState={{ selected: category === entry.id }}><CanetoIcon name={entry.id} size={19} color={category === entry.id ? 'white' : theme.blue} /><Text style={[styles.chipText, category === entry.id && styles.chipTextActive]}>{entry.label}</Text></Pressable>)}</ScrollView>;
  const markers = featured.flatMap(store => store.lat != null && store.lon != null ? [{ id: store.id, name: store.name, lat: store.lat, lng: store.lon }] : []);
  return <View style={styles.explorer}>
    {mode === 'explore' && <OsmMap user={activeCoordinates} markers={markers} onSelect={id => setSelected(featured.find(store => store.id === id) ?? null)} />}
    {mode === 'explore' && !!device.message && <Text style={styles.noticeText}>{device.message}</Text>}
    {mode === 'explore' && searchControl}
    {mode === 'explore' && categoryControl}
    <View style={styles.resultsHeading}><Ionicons name="storefront-outline" size={19} color={theme.blue} /><Text style={styles.resultsTitle}>{query || !activeCoordinates ? 'Locais encontrados' : 'Locais próximos encontrados'} ({featured.length})</Text>{loading && <ActivityIndicator size="small" color={theme.blue} />}</View>
    {loading && <ActivityIndicator style={styles.loader} color={theme.blue} />}
    {!!error && <View style={styles.notice}><Text style={styles.noticeText}>{error}</Text><Pressable onPress={() => setRetry(value => value + 1)}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View>}
    <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
      {!loading && !featured.length && !error && <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={28} color={theme.blue} /></View><Text style={styles.emptyTitle}>{query ? `Nenhum local com produtos salvos para “${query}”` : 'Nenhum local com produtos salvos'}</Text><Text style={styles.emptyDescription}>Aqui aparecem apenas lojas com produtos e preços cadastrados. Escaneie uma compra para iniciar o catálogo.</Text></View>}
      {featured.map(store => <StoreCard key={store.id} store={store} selected={store.id === selectedStoreId} onPress={() => { if (mode === 'picker' && onSelectStore) void Promise.resolve(onSelectStore(store)).catch(reason => setError(getErrorMessage(reason))); else setSelected(store); }} onDetails={() => setSelected(store)} picker={mode === 'picker'} />)}
    </ScrollView>
    {mode === 'explore' && <Pressable style={styles.createStore} onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel="Cadastrar novo local"><Ionicons name="add" size={20} color="white" /><Text style={styles.createStoreText}>Novo Local</Text></Pressable>}
    {mode === 'picker' && <View style={styles.pickerFooter}>{categoryControl}{searchControl}</View>}
    <StoreDetailsModal visible={!!selected} store={selected} localItems={selected ? savedCatalog?.[selected.id] : undefined} onClose={() => setSelected(null)} onSelect={onSelectStore ? async store => { await onSelectStore(store); setSelected(null); } : undefined} />
    <NewStoreModal visible={creating} onClose={() => setCreating(false)} />
  </View>;
}

type StorePickerProps = { visible: boolean; listId: string; onClose: () => void; onLinked?: () => void | Promise<void>; coordinates?: Coordinates; selectedStoreId?: string; selectedStoreName?: string };
export function StorePickerModal(props: StorePickerProps) {
  return props.visible ? <StorePickerDialog key={props.listId} {...props} /> : null;
}

function StorePickerDialog({ listId, onClose, onLinked, coordinates, selectedStoreId, selectedStoreName }: StorePickerProps) {
  const [message, setMessage] = useState('');
  return <ModalSheet visible title="Vincular Loja à Lista" subtitle="Selecione o estabelecimento para sua lista de compras" onClose={onClose}>
    <View style={styles.pickerBody}>
      {!!message && <Text style={styles.error}>{message}</Text>}
      {selectedStoreId && <View style={styles.linkedBanner}><View style={styles.linkedIcon}><Ionicons name="checkmark" size={22} color={theme.success} /></View><View style={styles.linkedCopy}><Text style={styles.linkedEyebrow}>LOJA VINCULADA ATUAL</Text>{!!selectedStoreName && <Text style={styles.linkedName} numberOfLines={1}>{selectedStoreName}</Text>}<Text style={styles.linkedText}>Selecione outra loja abaixo para trocar.</Text></View><Pressable style={styles.unlink} onPress={async () => { try { await linkStoreToList(listId, null); await onLinked?.(); onClose(); } catch (error) { setMessage(getErrorMessage(error)); } }}><Ionicons name="close" size={16} color={theme.danger} /><Text style={styles.unlinkText}>Desvincular</Text></Pressable></View>}
      <StoreExplorer mode="picker" coordinates={coordinates} selectedStoreId={selectedStoreId} onSelectStore={async store => { try { setMessage(''); await linkStoreToList(listId, store); await onLinked?.(); onClose(); } catch (error) { setMessage(getErrorMessage(error)); throw error; } }} />
    </View>
  </ModalSheet>;
}

export function StoreDetailsModal({ visible, store, localItems, onClose, onSelect }: { visible: boolean; store: Store | null; localItems?: Item[]; onClose: () => void; onSelect?: (store: Store) => void | Promise<void> }) {
  return visible && store ? <StoreDetailsDialog key={store.id} store={store} localItems={localItems ?? []} onClose={onClose} onSelect={onSelect} /> : null;
}

function StoreDetailsDialog({ store, localItems, onClose, onSelect }: { store: Store; localItems: Item[]; onClose: () => void; onSelect?: (store: Store) => void | Promise<void> }) {
  const [details, setDetails] = useState<Store>(store);
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [section, setSection] = useState<'catalog' | 'info'>('catalog');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [message, setMessage] = useState('');
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
  const productCount = uniqueLocalItems.length + remotePrices.length;
  const mapUrl = current.googleMapsUrl || (current.lat != null && current.lon != null ? `https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lon}` : '');
  return <ModalSheet visible title={current.name} subtitle={current.categoryLabel} onClose={onClose}>
    <View style={styles.detailsBanner}><View style={styles.detailsBannerIcon}><Ionicons name="storefront-outline" size={24} color="white" /></View><View style={styles.detailsBannerCopy}><Text style={styles.detailsBannerName} numberOfLines={1}>{current.name}</Text><Text style={styles.detailsBannerMeta}>{current.categoryLabel}{current.distance ? ` · ${current.distance}` : ''}</Text></View></View>
    <View style={styles.detailTabs}><Pressable style={[styles.detailTab, section === 'catalog' && styles.detailTabActive]} onPress={() => setSection('catalog')}><Ionicons name="pricetags-outline" size={17} color={section === 'catalog' ? 'white' : theme.blue} /><Text style={[styles.detailTabText, section === 'catalog' && styles.detailTabTextActive]}>Catálogo</Text></Pressable><Pressable style={[styles.detailTab, section === 'info' && styles.detailTabActive]} onPress={() => setSection('info')}><Ionicons name="information-circle-outline" size={18} color={section === 'info' ? 'white' : theme.blue} /><Text style={[styles.detailTabText, section === 'info' && styles.detailTabTextActive]}>Informações</Text></Pressable></View>
    {section === 'info' && <>
      {!!current.thumbnailUrl && <Image source={{ uri: current.thumbnailUrl }} style={styles.hero} resizeMode="cover" />}
      <View style={styles.infoCard}><View style={styles.detailLine}><Ionicons name="location-outline" size={19} color={theme.blue} /><Text style={styles.detailText}>{current.address || 'Endereço não informado'}{current.distance ? ` · ${current.distance}` : ''}</Text></View>
      {current.rating != null && <View style={styles.detailLine}><Ionicons name="star" size={18} color="#F59E0B" /><Text style={styles.detailText}>{current.rating.toFixed(1)} {current.reviewsCount ? `(${current.reviewsCount} avaliações)` : ''}</Text></View>}
      {!!current.openStatus && <View style={styles.detailLine}><Ionicons name="time-outline" size={18} color={theme.blue} /><Text style={styles.detailText}>{current.openStatus}</Text></View>}
      {!!current.phoneNumber && <View style={styles.detailLine}><Ionicons name="call-outline" size={18} color={theme.blue} /><Text style={styles.detailText}>{current.phoneNumber}</Text></View>}
      {current.weekdayText?.map(day => <Text key={day} style={styles.hours}>{day}</Text>)}</View>
    </>}
    {!!message && <Text style={styles.error}>{message}</Text>}
    {loading && <ActivityIndicator color={theme.blue} />}
    {section === 'catalog' && <><View style={styles.catalogSummary}><Ionicons name="bag-handle-outline" size={20} color={theme.blue} /><Text style={styles.catalogSummaryText}>{productCount} {productCount === 1 ? 'produto cadastrado' : 'produtos cadastrados'}</Text></View>{!loading && productCount === 0 && <View style={styles.catalogEmpty}><Ionicons name="pricetags-outline" size={30} color={theme.blue} /><Text style={styles.emptyTitle}>Nenhum produto cadastrado</Text><Text style={styles.emptyDescription}>Os produtos salvos neste local aparecerão aqui.</Text></View>}{uniqueLocalItems.map(item => <View key={item.id} style={styles.priceRow}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.productPhoto} /> : <View style={styles.productIcon}><CanetoIcon name={item.category_id} size={23} color={theme.blue} /></View>}<View style={styles.priceName}><Text style={styles.priceTitle}>{item.name}</Text><Text style={styles.priceSub}>Salvo na lista · {item.quantity} {item.unit}</Text>{item.price != null && <Text style={styles.priceValue}>{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {item.unit}</Text>}</View></View>)}{remotePrices.map(price => <View key={price.id} style={styles.priceRow}><View style={styles.productIcon}><CanetoIcon name={price.category_id} size={23} color={theme.blue} /></View><View style={styles.priceName}><Text style={styles.priceTitle}>{price.product_name}</Text><Text style={styles.priceSub}>{price.price_type === 'confirmed' ? '✓ Confirmado por nota' : 'Valor estimado'} · {new Date(price.observed_at).toLocaleDateString('pt-BR')}</Text><Text style={styles.priceValue}>{price.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {price.unit}</Text></View></View>)}</>}
    {!!mapUrl && <Pressable style={styles.secondary} onPress={() => void Linking.openURL(mapUrl)}><Ionicons name="navigate-outline" size={19} color={theme.blue} /><Text style={styles.secondaryText}>Abrir no mapa</Text></Pressable>}
    {!!onSelect && <Pressable style={[styles.primary, selecting && { opacity: 0.6 }]} disabled={selecting} onPress={async () => { setSelecting(true); try { await onSelect(current); } catch (error) { setMessage(getErrorMessage(error)); } finally { setSelecting(false); } }}><Ionicons name="checkmark" size={20} color="white" /><Text style={styles.primaryText}>{selecting ? 'Selecionando...' : 'Selecionar este local'}</Text></Pressable>}
  </ModalSheet>;
}

function StoreCard({ store, selected, onPress, onDetails, picker }: { store: Store; selected: boolean; onPress: () => void; onDetails: () => void; picker: boolean }) {
  return <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]} accessibilityRole="button" accessibilityLabel={`${picker ? 'Selecionar' : 'Ver detalhes de'} ${store.name}`}>
    <View style={styles.cardHeader}>
      {store.thumbnailUrl ? <Image source={{ uri: store.thumbnailUrl }} style={styles.thumbnail} /> : <View style={styles.thumbnailFallback}><Ionicons name="storefront-outline" size={22} color="white" /></View>}
      <View style={styles.cardContent}><Text style={styles.cardName} numberOfLines={1}>{store.name}</Text><View style={styles.metaRow}><Text style={styles.cardCategory}>{store.categoryLabel}</Text>{store.rating != null && <Text style={styles.cardRating}>★ {store.rating.toFixed(1)}</Text>}{store.distance && <Text style={styles.cardDistance}>· {store.distance}</Text>}</View></View>
      {picker ? <Pressable style={styles.viewButton} onPress={event => { event.stopPropagation(); onDetails(); }} accessibilityLabel={`Ver detalhes de ${store.name}`}><Text style={styles.viewButtonText}>Ver</Text></Pressable> : <Ionicons name="chevron-forward" size={20} color={theme.blue} />}
      {selected && <Ionicons name="checkmark-circle" size={21} color={theme.blue} />}
    </View>
    {!!store.address && <View style={styles.addressRow}><Ionicons name="location-outline" size={16} color={theme.blue} /><Text style={styles.cardAddress} numberOfLines={2}>{store.address}</Text></View>}
  </Pressable>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  explorer: { flex: 1, minHeight: 340, backgroundColor: theme.background }, pickerBody: { height: 530 },
  createStore: { position: 'absolute', bottom: 104, alignSelf: 'center', minHeight: 48, borderRadius: 24, backgroundColor: theme.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22, elevation: 8, zIndex: 20 }, createStoreText: { color: 'white', fontFamily: theme.font.bold },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 16, minHeight: 48, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15, paddingVertical: 8 },
  categories: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 }, chip: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 13, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 7 }, chipActive: { borderColor: theme.blue, backgroundColor: theme.blue }, chipText: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 13 }, chipTextActive: { color: 'white' },
  resultsHeading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12 }, resultsTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  results: { paddingHorizontal: 16, paddingBottom: 112, gap: 12 }, loader: { marginVertical: 8 }, pickerFooter: { backgroundColor: theme.surfaceMuted, borderTopWidth: 1, borderTopColor: theme.border, paddingBottom: 12 },
  notice: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: theme.dangerSoft }, noticeText: { fontFamily: theme.font.regular, color: theme.danger }, retry: { fontFamily: theme.font.semibold, color: theme.blue, marginTop: 7 },
  empty: { alignItems: 'center', padding: 28, gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface }, emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 16, textAlign: 'center' }, emptyDescription: { textAlign: 'center', fontFamily: theme.font.regular, color: theme.muted, fontSize: 14, lineHeight: 21 },
  card: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, gap: 10 }, cardSelected: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 48, height: 48, borderRadius: 16 }, thumbnailFallback: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 }, cardName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, cardCategory: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 13 }, cardDistance: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 13 }, addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, cardAddress: { flex: 1, color: theme.ink, fontFamily: theme.font.regular, fontSize: 14 }, cardRating: { color: theme.warning, fontFamily: theme.font.semibold, fontSize: 13 },
  viewButton: { backgroundColor: theme.blueSoft, borderWidth: 1, borderColor: '#B9C9FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }, viewButtonText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13 },
  linkedBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, marginBottom: 7, borderWidth: 1, borderColor: '#A7E6CB', borderRadius: 16, backgroundColor: theme.successSoft }, linkedIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }, linkedCopy: { flex: 1 }, linkedEyebrow: { color: theme.success, fontFamily: theme.font.bold, fontSize: 11 }, linkedName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 }, linkedText: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 12 },
  detailsBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: theme.blue, marginBottom: 12 }, detailsBannerIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.17)', alignItems: 'center', justifyContent: 'center' }, detailsBannerCopy: { flex: 1 }, detailsBannerName: { color: 'white', fontFamily: theme.font.bold, fontSize: 17 }, detailsBannerMeta: { color: '#E8EEFF', fontFamily: theme.font.regular, fontSize: 13 },
  detailTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 }, detailTab: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: theme.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, detailTabActive: { backgroundColor: theme.blue }, detailTabText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13 }, detailTabTextActive: { color: 'white' },
  hero: { width: '100%', height: 150, borderRadius: 12, marginBottom: 14 }, infoCard: { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14 }, detailLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, detailText: { flex: 1, color: theme.ink, fontFamily: theme.font.regular, fontSize: 14 }, hours: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12 },
  catalogSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: theme.blueSoft, marginBottom: 12 }, catalogSummaryText: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 14 }, catalogEmpty: { alignItems: 'center', padding: 22, gap: 7 }, productIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surfaceMuted, justifyContent: 'center', alignItems: 'center' }, productPhoto: { width: 44, height: 44, borderRadius: 12 }, priceRow: { flexDirection: 'row', gap: 10, padding: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 15, marginBottom: 9, backgroundColor: theme.surface }, priceName: { flex: 1 }, priceTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 }, priceSub: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 11 }, priceValue: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 14, marginTop: 3 },
  secondary: { width: '100%', borderWidth: 1, borderColor: theme.blue, borderRadius: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }, secondaryText: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 15 },
  primary: { width: '100%', backgroundColor: theme.blue, borderRadius: 14, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }, primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 15 },
  error: { color: theme.danger, fontFamily: theme.font.regular, padding: 8 }, unlink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFE4E6' }, unlinkText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 11 },
}));
