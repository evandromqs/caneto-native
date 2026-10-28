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

  return <ModalSheet visible title="Editar Lista" subtitle="Nome, estabelecimento e ações" onClose={onClose}>
    {canEdit && <View style={styles.form}>
      <AppField label="Nome da lista" value={name} onChangeText={setName} placeholder="Ex: Compras do Mês" maxLength={80} autoFocus />
      <AppField label="Supermercado / Estabelecimento (Opcional)" value={store} onChangeText={setStore} placeholder="Ex: Carrefour" maxLength={120} />
      <AppButton label="Salvar alterações" loading={busy} disabled={!name.trim()} onPress={save} style={styles.saveButton} />
    </View>}

    <View style={styles.actionList}>
      {own && (
        <Pressable style={styles.actionRow} onPress={() => { onClose(); void onShare(list); }} disabled={busy} accessibilityRole="button" accessibilityLabel="Compartilhar lista">
          <Ionicons name="share-social-outline" size={20} color={theme.blue} />
          <AppText style={styles.actionRowText}>Compartilhar lista</AppText>
          <Ionicons name="chevron-forward" size={17} color={theme.subtle} />
        </Pressable>
      )}
      <Pressable style={styles.actionRow} onPress={() => void run(() => onDuplicate(list), true)} disabled={busy} accessibilityRole="button" accessibilityLabel="Duplicar lista">
        <Ionicons name="copy-outline" size={20} color={theme.blue} />
        <AppText style={styles.actionRowText}>Duplicar lista</AppText>
        <Ionicons name="chevron-forward" size={17} color={theme.subtle} />
      </Pressable>
      {onOpenTrash && !list.isCompleted && list.permission !== 'viewer' && (
        <Pressable style={styles.actionRow} onPress={() => { onClose(); onOpenTrash(list); }} disabled={busy} accessibilityRole="button" accessibilityLabel="Abrir lixeira">
          <Ionicons name="trash-outline" size={20} color={theme.blue} />
          <AppText style={styles.actionRowText}>Lixeira{trashCount && trashCount > 0 ? ` (${trashCount})` : ''}</AppText>
          <Ionicons name="chevron-forward" size={17} color={theme.subtle} />
        </Pressable>
      )}
      {own && onComplete && (
        <Pressable style={styles.actionRow} onPress={() => { if (list.isCompleted) void run(() => onComplete(list), true); else { onClose(); void onComplete(list); } }} disabled={busy} accessibilityRole="button" accessibilityLabel={list.isCompleted ? 'Reabrir lista' : 'Finalizar compra'}>
          <Ionicons name={list.isCompleted ? 'refresh-outline' : 'checkmark-circle-outline'} size={20} color={theme.blue} />
          <AppText style={styles.actionRowText}>{list.isCompleted ? 'Reabrir lista' : 'Finalizar compra'}</AppText>
          <Ionicons name="chevron-forward" size={17} color={theme.subtle} />
        </Pressable>
      )}
      {own && (
        <Pressable style={styles.actionRow} onPress={confirmDelete} disabled={busy} accessibilityRole="button" accessibilityLabel="Excluir lista">
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
          <AppText style={[styles.actionRowText, styles.dangerText]}>Excluir lista</AppText>
          <Ionicons name="chevron-forward" size={17} color={theme.subtle} />
        </Pressable>
      )}
    </View>

    {!!error && <AppText accessibilityRole="alert" style={styles.errorText}>{error}</AppText>}
    <View style={styles.footer}>
      <AppButton label="Fechar" variant="ghost" onPress={onClose} disabled={busy} style={styles.cancelButton} />
    </View>
  </ModalSheet>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { marginBottom: 12 },
  saveButton: { width: '100%', minHeight: 48, marginTop: 4 },
  actionList: { borderTopWidth: 1, borderColor: theme.border, marginTop: 14, paddingTop: 6 },
  actionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: theme.border },
  actionRowText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15 },
  dangerText: { color: theme.danger },
  errorText: { color: theme.danger, marginTop: 12, fontFamily: theme.font.semibold, fontSize: 13 },
  footer: { marginTop: 14, alignItems: 'center' },
  cancelButton: { width: '100%', minHeight: 44 },
}));
