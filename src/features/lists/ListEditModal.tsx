import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { AppButton, AppField, AppText } from '../../ui/primitives';
import { createThemedStyles, theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';

type MaybePromise = void | Promise<void>;

export interface ListEditModalProps {
  list: ShoppingList | null;
  trashCount?: number;
  onOpenTrash?: (list: ShoppingList) => void;
  onClose: () => void;
  onSave: (list: ShoppingList, changes: { name: string; storeName?: string }) => MaybePromise;
  onShare: (list: ShoppingList) => MaybePromise;
  onDuplicate: (list: ShoppingList) => MaybePromise;
  onDelete: (list: ShoppingList) => MaybePromise;
  onComplete?: (list: ShoppingList) => MaybePromise;
}

export function ListEditModal(props: ListEditModalProps) {
  return props.list ? <ListEditDialog key={props.list.id} {...props} list={props.list} /> : null;
}

function ListEditDialog({ list, trashCount, onOpenTrash, onClose, onSave, onShare, onDuplicate, onDelete, onComplete }: ListEditModalProps & { list: ShoppingList }) {
  const [name, setName] = useState(list.name);
  const [store, setStore] = useState(list.storeName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const own = list.permission === 'owner';
  const canEdit = own || list.permission === 'editor';

  const run = async (operation: () => MaybePromise, close = false) => {
    if (busy) return;
    try {
      setBusy(true);
      setError('');
      await operation();
      if (close) onClose();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Informe o nome da lista.'); return; }
    void run(() => onSave(list, { name: trimmed, storeName: store.trim() || undefined }), true);
  };

  const confirmDelete = () => Alert.alert('Excluir lista?', `A lista “${list.name}” e seus itens serão removidos.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => void run(() => onDelete(list), true) },
  ]);

  const footer = <View style={styles.footerActions}>
    <AppButton label={canEdit ? 'Cancelar' : 'Fechar'} variant="ghost" onPress={onClose} disabled={busy} style={styles.footerButton} />
    {canEdit && <AppButton label="Salvar Alterações" icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />} loading={busy} disabled={!name.trim()} onPress={save} style={styles.saveButton} />}
  </View>;

  return <ModalSheet
    visible
    title="Editar Lista"
    subtitle="Nome, estabelecimento e modo de conexão"
    headerIcon={<Ionicons name="create-outline" size={21} color={theme.blue} />}
    onClose={onClose}
    footer={footer}
  >
    {canEdit && <View style={styles.form}>
      <AppField label="Nome da Lista" value={name} onChangeText={setName} placeholder="Ex: Compras do Mês" maxLength={80} autoFocus inputStyle={styles.strongInput} />
      <View style={styles.storeLabel}><Ionicons name="storefront-outline" size={15} color={theme.blue} /><AppText style={styles.inlineLabel}>Supermercado / Estabelecimento (Opcional)</AppText></View>
      <AppField label="" accessibilityLabel="Supermercado ou estabelecimento" value={store} onChangeText={setStore} placeholder="Ex: Pão de Açúcar, Carrefour, Atacadão..." maxLength={120} inputStyle={styles.strongInput} />
    </View>}

    <View style={styles.originSection}>
      <View style={styles.sectionLabel}><Ionicons name="link-outline" size={15} color={theme.blue} /><AppText style={styles.sectionLabelText}>Tipo de Lista / Origem</AppText></View>
      <View style={styles.originOptions}>
        <View style={[styles.originOption, own && styles.originOptionSelected]}><Ionicons name="person-outline" size={16} color={own ? theme.blue : theme.muted} /><AppText style={[styles.originText, own && styles.originTextSelected]}>Minha Lista</AppText></View>
        <View style={[styles.originOption, !own && styles.originOptionConnected]}><Ionicons name="link-outline" size={16} color={!own ? '#FFFFFF' : theme.muted} /><AppText style={[styles.originText, !own && styles.originTextConnected]}>Conectada</AppText></View>
      </View>
      {!own && <View style={styles.connectionHint}><Ionicons name="people-outline" size={16} color={theme.blue} /><AppText style={styles.connectionHintText}>Acesso compartilhado · {list.permission === 'editor' ? 'você pode editar' : 'somente leitura'}</AppText></View>}
    </View>

    <View style={styles.secondarySection}>
      <AppText style={styles.secondaryTitle}>Ações da lista</AppText>
      <View style={styles.quickActions}>
        {own && <QuickAction icon="share-social-outline" label="Compartilhar" onPress={() => { onClose(); void onShare(list); }} disabled={busy} />}
        <QuickAction icon="copy-outline" label="Duplicar" onPress={() => void run(() => onDuplicate(list), true)} disabled={busy} />
        {onOpenTrash && !list.isCompleted && list.permission !== 'viewer' && <QuickAction icon="archive-outline" label={`Lixeira${trashCount && trashCount > 0 ? ` (${trashCount})` : ''}`} onPress={() => { onClose(); onOpenTrash(list); }} disabled={busy} />}
        {own && onComplete && <QuickAction icon={list.isCompleted ? 'refresh-outline' : 'checkmark-circle-outline'} label={list.isCompleted ? 'Reabrir' : 'Finalizar'} onPress={() => { if (list.isCompleted) void run(() => onComplete(list), true); else { onClose(); void onComplete(list); } }} disabled={busy} />}
        {own && <QuickAction icon="trash-outline" label="Excluir" onPress={confirmDelete} disabled={busy} danger />}
      </View>
    </View>

    {!!error && <AppText accessibilityRole="alert" style={styles.errorText}>{error}</AppText>}
  </ModalSheet>;
}

function QuickAction({ icon, label, onPress, disabled, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <Pressable style={({ pressed }) => [styles.quickAction, danger && styles.quickActionDanger, pressed && styles.pressed, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
    <Ionicons name={icon} size={16} color={danger ? theme.danger : theme.blue} />
    <AppText style={[styles.quickActionText, danger && styles.dangerText]}>{label}</AppText>
  </Pressable>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { marginBottom: 4 },
  strongInput: { fontFamily: theme.font.semibold },
  storeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: -8 },
  inlineLabel: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15 },
  originSection: { marginTop: 3, gap: 9 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabelText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  originOptions: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: 16, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  originOption: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  originOptionSelected: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  originOptionConnected: { backgroundColor: theme.blue },
  originText: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 13 },
  originTextSelected: { color: theme.blue },
  originTextConnected: { color: '#FFFFFF' },
  connectionHint: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.blueSoft },
  connectionHintText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12, lineHeight: 18 },
  secondarySection: { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 18, paddingTop: 14 },
  secondaryTitle: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 9 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  quickActionDanger: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerSoft },
  quickActionText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  dangerText: { color: theme.danger },
  errorText: { color: theme.danger, marginTop: 12, fontFamily: theme.font.semibold, fontSize: 13 },
  footerActions: { flexDirection: 'row', gap: 10 },
  footerButton: { flex: 1, minHeight: 46 },
  saveButton: { flex: 1.35, minHeight: 46 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
}));
