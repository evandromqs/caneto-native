import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text as NativeText, TextInput, useColorScheme, View, type TextProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import type { Session } from '@supabase/supabase-js';
import { addItem, addScannedItem, createList, loadLists, setItemChecked, type Item, type List } from './src/data';
import { supabase } from './src/supabase';
import { createThemedStyles, setAppTheme, theme } from './src/ui/theme';
import { setHapticsEnabled, triggerHaptic } from './src/core/device/haptics';
import { playSound, setSoundEnabled, SoundEngine } from './src/core/device/sounds';
import { NewListModal, ItemEditModal } from './src/features/lists/ListModals';
import { ListEditModal } from './src/features/lists/ListEditModal';
import { addBatchItems, duplicateList, mergeListsData, removeList, renameList, saveItemChanges, setListCompleted, uncheckAllItems } from './src/features/lists/repository';
import { JoinListModal, ShareListModal } from './src/features/sharing/SharingModals';
import { joinListByCode } from './src/features/sharing/repository';
import { ProfileModal } from './src/features/profile/ProfileModal';
import { HistoryModal, PaymentModal } from './src/features/purchases/PurchaseModals';
import { attachReceipt, finishPurchase, recreatePurchase, type PurchaseReceipt } from './src/features/purchases/repository';
import { StoreExplorer, StorePickerModal, type CatalogProductInput } from './src/features/stores/StoreExplorer';
import { linkStoreToList } from './src/features/stores/repository';
import { ListsOverview } from './src/features/lists/ListsOverview';
import type { DeletedShoppingItem, Profile, Purchase, ShoppingItem, ShoppingList } from './src/core/models/caneto';
import { canetoData } from './src/core/data/supabaseAdapter';
import { AccountAuthActions } from './src/features/account/AccountAuthActions';
import { ShoppingListScreen } from './src/features/cart/ShoppingListScreen';
import { BatchImportModal } from './src/features/cart/BatchImportModal';
import { CanetoIcon } from './src/ui/CanetoIcon';
import { SocialScreen, type SocialFriend, type SocialInvitation, type SocialSearchResult } from './src/features/social/SocialScreen';
import { FriendDetailsModal } from './src/features/social/FriendDetailsModal';
import {
  acceptFriendRequest,
  acceptListInvitation,
  cancelFriendRequest,
  declineFriendRequest,
  declineListInvitation,
  loadSocialData,
  removeFriendship,
  searchSocialUsers,
  sendFriendRequest,
  shareListWithFriend,
  type SocialDataProps,
} from './src/features/social/repository';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { FeedbackModal } from './src/features/settings/FeedbackModal';
import { ChangelogModal } from './src/features/settings/ChangelogModal';
import { OnboardingModal } from './src/features/settings/OnboardingModal';
import { StatsDetailsModal } from './src/features/purchases/StatsDetailsModal';
import { requestNotificationPermission } from './src/core/device/notifications';
import type { ProductSuggestion } from './src/features/products/search';
import type { SettingsPreferences } from './src/features/settings/SettingsScreen';
import { updatePreferences } from './src/features/account/profile';
import { TrashModal } from './src/features/cart/TrashModal';
import { addTrashItem, clearTrash, deleteItemFromDatabase, getValidTrash, movePurchasedItemsToTrash, removeTrashItem, restoreItemToDatabase } from './src/features/cart/trashRepository';
import { getErrorMessage } from './src/ui/error';
import { checkAndApplyOnlineUpdate, CURRENT_APP_VERSION, CURRENT_OTA_UPDATE, IS_EXPO_GO } from './src/features/updater/updaterService';
import { ScannerModal } from './src/features/capture/ScannerModal';
import { bindSyncUser, currentSyncUserId, flushOutbox, subscribeSync, watchConnectivity } from './src/core/sync/outbox';
import { readListCache, subscribeListCache } from './src/core/sync/listCache';
import { subscribeShoppingChanges } from './src/core/sync/realtime';
import { LaunchSplash } from './src/features/launch/LaunchSplash';
import { CANETO_API } from './src/core/api';
import * as SplashScreen from 'expo-splash-screen';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const green = theme.blue;
type TabId = 'lists' | 'stores' | 'social' | 'settings';
const tabOrder: TabId[] = ['lists', 'stores', 'social', 'settings'];
const errorMessage = (error: unknown) => Alert.alert('Não foi possível continuar', getErrorMessage(error));
const Text = ({ style, ...props }: TextProps) => <NativeText {...props} style={[{ fontFamily: theme.font.regular }, style]} />;

export default function App() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold });
  const [fontTimeout, setFontTimeout] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [starting, setStarting] = useState(true);
  const [launchReady, setLaunchReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [register, setRegister] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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
  const [tab, setTab] = useState<TabId>('lists');
  const [modal, setModal] = useState<'new' | 'list' | 'item' | 'join' | 'share' | 'profile' | 'payment' | 'history' | 'store' | 'trash' | null>(null);
  const [modalListId, setModalListId] = useState<string | null>(null);
  const [modalItemId, setModalItemId] = useState<string | null>(null);
  const [deletedToastItem, setDeletedToastItem] = useState<ShoppingItem | null>(null);
  const [trashItems, setTrashItems] = useState<DeletedShoppingItem[]>([]);
  const [checkingOnlineUpdate, setCheckingOnlineUpdate] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningItem, setScanningItem] = useState<ShoppingItem | null>(null);
  const [receiptAttachOpen, setReceiptAttachOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<SocialFriend | null>(null);
  const pendingDeletedItemRef = useRef<{ item: ShoppingItem; listId: string } | null>(null);
  const [tabTranslateX] = useState(() => new Animated.Value(0));
  const [tabOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setTimeout(() => setLaunchReady(true), 2000);
    const fontTimer = setTimeout(() => setFontTimeout(true), 2200);
    return () => {
      clearTimeout(timer);
      clearTimeout(fontTimer);
    };
  }, []);

  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    if (IS_EXPO_GO) return;
    void checkAndApplyOnlineUpdate().catch(() => {});
  }, []);

  const selectTab = useCallback((nextTab: TabId) => {
    void triggerHaptic('selection');
    void playSound('tap');
    tabTranslateX.stopAnimation();
    tabOpacity.stopAnimation();

    if (nextTab === tab) {
      tabTranslateX.setValue(0);
      Animated.sequence([
        Animated.timing(tabTranslateX, { toValue: -5, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tabTranslateX, { toValue: 0, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }

    const direction = tabOrder.indexOf(nextTab) > tabOrder.indexOf(tab) ? 1 : -1;
    tabTranslateX.setValue(direction * 26);
    tabOpacity.setValue(0.88);
    setTab(nextTab);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(tabTranslateX, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tabOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
  }, [tab, tabOpacity, tabTranslateX]);

  const refresh = useCallback(async (userId: string) => {
    if (currentSyncUserId() !== userId) return;
    const next = await loadLists(userId);
    if (currentSyncUserId() === userId) setLists(next);
  }, []);
  const addSuggestedProduct = useCallback(async (product: ProductSuggestion) => {
    if (!session || !selectedId) return;
    await addScannedItem(session.user.id, selectedId, {
      name: product.name, categoryId: product.categoryId, quantity: 1,
      unit: 'un', price: null, ean: product.ean, brand: product.brand, photoUrl: product.image,
    });
    await refresh(session.user.id);
  }, [session, selectedId, refresh]);

  useEffect(() => subscribeListCache(userId => {
    if (session?.user.id !== userId) return;
    const cached = readListCache<List>(userId);
    if (cached) setLists(cached);
  }), [session?.user.id]);

  useEffect(() => {
    if (selectedId) setTrashItems(getValidTrash(selectedId));
    else setTrashItems([]);
  }, [selectedId, lists]);
  useEffect(() => {
    const fallbackTimer = setTimeout(() => setStarting(false), 3000);
    supabase.auth.getSession()
      .then(({ data, error }) => { if (error) throw error; bindSyncUser(data.session?.user.id ?? ''); setSession(data.session); })
      .catch(errorMessage)
      .finally(() => {
        clearTimeout(fallbackTimer);
        setStarting(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      bindSyncUser(next?.user.id ?? '');
      setSession(next);
      if (!next) { setLists([]); setProfile(null); setPurchases([]); setSocialData(null); setSelectedId(null); setTab('lists'); }
    });
    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => subscribeSync(() => {}), []);
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
    if (!session?.user.id) return;
    let active = true;
    canetoData.profile(session.user.id)
      .then(nextProfile => {
        if (!active) return;
        setProfile(nextProfile);
        const localDone = typeof localStorage !== 'undefined' && localStorage.getItem(`caneto_onboarding_completed_${session.user.id}`) === 'true';
        const hasIdentity = !!(nextProfile?.username?.trim() && nextProfile?.displayName?.trim());
        const hasPrefs = Boolean((nextProfile?.preferences as Record<string, unknown> | undefined)?.hasCompletedOnboarding);
        if (!localDone && (!hasIdentity || !hasPrefs)) {
          setOnboardingRequired(true);
          setOnboardingOpen(true);
        } else {
          setOnboardingRequired(false);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session?.user.id]);
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
      if (batchImportOpen) { setBatchImportOpen(false); return true; }
      if (changelogOpen) { setChangelogOpen(false); return true; }
      if (onboardingOpen) { if (!onboardingRequired) setOnboardingOpen(false); return true; }
      if (statsOpen) { setStatsOpen(false); return true; }
      if (selectedFriend) { setSelectedFriend(null); return true; }
      if (feedbackOpen) { setFeedbackOpen(false); return true; }
      if (modal) { setModal(null); return true; }
      if (selectedId) { leaveSelectedList(); return true; }
      if (tab !== 'lists') { setTab('lists'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [session, modal, selectedId, lists, tab, batchImportOpen, changelogOpen, onboardingOpen, statsOpen, selectedFriend, feedbackOpen]);

  function leaveSelectedList() {
    if (pendingDeletedItemRef.current) void handleCommitDelete(pendingDeletedItemRef.current.item);
    const current = lists.find(row => row.id === selectedId);
    setSelectedId(null);
    if (
      current &&
      !current.is_completed &&
      (current.permission ?? 'owner') === 'owner' &&
      current.items.length === 0 &&
      !current.store_id &&
      !current.store_name
    ) {
      setLists(prev => prev.filter(row => row.id !== current.id));
      void removeList(current.id).catch(() => undefined);
    }
  }

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
    try {
      await addItem(session.user.id, selectedId, name);
      void triggerHaptic('light');
      void playSound('add');
      await refresh(session.user.id);
    }
    catch (error) { errorMessage(error); throw error; } finally { setBusy(false); }
  }
  async function toggle(item: Item) {
    if (!session || !selected || selected.is_completed || selected.permission === 'viewer') return;
    const nextChecked = !item.checked;
    void triggerHaptic(nextChecked ? 'medium' : 'light');
    void playSound(nextChecked ? 'check' : 'uncheck');
    try { await setItemChecked(item, nextChecked); await refresh(session.user.id); }
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
  const preferences: SettingsPreferences = {
    theme: profile?.preferences.theme ?? 'system',
    fontSize: profile?.preferences.fontSize ?? 'normal',
    checkboxStyle: profile?.preferences.checkboxStyle ?? 'circle',
    highContrast: profile?.preferences.highContrast ?? false,
    keepScreenAwake: profile?.preferences.keepScreenAwake ?? false,
    vibration: profile?.preferences.vibration ?? true,
    soundEffects: profile?.preferences.soundEffects ?? true,
  };

  const isDark = preferences.theme === 'dark' || (preferences.theme === 'system' && systemScheme === 'dark');
  setAppTheme(isDark, { fontSize: preferences.fontSize, highContrast: preferences.highContrast });
  setHapticsEnabled(preferences.vibration);
  setSoundEnabled(preferences.soundEffects);

  if ((starting || !fontsReady || !launchReady) && !fontTimeout) return <LaunchSplash dark={isDark} />;
  if (!session) return <SafeAreaView style={styles.authRoot} edges={['top', 'bottom', 'left', 'right']}><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
    <View style={styles.authHeader}>
      <View style={styles.brandRow}>
        <Image source={require('./assets/logo.webp')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brand}>Caneto<Text style={styles.tm}>™</Text></Text>
      </View>
      <Text style={styles.title}>{register ? 'Crie sua conta' : 'Entre na sua conta'}</Text>
      <Text style={styles.authDescription}>{register ? 'Guarde suas listas e compartilhe suas compras.' : 'Acesse suas listas e continue de onde parou.'}</Text>
    </View>
    <View style={styles.authCard}>
      <View style={styles.segment}>
        <Pressable style={[styles.segmentButton, !register && styles.authSegmentActive]} onPress={() => setRegister(false)}>
          <Text style={[styles.segmentText, !register && styles.authSegmentText]}>Entrar</Text>
        </Pressable>
        <Pressable style={[styles.segmentButton, register && styles.authSegmentActive]} onPress={() => setRegister(true)}>
          <Text style={[styles.segmentText, register && styles.authSegmentText]}>Criar conta</Text>
        </Pressable>
      </View>
      <Text style={styles.fieldLabel}>E-mail</Text>
      <TextInput
        style={[styles.input, emailFocused && styles.inputFocused]}
        placeholder="voce@exemplo.com"
        placeholderTextColor={theme.placeholder}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
      />
      <Text style={styles.fieldLabel}>Senha</Text>
      <View style={[styles.passwordContainer, passwordFocused && styles.inputFocused]}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Sua senha"
          placeholderTextColor={theme.placeholder}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
        />
        <Pressable style={styles.eyeButton} onPress={() => setShowPassword(prev => !prev)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Ver senha'}>
          <Text style={styles.eyeButtonText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.button} disabled={busy} onPress={authenticate}>
        <Text style={styles.buttonText}>{busy ? 'Aguarde...' : register ? 'Criar minha conta' : 'Entrar nas minhas listas  →'}</Text>
      </Pressable>
      {!register && <AccountAuthActions onError={message => Alert.alert('Não foi possível entrar', message)} />}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;

  return <SafeAreaView style={[styles.root, { backgroundColor: isDark ? '#080D1A' : '#F8FAFC' }]} edges={['top', 'left', 'right']}><SoundEngine /><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />{selected?.domain ? <ShoppingListScreen
    list={selected.domain}
    busy={busy}
    onBack={leaveSelectedList}
    onOptions={() => { setModalListId(selected.id); setModal('list'); }}
    onSelectStore={() => setModal('store')}
    onToggle={item => { const legacy = selected.items.find(row => row.id === item.id); if (legacy) return toggle(legacy); }}
    onEdit={item => { if (!selected.is_completed && selected.permission !== 'viewer') { setModalItemId(item.id); setModal('item'); } }}
    onAdd={addProduct}
    onAddProduct={addSuggestedProduct}
    onScan={() => setScannerOpen(true)}
    onScanItem={item => {
      setScanningItem(item);
      setScannerOpen(true);
    }}
    onRefresh={() => refresh(session.user.id)}
    trashCount={trashItems.length}
    onOpenTrash={() => setModal('trash')}
    deletedToastItem={deletedToastItem}
    onUndoDelete={handleUndoDelete}
    onDismissDeleteToast={handleCommitDelete}
    onOpenBatchImport={() => setBatchImportOpen(true)}
    onUncheckAll={async () => {
      if (!selected) return;
      await mutate(() => uncheckAllItems(selected.id, selected.items), false);
    }}
    onClearPurchased={async () => {
      if (!selected?.domain) return;
      const purchased = selected.domain.items.filter(item => item.checked);
      if (!purchased.length) return;
      await movePurchasedItemsToTrash(session.user.id, selected.id, purchased);
      setTrashItems(getValidTrash(selected.id));
      await refresh(session.user.id);
    }}
    onFinish={() => { if (!selected) return; setModalListId(selected.id); setModal('payment'); }}
    onAttachReceipt={() => setReceiptAttachOpen(true)}
    checkboxStyle={preferences.checkboxStyle}
    vibrationEnabled={preferences.vibration}
    soundEffectsEnabled={preferences.soundEffects}
    keepScreenAwakeEnabled={preferences.keepScreenAwake}
  /> : <View style={styles.tabContentContainer}>
    <Animated.View style={[styles.screenArea, { opacity: tabOpacity, transform: [{ translateX: tabTranslateX }] }]}>
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
        onScanList={async () => {
          const openList = lists.find(row => !row.is_completed && row.domain?.permission !== 'viewer');
          if (openList) {
            setSelectedId(openList.id);
            setScannerOpen(true);
            return;
          }
          const cleanName = 'Lista Escaneada';
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
          setScannerOpen(true);
          void refresh(session.user.id).catch(console.warn);
        }}
        onRefresh={() => refresh(session.user.id)}
      />}
      {tab === 'stores' && <StoreExplorer
        availableLists={lists
          .filter(l => !l.is_completed && (l.permission ?? 'owner') !== 'viewer')
          .map(l => ({ id: l.id, name: l.name, itemCount: l.items.length }))}
        onImportItems={async (store, items, targetListId, newListName) => {
          if (!session || !items.length) return;
          let listId = targetListId;
          if (!listId || listId === 'new') {
            listId = await createList(session.user.id, (newListName ?? '').trim() || `Compras · ${store.name}`);
            await linkStoreToList(listId, store);
          }
          await addBatchItems(
            session.user.id,
            listId,
            items.map((it: CatalogProductInput) => ({
              name: it.name,
              quantity: 1,
              unit: it.unit || 'un',
              price: it.price,
              categoryId: it.categoryId || 'other',
            }))
          );
          await refresh(session.user.id);
          setSelectedId(listId);
          setTab('lists');
        }}
        savedCatalog={lists.reduce<Record<string, Item[]>>((catalog, list) => {
        if (list.store_id) catalog[list.store_id] = [...(catalog[list.store_id] ?? []), ...list.items];
        return catalog;
      }, {})} savedStores={lists
        .filter(list => !!list.store_id && !!(list.store_name ?? '').trim() && list.items.length > 0 && !/giant food/i.test(list.store_name ?? '') && !/ashburn/i.test(list.domain?.storeAddress ?? ''))
        .map(list => {
          const isCommunityUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(list.store_id ?? '');
          return {
            id: list.store_id!,
            placeId: isCommunityUuid ? undefined : list.store_id!,
            name: list.store_name!,
            category: 'other' as const,
            categoryLabel: 'Loja',
            address: list.domain?.storeAddress || '',
            source: (isCommunityUuid ? 'community' : 'google') as 'community' | 'google',
          };
        })} />}
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
        onOpenFriend={friend => setSelectedFriend(friend)}
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
        onlineUpdate={CURRENT_OTA_UPDATE}
        checkingOnlineUpdate={checkingOnlineUpdate}
        onCheckOnlineUpdate={async () => {
          if (checkingOnlineUpdate) return;
          setCheckingOnlineUpdate(true);
          try {
            const result = await checkAndApplyOnlineUpdate();
            if (result === 'current') {
              Alert.alert('Atualização online', `Você já está usando a atualização mais recente (${CURRENT_OTA_UPDATE.number === 'Base' ? 'Base' : `#${CURRENT_OTA_UPDATE.number}`}).`);
            } else if (result === 'unavailable') {
              Alert.alert('Atualização online', 'A atualização EAS não está disponível neste ambiente.');
            }
          } catch (cause) {
            Alert.alert('Atualização online', `Não foi possível buscar a atualização. ${getErrorMessage(cause)}`);
          } finally {
            setCheckingOnlineUpdate(false);
          }
        }}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onOpenChangelog={() => setChangelogOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onChangePreferences={async next => {
          if (next.notifications && !preferences.notifications) {
            await requestNotificationPermission();
          }
          setProfile(current => current ? { ...current, preferences: { ...current.preferences, ...next } } : {
            id: session.user.id,
            email: session.user.email ?? undefined,
            visibility: 'private',
            isPhotoPublic: true,
            preferences: next,
            updatedAt: Date.now(),
          });
          void updatePreferences(next, session.user.id).catch(error => {
            console.warn('Não foi possível sincronizar as preferências do perfil:', getErrorMessage(error));
          });
        }}
        onOpenProfile={() => setModal('profile')}
        onOpenHistory={() => setStatsOpen(true)}
        onSignOut={() => {
          bindSyncUser('');
          void supabase.auth.signOut().then(({ error }) => {
            if (error) { bindSyncUser(session.user.id); errorMessage(error); }
          });
        }}
        onDeleteAccount={async () => {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const token = currentSession?.access_token ?? session.access_token;
            if (token) {
              await fetch(`${CANETO_API}/api/account/delete`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => {});
            }
            await supabase.from('lists').delete().eq('user_id', session.user.id);
            await supabase.from('purchase_history').delete().eq('user_id', session.user.id);
            await supabase.from('profiles').delete().eq('id', session.user.id);
            bindSyncUser('');
            await supabase.auth.signOut();
            Alert.alert('Conta excluída', 'Seus dados foram removidos e sua sessão foi encerrada.');
          } catch (error) {
            errorMessage(error);
          }
        }}
      />}
    </Animated.View>
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
            style={({ pressed }) => [styles.dockButton, isActive && styles.dockActive, pressed && styles.dockPressed]}
            onPress={() => selectTab(entry.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={entry.label}
          >
            <CanetoIcon name={entry.icon} size={20} color={isActive ? '#FFFFFF' : isDark ? '#CBD5E1' : '#64748B'} />
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
      lists={lists.map(r => r.domain ?? ({ id: r.id, name: r.name, isCompleted: r.is_completed, items: r.items } as any))}
      trashCount={modalList ? getValidTrash(modalList.id).length : 0}
      onOpenTrash={list => { setSelectedId(list.id); setModal('trash'); }}
      onSave={async (list, changes) => {
        await renameList(list.id, changes.name, changes.storeName ?? '');
        if (session) await refresh(session.user.id);
      }}
      onShare={list => { setModalListId(list.id); setModal('share'); }}
      onDuplicate={async list => { const legacy = lists.find(row => row.id === list.id); if (legacy) await mutate(() => duplicateList(legacy, session.user.id), false); }}
      onMergeLists={async (targetId, sourceId, deleteSource) => {
        if (!session) return;
        await mutate(() => mergeListsData(targetId, sourceId, deleteSource ?? false, session.user.id));
        await refresh(session.user.id);
      }}
      onDelete={list => mutate(async () => { await removeList(list.id); if (selectedId === list.id) setSelectedId(null); }, false)}
      onComplete={async list => { const legacy = lists.find(row => row.id === list.id); if (!legacy) return; if (list.isCompleted) await mutate(() => setListCompleted(legacy, false), false); else { setModalListId(list.id); setModal('payment'); } }} />
    <ItemEditModal visible={modal === 'item'} item={modalItem} isCompleted={selected?.is_completed ?? false} onClose={() => setModal(null)} onSave={async changes => { if (modalItem) await mutate(() => saveItemChanges(modalItem, changes)); }} onDelete={async () => { if (modalItem) startDeleteItem(modalItem); }} />
    <JoinListModal visible={modal === 'join'} onClose={() => setModal(null)} onJoin={async code => { const result = await joinListByCode(code); if (result === 'joined') await refresh(session.user.id); return result; }} />
    <ShareListModal visible={modal === 'share'} list={modalList} onClose={() => { setModal(null); void refresh(session.user.id); }} onChanged={() => refresh(session.user.id)} />
    <ProfileModal visible={modal === 'profile'} userId={session.user.id} email={session.user.email ?? ''} onClose={() => { setModal(null); void canetoData.profile(session.user.id).then(setProfile).catch(errorMessage); }} />
    <PaymentModal visible={modal === 'payment'} list={modalList} userId={session.user.id} onClose={() => setModal(null)} onConfirm={async (method, receipt: PurchaseReceipt) => {
      if (!modalList) return;
      await finishPurchase(modalList, session.user.id, method, receipt);
      const nextOpen = lists.find(row => row.id !== modalList.id && !row.is_completed && row.domain?.permission !== 'viewer');
      setSelectedId(nextOpen ? nextOpen.id : await createList(session.user.id, 'Minha Lista de Compras'));
      await refresh(session.user.id);
      setModal(null);
    }} />
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
    <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} userId={session.user.id} email={session.user.email} name={profile?.displayName || undefined} />
    <ScannerModal
      visible={scannerOpen && !!selectedId}
      userId={session.user.id}
      onClose={() => {
        setScannerOpen(false);
        setScanningItem(null);
      }}
      onConfirm={async (result, options) => {
        if (!selectedId) return;
        if (scanningItem) {
          // Detecção de produto para o item específico: atualiza dados e dá check automático
          const scanned = result.items[0];
          if (scanned) {
            await mutate(async () => {
              const legacyItem = selected?.items.find(i => i.id === scanningItem.id);
              if (legacyItem) {
                await saveItemChanges(legacyItem, {
                  name: scanned.name || legacyItem.name,
                  quantity: legacyItem.quantity,
                  unit: legacyItem.unit,
                  price: scanned.price ?? legacyItem.price,
                  category_id: legacyItem.category_id,
                  ean: scanned.ean || legacyItem.ean,
                  brand: scanned.brand || legacyItem.brand,
                  photo_url: scanned.photoUrl || legacyItem.photo_url,
                });
                if (!legacyItem.checked) {
                  await setItemChecked(legacyItem, true);
                }
              }
            });
            void playSound('check', preferences.soundEffects);
            void triggerHaptic('selection', preferences.vibration);
          }
          setScanningItem(null);
        } else {
          for (const item of result.items) {
            await addScannedItem(session.user.id, selectedId, item);
          }
          const latestLists = await loadLists(session.user.id);
          if (currentSyncUserId() === session.user.id) setLists(latestLists);
          if (options?.openEdit && result.items[0]) {
            const target = result.items[0];
            const currentList = latestLists.find(l => l.id === selectedId);
            const matched = currentList?.items.find(i => (target.ean && i.ean === target.ean) || i.name === target.name);
            if (matched) {
              setModalItemId(matched.id);
              setModal('item');
            }
          }
          return;
        }
        await refresh(session.user.id);
      }}
    />
    <ScannerModal visible={receiptAttachOpen && !!selected} userId={session.user.id} purpose="receipt" onClose={() => setReceiptAttachOpen(false)} onConfirm={async result => {
      if (!selected) return;
      await attachReceipt(selected, session.user.id, {
        photoUrl: result.receiptPhoto, qrCode: result.receiptQr, total: result.total,
        storeName: result.storeName, storeCnpj: result.cnpj,
      });
      await refresh(session.user.id);
      setReceiptAttachOpen(false);
    }} />
    <BatchImportModal
      visible={batchImportOpen}
      onClose={() => setBatchImportOpen(false)}
      onImportItems={async items => {
        if (!selected || !session) return;
        await addBatchItems(session.user.id, selected.id, items);
        await refresh(session.user.id);
      }}
    />
    <ChangelogModal visible={changelogOpen} onClose={() => setChangelogOpen(false)} />
    <OnboardingModal
      visible={onboardingOpen}
      required={onboardingRequired}
      userId={session.user.id}
      userEmail={session.user.email}
      initialProfile={profile}
      initialPreferences={preferences}
      onPreviewPreferences={next => {
        setProfile(current => current ? { ...current, preferences: { ...current.preferences, ...next } } : {
          id: session.user.id,
          email: session.user.email ?? undefined,
          visibility: 'public',
          isPhotoPublic: true,
          preferences: next,
          updatedAt: Date.now(),
        });
      }}
      onComplete={async result => {
        const nextPrefs = { ...result.preferences, hasCompletedOnboarding: true };
        const payload = {
          display_name: result.displayName,
          username: result.username,
          avatar_url: result.avatarUrl || null,
          visibility: result.visibility,
          is_photo_public: result.isPhotoPublic,
          preferences: nextPrefs,
          updated_at: Date.now(),
        };
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        let saveError = existing
          ? (await supabase.from('profiles').update(payload).eq('id', session.user.id)).error
          : (await supabase.from('profiles').insert({ id: session.user.id, email: session.user.email ?? null, ...payload })).error;

        if (saveError && saveError.code === '23505') {
          const fallbackUsername = `${result.username.slice(0, 14)}_${Math.floor(100 + Math.random() * 899)}`;
          const retryPayload = { ...payload, username: fallbackUsername };
          saveError = existing
            ? (await supabase.from('profiles').update(retryPayload).eq('id', session.user.id)).error
            : (await supabase.from('profiles').insert({ id: session.user.id, email: session.user.email ?? null, ...retryPayload })).error;
          if (!saveError) result.username = fallbackUsername;
        }
        if (saveError) throw saveError;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`caneto_onboarding_completed_${session.user.id}`, 'true');
          } catch {}
        }
        setProfile(current => ({
          ...(current ?? { id: session.user.id, email: session.user.email ?? undefined }),
          displayName: result.displayName,
          username: result.username,
          avatarUrl: result.avatarUrl,
          visibility: result.visibility,
          isPhotoPublic: result.isPhotoPublic,
          preferences: nextPrefs,
          updatedAt: Date.now(),
        }));
        setOnboardingRequired(false);
        setOnboardingOpen(false);
      }}
      onClose={() => { if (!onboardingRequired) setOnboardingOpen(false); }}
    />
    <StatsDetailsModal
      visible={statsOpen}
      purchases={purchases}
      onClose={() => setStatsOpen(false)}
      onRecreate={async record => {
        await recreatePurchase(record, session.user.id);
        await refresh(session.user.id);
      }}
    />
    <FriendDetailsModal
      visible={!!selectedFriend}
      friend={selectedFriend}
      allLists={lists.map(l => l.domain).filter((l): l is ShoppingList => !!l)}
      onClose={() => setSelectedFriend(null)}
      onOpenList={id => {
        setSelectedFriend(null);
        setSelectedId(id);
      }}
      onShareListWithFriend={async (listId, friend) => {
        if (!session) return;
        const targetList = lists.find(l => l.id === listId);
        await shareListWithFriend(
          listId,
          targetList?.name || 'Lista',
          session.user.id,
          profile?.displayName || session.user.email?.split('@')[0] || 'Usuário',
          profile?.username || '',
          friend.id
        );
        await refresh(session.user.id);
      }}
      onRemoveFriend={async friend => {
        if (!session) return;
        await removeFriendship(session.user.id, friend.id);
        await reloadSocial(session.user.id);
      }}
    />
  </SafeAreaView>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 },
  authRoot: { flex: 1, backgroundColor: theme.background },
  sync: { marginHorizontal: 16, marginTop: 6, color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  tabContentContainer: { flex: 1, position: 'relative' }, screenArea: { flex: 1 },
  listBackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 }, listBackName: { flex: 1, color: theme.ink, fontSize: 17, fontFamily: 'Poppins_700Bold' }, itemEditButton: { padding: 8, marginLeft: 3 }, optionsButton: { padding: 7, marginRight: -7 },
  socialJoin: { backgroundColor: green, borderRadius: 14, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 },
  auth: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 20 },
  authHeader: { alignItems: 'center', marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandLogo: { width: 44, height: 44, marginRight: 8 },
  brand: { color: theme.inkStrong, fontSize: 32, fontFamily: theme.font.extrabold, letterSpacing: -0.5 },
  tm: { color: green, fontSize: 13 },
  tagline: { color: green, fontSize: 14, fontFamily: theme.font.bold, marginBottom: 8 },
  authDescription: { color: theme.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 12 },
  authCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 18, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  fieldLabel: { color: theme.ink, fontSize: 13, fontFamily: theme.font.bold, marginBottom: 6 },
  title: { color: theme.inkStrong, fontSize: 25, fontFamily: theme.font.extrabold, marginBottom: 4, letterSpacing: -0.5, textAlign: 'center' },
  muted: { color: theme.muted, fontSize: 13 },
  mutedLine: { color: theme.muted, fontSize: 15, marginHorizontal: 22, marginBottom: 14 },
  input: { backgroundColor: theme.surface, color: theme.ink, borderWidth: 1.5, borderColor: theme.borderStrong, borderRadius: 14, paddingHorizontal: 16, height: 50, fontSize: 15, fontFamily: theme.font.regular, marginBottom: 12 },
  inputFocused: { borderColor: green },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.borderStrong, borderRadius: 14, height: 50, paddingHorizontal: 16, marginBottom: 14 },
  passwordInput: { flex: 1, color: theme.ink, height: '100%', fontSize: 15, fontFamily: theme.font.regular },
  eyeButton: { paddingVertical: 8, paddingHorizontal: 6 },
  eyeButtonText: { color: green, fontFamily: theme.font.semibold, fontSize: 13 },
  button: { backgroundColor: green, borderRadius: 14, alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 2 },
  buttonBottom: { backgroundColor: green, borderRadius: 15, alignItems: 'center', padding: 17, margin: 18 },
  buttonText: { color: 'white', fontSize: 15, fontFamily: theme.font.bold },
  link: { color: green, textAlign: 'center', marginTop: 22, fontFamily: theme.font.bold },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22 },
  overline: { color: green, fontSize: 12, fontFamily: theme.font.extrabold, letterSpacing: 2 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' },
  roundText: { color: green, fontSize: 25 },
  segment: { flexDirection: 'row', marginBottom: 14, backgroundColor: theme.surfaceMuted, borderRadius: 14, padding: 3 },
  segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11 },
  segmentActive: { backgroundColor: green },
  authSegmentActive: { backgroundColor: theme.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  authSegmentText: { color: green, fontFamily: theme.font.bold },
  segmentText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 14 },
  segmentActiveText: { color: 'white' }, content: { paddingHorizontal: 18, paddingBottom: 80 }, empty: { textAlign: 'center', color: theme.subtle, marginTop: 70, fontSize: 16 }, card: { backgroundColor: theme.surface, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: theme.border }, cardIcon: { backgroundColor: theme.blueSoft, borderRadius: 14, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, cardEmoji: { fontSize: 24 }, cardTitle: { color: theme.ink, fontSize: 17, fontFamily: theme.font.bold, marginBottom: 4 }, arrow: { color: theme.muted, fontSize: 28 },
  item: { backgroundColor: theme.surface, borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, check: { width: 26, height: 26, borderWidth: 2, borderColor: theme.borderStrong, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checked: { backgroundColor: green, borderColor: green }, checkText: { color: 'white', fontFamily: theme.font.extrabold }, itemText: { flex: 1, color: theme.ink, fontSize: 16, fontFamily: theme.font.semibold }, done: { textDecorationLine: 'line-through', color: theme.subtle }, composer: { flexDirection: 'row', backgroundColor: theme.surface, padding: 12, alignItems: 'center' }, plus: { width: 50, height: 50, backgroundColor: green, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginLeft: 6 }, plusText: { color: 'white', fontSize: 26 },
  landing: { paddingHorizontal: 18, paddingBottom: 36 }, landingHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerAction: { backgroundColor: green, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 10 }, headerActionText: { color: 'white', fontSize: 14, fontFamily: theme.font.bold }, heroTitle: { color: theme.inkStrong, fontSize: 35, lineHeight: 40, fontFamily: theme.font.extrabold, letterSpacing: -1.2, textAlign: 'center', marginTop: 24 }, heroSubtitle: { color: theme.muted, fontSize: 17, lineHeight: 25, textAlign: 'center', marginTop: 17 }, heroActions: { marginTop: 25, gap: 11 }, heroPrimary: { marginTop: 0 }, heroSecondary: { padding: 15, alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.surface }, heroSecondaryText: { color: green, fontSize: 16, fontFamily: theme.font.bold }, demoCard: { marginTop: 30, padding: 20, backgroundColor: theme.surface, borderRadius: 28, borderWidth: 1, borderColor: theme.border, elevation: 3 }, demoEyebrow: { color: green, fontFamily: theme.font.extrabold, fontSize: 12, letterSpacing: 1.5 }, demoTitle: { color: theme.ink, fontSize: 22, fontFamily: theme.font.extrabold, marginTop: 5, marginBottom: 20 }, demoComposer: { flexDirection: 'row', alignItems: 'center' }, demoInput: { flex: 1, color: theme.ink, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, padding: 14, borderRadius: 13, fontSize: 15 }, demoItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: theme.background, borderRadius: 15, marginBottom: 14 }, demoHint: { color: theme.muted, lineHeight: 22, marginBottom: 12 }, benefits: { marginTop: 30, gap: 13 }, benefit: { color: theme.muted, fontSize: 15, fontFamily: theme.font.semibold }, authBack: { color: green, fontFamily: theme.font.bold, fontSize: 15, marginBottom: 28 },
  dockContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, zIndex: 100 },
  dock: { flexDirection: 'row', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 22, padding: 6, gap: 6, minHeight: 58, alignItems: 'center', justifyContent: 'space-between', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8 },
  dockButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, flexDirection: 'row', gap: 6, paddingHorizontal: 6 },
  dockPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  dockActive: { flex: 2.3, backgroundColor: '#0943F1', shadowColor: '#0943F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
  dockActiveText: { color: '#FFFFFF', fontFamily: theme.font.semibold, fontSize: 14 },
}));

