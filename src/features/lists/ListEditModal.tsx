import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { AppButton, AppField, AppText } from '../../ui/primitives';
import { theme } from '../../ui/theme';
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
  const run = async (operation: () => MaybePromise, close = false) => {
    if (busy) return;
    try { setBusy(true); setError(''); await operation(); if (close) onClose(); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
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
    {own && <>
      <AppField label="Nome da lista" value={name} onChangeText={setName} placeholder="Ex: Compras do Mês" maxLength={80} autoFocus />
      <AppField label="Supermercado / Estabelecimento (Opcional)" value={store} onChangeText={setStore} placeholder="Ex: Carrefour" maxLength={120} />
      <AppButton label="Salvar alterações" loading={busy} disabled={!name.trim()} onPress={save} />
    </>}
    <View style={styles.actions}>
      {own && <AppButton label="Compartilhar" variant="secondary" icon={<Ionicons name="share-social-outline" size={18} color={theme.ink} />} disabled={busy} onPress={() => { onClose(); void onShare(list); }} style={styles.action} />}
      <AppButton label="Duplicar" variant="secondary" icon={<Ionicons name="copy-outline" size={18} color={theme.ink} />} disabled={busy} onPress={() => void run(() => onDuplicate(list), true)} style={styles.action} />
      {onOpenTrash && !list.isCompleted && list.permission !== 'viewer' && (
        <AppButton
          label={`Lixeira${trashCount && trashCount > 0 ? ` (${trashCount})` : ''}`}
          variant="secondary"
          icon={<Ionicons name="trash-outline" size={18} color={theme.ink} />}
          disabled={busy}
          onPress={() => { onClose(); onOpenTrash(list); }}
          style={styles.action}
        />
      )}
      {own && onComplete && <AppButton label={list.isCompleted ? 'Reabrir' : 'Finalizar'} variant="secondary" icon={<Ionicons name={list.isCompleted ? 'refresh-outline' : 'checkmark-circle-outline'} size={18} color={theme.ink} />} disabled={busy} onPress={() => { if (list.isCompleted) void run(() => onComplete(list), true); else { onClose(); void onComplete(list); } }} style={styles.action} />}
      {own && <AppButton label="Excluir" variant="ghost" icon={<Ionicons name="trash-outline" size={18} color={theme.danger} />} disabled={busy} onPress={confirmDelete} textStyle={styles.dangerText} style={styles.action} />}
    </View>
    {!!error && <AppText accessibilityRole="alert" style={styles.errorText}>{error}</AppText>}
    <View style={styles.footer}><AppButton label="Cancelar" variant="ghost" onPress={onClose} disabled={busy} /></View>
  </ModalSheet>;
}

const styles = StyleSheet.create({
  actions: { borderTopWidth: 1, borderColor: theme.border, marginTop: 18, paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingHorizontal: 12 }, dangerText: { color: theme.danger },
  errorText: { color: theme.danger, marginTop: 12 },
  footer: { marginTop: 15, alignItems: 'flex-end' },
});
