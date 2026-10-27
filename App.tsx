import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text as NativeText, TextInput, useColorScheme, View, type TextProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import type { Session } from '@supabase/supabase-js';
import { addItem, addScannedItem, createList, loadLists, setItemChecked, type Item, type List } from './src/data';
import { supabase } from './src/supabase';
import { theme } from './src/ui/theme';
import { NewListModal, ItemEditModal } from './src/features/lists/ListModals';
import { ListEditModal } from './src/features/lists/ListEditModal';
import { duplicateList, removeItem, removeList, renameList, saveItemChanges, setListCompleted } from './src/features/lists/repository';
import { JoinListModal, ShareListModal } from './src/features/sharing/SharingModals';
import { joinListByCode } from './src/features/sharing/repository';
import { ProfileModal } from './src/features/profile/ProfileModal';
import { HistoryModal, PaymentModal } from './src/features/purchases/PurchaseModals';
import { finishPurchase, recreatePurchase, type PurchaseReceipt } from './src/features/purchases/repository';
import { StoreExplorer, StorePickerModal } from './src/features/stores/StoreExplorer';
import { ListsOverview } from './src/features/lists/ListsOverview';
import type { DeletedShoppingItem, Profile, Purchase, ShoppingItem, ShoppingList } from './src/core/models/caneto';
import { canetoData } from './src/core/data/supabaseAdapter';
import { AccountAuthActions } from './src/features/account/AccountAuthActions';
import { ShoppingListScreen } from './src/features/cart/ShoppingListScreen';
import { CanetoIcon } from './src/ui/CanetoIcon';
import { SocialScreen, type SocialFriend, type SocialInvitation, type SocialSearchResult } from './src/features/social/SocialScreen';
import {
  acceptFriendRequest,
  acceptListInvitation,
  cancelFriendRequest,
  declineFriendRequest,
  declineListInvitation,
  loadSocialData,
  searchSocialUsers,
  sendFriendRequest,
  type SocialDataProps,
} from './src/features/social/repository';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import type { SettingsPreferences } from './src/features/settings/SettingsScreen';
import { updatePreferences } from './src/features/account/profile';
import { TrashModal } from './src/features/cart/TrashModal';
import { addTrashItem, clearTrash, deleteItemFromDatabase, getValidTrash, removeTrashItem, restoreItemToDatabase } from './src/features/cart/trashRepository';
import { getErrorMessage } from './src/ui/error';
import { checkAppUpdate, CURRENT_APP_VERSION, IS_EXPO_GO, type AppReleaseInfo } from './src/features/updater/updaterService';
import { UpdateModal } from './src/features/updater/UpdateModal';
import { ScannerModal } from './src/features/capture/ScannerModal';
import { bindSyncUser, flushOutbox, subscribeSync, watchConnectivity } from './src/core/sync/outbox';
import { subscribeShoppingChanges } from './src/core/sync/realtime';

const green = theme.blue;
const errorMessage = (error: unknown) => Alert.alert('Não foi possível continuar', getErrorMessage(error));
const Text = ({ style, ...props }: TextProps) => <NativeText {...props} style={[{ fontFamily: theme.font.regular }, style]} />;

export default function App() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold });
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [lists, setLists] = useState<List[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [socialData, setSocialData] = useState<SocialDataProps | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState(false);
  const [socialSearch, setSocialSearch] = useState('');
  const [socialResults, setSocialResults] = useState<SocialSearchResult[]>([]);
  const [socialSearching, setSocialSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'lists' | 'stores' | 'social' | 'settings'>('lists');
  const [modal, setModal] = useState<'new' | 'list' | 'item' | 'join' | 'share' | 'profile' | 'payment' | 'history' | 'store' | 'trash' | null>(null);
  const [modalListId, setModalListId] = useState<string | null>(null);
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [deletedToastItem, setDeletedToastItem] = useState<ShoppingItem | null>(null);
  const [trashItems, setTrashItems] = useState<DeletedShoppingItem[]>([]);
  const [updateInfo, setUpdateInfo] = useState<AppReleaseInfo | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [syncText, setSyncText] = useState('');
  const pendingDeletedItemRef = useRef<{ item: ShoppingItem; listId: string } | null>(null);

  const refresh = useCallback(async (userId: string) => setLists(await loadLists(userId)), []);

  useEffect(() => {
    checkAppUpdate().then(info => {
      if (info?.hasUpdate) {
        setUpdateInfo(info);
        setUpdateModalVisible(true);
      }
    }).catch(console.warn);
  }, []);

  useEffect(() => {
    if (selectedId) setTrashItems(getValidTrash(selectedId));
    else setTrashItems([]);
  }, [selectedId, lists]);
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => { if (error) throw error; setSession(data.session); })
      .catch(errorMessage)
      .finally(() => setStarting(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setLists([]); setProfile(null); setPurchases([]); setSocialData(null); setSelectedId(null); setTab('lists'); }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => subscribeSync(meta => {
    if (!meta.online) setSyncText(meta.pending ? `Sem conexão · ${meta.pending} alteração(ões) na fila` : 'Sem conexão · mostrando o que já está neste aparelho');
    else if (meta.flushing || meta.pending) setSyncText(meta.pending ? `Sincronizando ${meta.pending} alteração(ões) com o Supabase` : 'Sincronizando com o Supabase');
    else setSyncText(meta.lastError ? `Sincronização pendente: ${meta.lastError}` : '');
  }), []);
  useEffect(() => {
    if (!session) return;
    bindSyncUser(session.user.id);
    void refresh(session.user.id).catch(errorMessage);
    const stopNet = watchConnectivity(() => { void flushOutbox().then(() => refresh(session.user.id)).catch(() => undefined); });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopRemote = subscribeShoppingChanges(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(session.user.id).catch(() => undefined); }, 800);
    });
    return () => { stopNet(); stopRemote(); if (timer) clearTimeout(timer); };
  }, [session?.user.id, refresh]);
  useEffect(() => {
    if (!session || tab !== 'settings') return;
    let active = true;
    Promise.all([canetoData.profile(session.user.id), canetoData.purchases(session.user.id)])
      .then(([nextProfile, nextPurchases]) => { if (active) { setProfile(nextProfile); setPurchases(nextPurchases); } })
      .catch(errorMessage);
    return () => { active = false; };
  }, [session?.user.id, tab]);
  useEffect(() => {
    if (!session || tab !== 'social') return;
    let active = true;
    setSocialLoading(true);
    setSocialError(false);
    loadSocialData(session.user.id, { lists })
      .then(data => { if (active) setSocialData(data); })
      .catch(error => { if (active) { setSocialError(true); errorMessage(error); } })
      .finally(() => { if (active) setSocialLoading(false); });
    return () => { active = false; };
  }, [session?.user.id, tab, lists]);

  useEffect(() => {
    if (!session || tab !== 'social' || socialSearch.trim().length < 2) {
      setSocialResults([]);
      setSocialSearching(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSocialSearching(true);
      searchSocialUsers(session.user.id, socialSearch)
        .then(res => { if (active) setSocialResults(res); })
        .catch(console.warn)
        .finally(() => { if (active) setSocialSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [session?.user.id, tab, socialSearch]);

  const reloadSocial = useCallback(async (userId: string) => {
    try {
      const data = await loadSocialData(userId, { lists });
      setSocialData(data);
      setSocialError(false);
    } catch (err) {
      setSocialError(true);
      errorMessage(err);
    }
  }, [lists]);

  async function handleSendRequest(user: SocialSearchResult) {
    if (!session) return;
    try {
      await sendFriendRequest(session.user.id, user.id);
      Alert.alert('Solicitação enviada!', `Convite de amizade enviado para @${user.username}.`);
      await reloadSocial(session.user.id);
      setSocialResults(prev => prev.map(u => u.id === user.id ? { ...u, relationship: 'pending_sent' } : u));
    } catch (error) {
      errorMessage(error);
    }
  }

  async function handleAcceptFriend(friend: SocialFriend) {
    if (!session) return;
    try {
      await acceptFriendRequest(session.user.id, friend.id);
      Alert.alert('Amizade aceita!', `Agora você e ${friend.name} estão conectados no Caneto.`);
      await reloadSocial(session.user.id);
    } catch (error) {
      errorMessage(error);
    }
  }

  async function handleDeclineFriend(friend: SocialFriend) {
    if (!session) return;
    try {
      await declineFriendRequest(session.user.id, friend.id);
      await reloadSocial(session.user.id);
    } catch (error) {
      errorMessage(error);
    }
  }

  async function handleCancelRequest(friend: SocialFriend) {
    if (!session) return;
    try {
      await cancelFriendRequest(session.user.id, friend.id);
      await reloadSocial(session.user.id);
    } catch (error) {
      errorMessage(error);
    }
  }

  async function handleAcceptInvitation(invitation: SocialInvitation) {
    if (!session) return;
    try {
      const listId = await acceptListInvitation(session.user.id, invitation.id);
      await refresh(session.user.id);
      await reloadSocial(session.user.id);
      setSelectedId(listId);
    } catch (error) {
      errorMessage(error);
    }
  }

  async function handleDeclineInvitation(invitation: SocialInvitation) {
    if (!session) return;
    try {
      await declineListInvitation(session.user.id, invitation.id);
      await reloadSocial(session.user.id);
    } catch (error) {
      errorMessage(error);
    }
  }
  useEffect(() => {
    if (Platform.OS !== 'android' || !session) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modal) { setModal(null); return true; }
      if (selectedId) { setSelectedId(null); return true; }
      if (tab !== 'lists') { setTab('lists'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [session, modal, selectedId, tab]);

  async function authenticate() {
    if (!email.trim() || !password) return Alert.alert('Preencha e-mail e senha');
    setBusy(true);
    try {
      const result = register ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (register && !result.data.session) Alert.alert('Confira seu e-mail', 'Confirme a conta para entrar.');
    } catch (error) { errorMessage(error); } finally { setBusy(false); }
  }
  async function addProduct(name: string) {
    if (!session || !selectedId || !name.trim() || !selected || selected.is_completed || selected.permission === 'viewer') return;
    setBusy(true);
    try { await addItem(session.user.id, selectedId, name); await refresh(session.user.id); }
    catch (error) { errorMessage(error); throw error; } finally { setBusy(false); }
  }
  async function toggle(item: Item) {
    if (!session || !selected || selected.is_completed || selected.permission === 'viewer') return;
    try { await setItemChecked(item, !item.checked); await refresh(session.user.id); }
    catch (error) { errorMessage(error); }
  }
  async function mutate(action: () => Promise<unknown>, close = true) {
    try { await action(); if (session) await refresh(session.user.id); if (close) setModal(null); }
    catch (error) { errorMessage(error); }
  }

  const selected = lists.find(list => list.id === selectedId);
  const modalList = lists.find(list => list.id === modalListId) ?? null;
  const modalItem = selected?.items.find(item => item.id === modalItemId) ?? null;

  function startDeleteItem(item: Item) {
    if (!selected) return;
    const shoppingItem = selected.domain?.items.find(i => i.id === item.id) ?? {
      id: item.id,
      listId: item.list_id,
      name: item.name,
      categoryId: item.category_id,
      quantity: item.quantity,
      unit: item.unit as any,
      price: item.price ?? undefined,
      checked: item.checked,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      checkedAt: item.checked_at ?? undefined,
    };

    setModal(null);
    setLists(prev => prev.map(l => l.id === selected.id ? { ...l, items: l.items.filter(i => i.id !== item.id) } : l));
    pendingDeletedItemRef.current = { item: shoppingItem, listId: selected.id };
    setDeletedToastItem(shoppingItem);
  }

  function handleUndoDelete() {
    setDeletedToastItem(null);
    pendingDeletedItemRef.current = null;
    if (session) void refresh(session.user.id);
  }

  async function handleCommitDelete(item: ShoppingItem) {
    setDeletedToastItem(null);
    const pending = pendingDeletedItemRef.current;
    if (pending && pending.item.id === item.id) {
      pendingDeletedItemRef.current = null;
      addTrashItem(item);
      setTrashItems(getValidTrash(pending.listId));
      try {
        await deleteItemFromDatabase(item.id, pending.listId);
        if (session) await refresh(session.user.id);
      } catch (error) {
        errorMessage(error);
      }
    }
  }
  const systemScheme = useColorScheme();
  const preferences: SettingsPreferences | undefined = profile ? {
    theme: profile.preferences.theme ?? 'light',
    fontSize: profile.preferences.fontSize ?? 'normal',
    checkboxStyle: profile.preferences.checkboxStyle ?? 'circle',
    highContrast: profile.preferences.highContrast ?? false,
    keepScreenAwake: profile.preferences.keepScreenAwake ?? false,
    vibration: profile.preferences.vibration ?? true,
    soundEffects: profile.preferences.soundEffects ?? true,
  } : undefined;

  const isDark = preferences?.theme === 'dark' || (preferences?.theme === 'system' && systemScheme === 'dark');

  if (starting || (!fontsLoaded && !fontError)) return <SafeAreaView style={[styles.center, { backgroundColor: isDark ? '#080D1A' : '#F8FAFC' }]}><ActivityIndicator size="large" color={green} /></SafeAreaView>;
  if (!session) return <SafeAreaView style={[styles.root, { backgroundColor: isDark ? '#080D1A' : '#F8FAFC' }]} edges={['top', 'bottom', 'left', 'right']}><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" /><KeyboardAvoidingView style={styles.flex} behavior="padding"><ScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
    <View style={styles.brandRow}><Image source={require('./assets/logo.webp')} style={styles.brandLogo} /><Text style={styles.brand}>Caneto<Text style={styles.tm}>™</Text></Text></View>
    <Text style={styles.tagline}>Caneto - A lista que te entende</Text>
    <Text style={styles.title}>{register ? 'Crie sua conta' : 'Entre na sua conta'}</Text>
    <Text style={styles.authDescription}>{register ? 'Guarde suas listas e compartilhe suas compras.' : 'Acesse suas listas e continue de onde parou.'}</Text>
    <View style={styles.authCard}>
      <View style={styles.segment}><Pressable style={[styles.segmentButton, !register && styles.authSegmentActive]} onPress={() => setRegister(false)}><Text style={[styles.segmentText, !register && styles.authSegmentText]}>Entrar</Text></Pressable><Pressable style={[styles.segmentButton, register && styles.authSegmentActive]} onPress={() => setRegister(true)}><Text style={[styles.segmentText, register && styles.authSegmentText]}>Criar conta</Text></Pressable></View>
      <Text style={styles.fieldLabel}>E-mail</Text><TextInput style={styles.input} placeholder="voce@exemplo.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
      <Text style={styles.fieldLabel}>Senha</Text><TextInput style={styles.input} placeholder="Sua senha" secureTextEntry value={password} onChangeText={setPassword} />
      <Pressable style={styles.button} disabled={busy} onPress={authenticate}><Text style={styles.buttonText}>{busy ? 'Aguarde...' : register ? 'Criar minha conta' : 'Entrar nas minhas listas  →'}</Text></Pressable>
      {!register && <AccountAuthActions onError={message => Alert.alert('Não foi possível entrar', message)} />}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;

  return <SafeAreaView style={[styles.root, { backgroundColor: isDark ? '#080D1A' : '#F8FAFC' }]} edges={['top', 'left', 'right']}><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />{!!syncText && <Text style={styles.sync}>{syncText}</Text>}{selected?.domain ? <ShoppingListScreen
    list={selected.domain}
    busy={busy}
    onBack={() => {
      if (pendingDeletedItemRef.current) void handleCommitDelete(pendingDeletedItemRef.current.item);
      setSelectedId(null);
    }}
    onOptions={() => { setModalListId(selected.id); setModal('list'); }}
    onSelectStore={() => setModal('store')}
    onToggle={item => { const legacy = selected.items.find(row => row.id === item.id); if (legacy) return toggle(legacy); }}
    onEdit={item => { if (!selected.is_completed && selected.permission !== 'viewer') { setModalItemId(item.id); setModal('item'); } }}
    onAdd={addProduct}
    onScan={() => setScannerOpen(true)}
    onRefresh={() => refresh(session.user.id)}
    trashCount={trashItems.length}
    onOpenTrash={() => setModal('trash')}
    deletedToastItem={deletedToastItem}
    onUndoDelete={handleUndoDelete}
    onDismissDeleteToast={handleCommitDelete}
  /> : <View style={styles.tabContentContainer}>
    <View style={styles.screenArea}>
      {tab === 'lists' && <ListsOverview
        lists={lists.map(list => list.domain).filter((list): list is ShoppingList => !!list)}
        activeListId={selectedId ?? undefined}
        onSelectList={list => setSelectedId(list.id)}
        onCreateList={async name => {
          const cleanName = name.trim();
          const id = await createList(session.user.id, cleanName);
          const now = Date.now();
          const newListDomain: ShoppingList = {
            id, ownerId: session.user.id, permission: 'owner', name: cleanName,
            icon: 'ShoppingCart', color: 'emerald', isDefault: false,
            accessMode: 'private', isCompleted: false, pendingReceipt: false, createdAt: now, updatedAt: now, items: [],
          };
          const newListLegacy: List = {
            id, name: cleanName, color: 'emerald', user_id: session.user.id,
            is_completed: false, created_at: now, updated_at: now, items: [], domain: newListDomain,
          };
          setLists(prev => [newListLegacy, ...prev.filter(l => l.id !== id)]);
          setSelectedId(id);
          void refresh(session.user.id).catch(console.warn);
        }}
        onEditList={list => { setModalListId(list.id); setModal('list'); }}
        onShareList={list => { setModalListId(list.id); setModal('share'); }}
        onDuplicateList={async list => { const legacy = lists.find(row => row.id === list.id); if (legacy) await mutate(() => duplicateList(legacy, session.user.id), false); }}
        onDeleteList={async list => { await mutate(async () => { await removeList(list.id); if (selectedId === list.id) setSelectedId(null); }, false); }}
        onReopenList={async list => { const legacy = lists.find(row => row.id === list.id); if (legacy) await mutate(() => setListCompleted(legacy, false), false); }}
        onRenameList={async (list, name) => mutate(() => renameList(list.id, name, list.storeName ?? ''), false)}
        onJoinList={() => setModal('join')}
        onRefresh={() => refresh(session.user.id)}
      />}
      {tab === 'stores' && <StoreExplorer />}
      {tab === 'social' && <SocialScreen
        {...(socialData ?? { friends: [] })}
        friendsLoading={socialLoading}
        friendsError={socialError}
        searchQuery={socialSearch}
        searchResults={socialResults}
        searchLoading={socialSearching}
        onSearchChange={setSocialSearch}
        onSendRequest={handleSendRequest}
        onAcceptFriend={handleAcceptFriend}
        onDeclineFriend={handleDeclineFriend}
        onCancelRequest={handleCancelRequest}
        onAcceptInvitation={handleAcceptInvitation}
        onDeclineInvitation={handleDeclineInvitation}
        onOpenJoin={() => setModal('join')}
        onOpenList={id => setSelectedId(id)}
        onRetryFriends={() => {
          if (session) void reloadSocial(session.user.id);
        }}
      />}
      {tab === 'settings' && <SettingsScreen
        profile={{ email: session.user.email, displayName: profile?.displayName, username: profile?.username, avatarUrl: profile?.avatarUrl }}
        plan={profile ? { tier: profile.planTier ?? 'free', scansUsed: profile.aiScansUsedThisMonth ?? 0, scansLimit: profile.aiScansLimit ?? 0 } : undefined}
        purchases={{ totalSpent: purchases.reduce((sum, purchase) => sum + purchase.totalSpent, 0), totalPurchases: purchases.length, totalItems: purchases.reduce((sum, purchase) => sum + purchase.totalItems, 0) }}
        preferences={preferences}
        version={CURRENT_APP_VERSION}
        onCheckUpdate={async () => {
          if (IS_EXPO_GO) {
            Alert.alert('Atualização', 'A atualização por APK está disponível no Caneto instalado, fora do Expo Go.');
            return;
          }
          try {
            const res = await checkAppUpdate();
            if (res?.hasUpdate) {
              setUpdateInfo(res);
              setUpdateModalVisible(true);
            } else if (res) {
              Alert.alert('Atualização', `O aplicativo já está na versão mais recente (v${CURRENT_APP_VERSION}).`);
            } else {
              Alert.alert('Atualização', 'Ainda não há uma versão publicada no GitHub.');
            }
          } catch {
            Alert.alert('Atualização', 'Não foi possível verificar a versão no GitHub. Verifique a conexão e tente novamente.');
          }
        }}
        onChangePreferences={next => { setProfile(current => current ? { ...current, preferences: { ...current.preferences, ...next } } : current); void updatePreferences(next, session.user.id).catch(errorMessage); }}
        onOpenProfile={() => setModal('profile')}
        onOpenHistory={() => setModal('history')}
        onSignOut={() => { void supabase.auth.signOut(); }}
      />}
    </View>
    <View style={[styles.dockContainer, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.dock, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
        {([
          { id: 'lists', label: 'Listas', icon: 'list' },
          { id: 'stores', label: 'Locais', icon: 'store' },
          { id: 'social', label: 'Social', icon: 'social' },
          { id: 'settings', label: 'Ajustes', icon: 'settings' },
        ] as const).map(entry => {
          const isActive = tab === entry.id;
          return <Pressable
            key={entry.id}
            style={[styles.dockButton, isActive && styles.dockActive]}
            onPress={() => setTab(entry.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={entry.label}
          >
            <CanetoIcon name={entry.icon} size={20} color={isActive ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B'} />
            {isActive && <NativeText numberOfLines={1} style={styles.dockActiveText}>{entry.label}</NativeText>}
          </Pressable>;
        })}
      </View>
    </View>
  </View>}
    <NewListModal visible={modal === 'new'} busy={busy} onClose={() => setModal(null)} onCreate={async name => {
      if (!session) return;
      setBusy(true);
      try {
        const cleanName = name.trim();
        const id = await createList(session.user.id, cleanName);
        const now = Date.now();
        const newListDomain: ShoppingList = {
          id, ownerId: session.user.id, permission: 'owner', name: cleanName,
          icon: 'ShoppingCart', color: 'emerald', isDefault: false,
          accessMode: 'private', isCompleted: false, pendingReceipt: false, createdAt: now, updatedAt: now, items: [],
        };
        const newListLegacy: List = {
          id, name: cleanName, color: 'emerald', user_id: session.user.id,
          is_completed: false, created_at: now, updated_at: now, items: [], domain: newListDomain,
        };
        setLists(prev => [newListLegacy, ...prev.filter(l => l.id !== id)]);
        setSelectedId(id);
        setModal(null);
        void refresh(session.user.id).catch(console.warn);
      } catch (error) {
        errorMessage(error);
      } finally {
        setBusy(false);
      }
    }} />
    <ListEditModal list={modal === 'list' ? modalList?.domain ?? null : null} onClose={() => setModal(null)}
      trashCount={modalList ? getValidTrash(modalList.id).length : 0}
      onOpenTrash={list => { setSelectedId(list.id); setModal('trash'); }}
      onSave={async (list, changes) => {
        await renameList(list.id, changes.name, changes.storeName ?? '');
        if (session) await refresh(session.user.id);
      }}
      onShare={list => { setModalListId(list.id); setModal('share'); }}
      onDuplicate={async list => { const legacy = lists.find(row => row.id === list.id); if (legacy) await mutate(() => duplicateList(legacy, session.user.id), false); }}
      onDelete={list => mutate(async () => { await removeList(list.id); if (selectedId === list.id) setSelectedId(null); }, false)}
      onComplete={async list => { const legacy = lists.find(row => row.id === list.id); if (!legacy) return; if (list.isCompleted) await mutate(() => setListCompleted(legacy, false), false); else { setModalListId(list.id); setModal('payment'); } }} />
    <ItemEditModal visible={modal === 'item'} item={modalItem} onClose={() => setModal(null)} onSave={async changes => { if (modalItem) await mutate(() => saveItemChanges(modalItem, changes)); }} onDelete={async () => { if (modalItem) startDeleteItem(modalItem); }} />
    <JoinListModal visible={modal === 'join'} onClose={() => setModal(null)} onJoin={async code => { const result = await joinListByCode(code); if (result === 'joined') await refresh(session.user.id); return result; }} />
    <ShareListModal visible={modal === 'share'} list={modalList} onClose={() => { setModal(null); void refresh(session.user.id); }} onChanged={() => refresh(session.user.id)} />
    <ProfileModal visible={modal === 'profile'} userId={session.user.id} email={session.user.email ?? ''} onClose={() => { setModal(null); void canetoData.profile(session.user.id).then(setProfile).catch(errorMessage); }} />
    <PaymentModal visible={modal === 'payment'} list={modalList} userId={session.user.id} onClose={() => setModal(null)} onConfirm={async (method, receipt: PurchaseReceipt) => { if (!modalList) return; await finishPurchase(modalList, session.user.id, method, receipt); await refresh(session.user.id); setModal(null); }} />
    <HistoryModal visible={modal === 'history'} userId={session.user.id} onClose={() => setModal(null)} onRecreate={async record => { await recreatePurchase(record, session.user.id); await refresh(session.user.id); }} />
    {selected && <StorePickerModal visible={modal === 'store'} listId={selected.id} selectedStoreId={selected.store_id ?? undefined} selectedStoreName={selected.store_name ?? undefined} onClose={() => setModal(null)} onLinked={() => refresh(session.user.id)} />}
    <TrashModal
      visible={modal === 'trash'}
      listName={modalList?.name ?? selected?.name ?? 'Lista'}
      trashItems={trashItems}
      onClose={() => setModal(null)}
      onRestoreItem={async item => {
        if (!session) return;
        const targetListId = selected?.id ?? modalList?.id;
        if (!targetListId) return;
        await restoreItemToDatabase(session.user.id, item);
        removeTrashItem(targetListId, item.id, item.deletedAt);
        setTrashItems(getValidTrash(targetListId));
        await refresh(session.user.id);
      }}
      onRestoreAll={async () => {
        if (!session) return;
        const targetListId = selected?.id ?? modalList?.id;
        if (!targetListId) return;
        for (const item of trashItems) {
          await restoreItemToDatabase(session.user.id, item);
        }
        clearTrash(targetListId);
        setTrashItems([]);
        await refresh(session.user.id);
      }}
      onEmptyTrash={() => {
        const targetListId = selected?.id ?? modalList?.id;
        if (!targetListId) return;
        clearTrash(targetListId);
        setTrashItems([]);
      }}
    />
    <UpdateModal visible={updateModalVisible} updateInfo={updateInfo} onClose={() => setUpdateModalVisible(false)} />
    <ScannerModal visible={scannerOpen && !!selectedId} userId={session.user.id} onClose={() => setScannerOpen(false)} onConfirm={async result => {
      if (!selectedId) return;
      for (const item of result.items) await addScannedItem(session.user.id, selectedId, item);
      await refresh(session.user.id);
    }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 },
  sync: { marginHorizontal: 16, marginTop: 6, color: '#475569', fontFamily: theme.font.semibold, fontSize: 12 },
  tabContentContainer: { flex: 1, position: 'relative' }, screenArea: { flex: 1 },
  listBackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 }, listBackName: { flex: 1, color: '#0F172A', fontSize: 17, fontFamily: 'Poppins_700Bold' }, itemEditButton: { padding: 8, marginLeft: 3 }, optionsButton: { padding: 7, marginRight: -7 },
  socialJoin: { backgroundColor: green, borderRadius: 14, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 },
  auth: { flexGrow: 1, justifyContent: 'center', padding: 22 }, brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 38 }, brandLogo: { width: 42, height: 42, marginRight: 9 }, brand: { color: '#020817', fontSize: 29, fontFamily: theme.font.extrabold }, tm: { color: green, fontSize: 13 }, tagline: { color: green, fontSize: 14, fontFamily: theme.font.bold, marginBottom: 8 }, authDescription: { color: '#475569', fontSize: 16, marginBottom: 22 }, authCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 26, padding: 20 }, fieldLabel: { color: '#1E293B', fontSize: 14, fontFamily: theme.font.bold, marginBottom: 7 }, title: { color: '#020817', fontSize: 30, fontFamily: theme.font.extrabold, marginBottom: 8 }, muted: { color: '#475569', fontSize: 13 }, mutedLine: { color: '#475569', fontSize: 15, marginHorizontal: 22, marginBottom: 14 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 15, fontSize: 16, fontFamily: theme.font.regular, marginBottom: 12 }, button: { backgroundColor: green, borderRadius: 15, alignItems: 'center', padding: 17, marginTop: 4 }, buttonBottom: { backgroundColor: green, borderRadius: 15, alignItems: 'center', padding: 17, margin: 18 }, buttonText: { color: 'white', fontSize: 16, fontFamily: theme.font.bold }, link: { color: green, textAlign: 'center', marginTop: 22, fontFamily: theme.font.bold },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22 }, overline: { color: green, fontSize: 12, fontFamily: theme.font.extrabold, letterSpacing: 2 }, round: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' }, roundText: { color: green, fontSize: 25 }, segment: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#F1F5F9', borderRadius: 13, padding: 4 }, segmentButton: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10 }, segmentActive: { backgroundColor: green }, authSegmentActive: { backgroundColor: 'white', elevation: 2 }, authSegmentText: { color: green }, segmentText: { color: '#475569', fontFamily: theme.font.bold }, segmentActiveText: { color: 'white' }, content: { paddingHorizontal: 18, paddingBottom: 80 }, empty: { textAlign: 'center', color: '#64748B', marginTop: 70, fontSize: 16 }, card: { backgroundColor: 'white', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' }, cardIcon: { backgroundColor: '#E8EEFF', borderRadius: 14, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, cardEmoji: { fontSize: 24 }, cardTitle: { color: '#0F172A', fontSize: 17, fontFamily: theme.font.bold, marginBottom: 4 }, arrow: { color: '#94A3B8', fontSize: 28 },
  item: { backgroundColor: 'white', borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, check: { width: 26, height: 26, borderWidth: 2, borderColor: '#9AADE9', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checked: { backgroundColor: green, borderColor: green }, checkText: { color: 'white', fontFamily: theme.font.extrabold }, itemText: { flex: 1, color: '#0F172A', fontSize: 16, fontFamily: theme.font.semibold }, done: { textDecorationLine: 'line-through', color: '#64748B' }, composer: { flexDirection: 'row', backgroundColor: 'white', padding: 12, alignItems: 'center' }, plus: { width: 50, height: 50, backgroundColor: green, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginLeft: 6 }, plusText: { color: 'white', fontSize: 26 },
  landing: { paddingHorizontal: 18, paddingBottom: 36 }, landingHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerAction: { backgroundColor: green, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 10 }, headerActionText: { color: 'white', fontSize: 14, fontFamily: theme.font.bold }, heroTitle: { color: '#020817', fontSize: 35, lineHeight: 40, fontFamily: theme.font.extrabold, letterSpacing: -1.2, textAlign: 'center', marginTop: 24 }, heroSubtitle: { color: '#475569', fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 17 }, heroActions: { marginTop: 25, gap: 11 }, heroPrimary: { marginTop: 0 }, heroSecondary: { padding: 15, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#A8BDFD', backgroundColor: 'white' }, heroSecondaryText: { color: green, fontSize: 16, fontFamily: theme.font.bold }, demoCard: { marginTop: 30, padding: 20, backgroundColor: 'white', borderRadius: 28, borderWidth: 1, borderColor: '#E2E8F0', elevation: 3 }, demoEyebrow: { color: green, fontFamily: theme.font.extrabold, fontSize: 12, letterSpacing: 1.5 }, demoTitle: { color: '#0F172A', fontSize: 22, fontFamily: theme.font.extrabold, marginTop: 5, marginBottom: 20 }, demoComposer: { flexDirection: 'row', alignItems: 'center' }, demoInput: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 13, fontSize: 15 }, demoItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F8FAFC', borderRadius: 15, marginBottom: 14 }, demoHint: { color: '#475569', lineHeight: 22, marginBottom: 12 }, benefits: { marginTop: 30, gap: 13 }, benefit: { color: '#334155', fontSize: 15, fontFamily: theme.font.semibold }, authBack: { color: green, fontFamily: theme.font.bold, fontSize: 15, marginBottom: 28 },
  dockContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, zIndex: 100 },
  dock: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 22, padding: 6, gap: 6, minHeight: 58, alignItems: 'center', justifyContent: 'space-between', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8 },
  dockButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, flexDirection: 'row', gap: 6, paddingHorizontal: 6 },
  dockActive: { flex: 2.3, backgroundColor: '#0943F1', shadowColor: '#0943F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
  dockActiveText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 14 },
});

