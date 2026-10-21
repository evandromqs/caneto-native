import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { AppButton, AppText, IconButton, SurfaceCard } from '../../ui/primitives';
import { theme } from '../../ui/theme';

type MaybePromise = void | Promise<void>;

export interface ListManagerModalProps {
  visible: boolean;
  lists: readonly ShoppingList[];
  activeListId?: string;
  onClose: () => void;
  onSelectList: (list: ShoppingList) => MaybePromise;
  onCreateList: (name: string) => MaybePromise;
  onRenameList?: (list: ShoppingList, name: string) => MaybePromise;
  onDuplicateList: (list: ShoppingList) => MaybePromise;
  onDeleteList: (list: ShoppingList) => MaybePromise;
}

export function ListManagerModal(props: ListManagerModalProps) {
  return props.visible ? <ListManagerDialog {...props} /> : null;
}

function ListManagerDialog({ lists, activeListId, onClose, onSelectList, onCreateList, onRenameList, onDuplicateList, onDeleteList }: ListManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => MaybePromise) => {
    if (busy) return;
    try { setBusy(true); await operation(); } catch (error) { Alert.alert('Não foi possível concluir', error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };
  const create = () => {
    const name = newName.trim();
    if (!name) return;
    void run(async () => { await onCreateList(name); setNewName(''); });
  };
  const rename = (list: ShoppingList) => {
    const name = editingName.trim();
    if (!name || !onRenameList) return;
    void run(async () => { await onRenameList(list, name); setEditingId(null); });
  };
  const confirmDelete = (list: ShoppingList) => Alert.alert('Excluir lista?', `A lista “${list.name}” e seus itens serão removidos.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => void run(() => onDeleteList(list)) },
  ]);

  return <ModalSheet visible title="Minhas Listas" subtitle="Crie e organize listas para diferentes ocasiões" onClose={onClose} footer={<AppButton label="Fechar" variant="ghost" onPress={onClose} />}>
    <View style={styles.createRow}>
      <TextInput value={newName} onChangeText={setNewName} placeholder="Nome da nova lista..." placeholderTextColor={theme.placeholder} accessibilityLabel="Nome da nova lista" maxLength={80} onSubmitEditing={create} returnKeyType="done" style={styles.createInput} />
      <AppButton label="Criar" disabled={!newName.trim() || busy} icon={<Ionicons name="add" size={17} color={theme.surface} />} onPress={create} />
    </View>
    {lists.map(list => {
      const active = list.id === activeListId;
      const editing = list.id === editingId;
      const pending = list.items.filter(item => !item.checked).length;
      const owned = list.permission === 'owner';
      return <SurfaceCard key={list.id} style={StyleSheet.flatten([styles.row, active && styles.activeRow])}>
        {editing ? <View style={styles.renameRow}>
          <TextInput value={editingName} onChangeText={setEditingName} accessibilityLabel={`Novo nome de ${list.name}`} autoFocus onSubmitEditing={() => rename(list)} maxLength={80} style={styles.renameInput} />
          <IconButton label="Salvar nome" onPress={() => rename(list)} icon={<Ionicons name="checkmark" size={20} color={theme.blue} />} />
          <IconButton label="Cancelar edição" onPress={() => setEditingId(null)} icon={<Ionicons name="close" size={20} color={theme.muted} />} />
        </View> : <View style={styles.listRow}>
          <Pressable style={styles.listInfo} accessibilityRole="button" accessibilityLabel={`Abrir ${list.name}`} onPress={() => void run(async () => { await onSelectList(list); onClose(); })}>
            <View style={styles.nameRow}><AppText numberOfLines={1} style={[styles.listName, active && styles.activeName]}>{list.name}</AppText>{active && <AppText style={styles.activeBadge}>Ativa</AppText>}</View>
            <AppText tone="caption">{list.items.length} itens ({pending} pendentes)</AppText>
          </Pressable>
          {owned && !!onRenameList && <IconButton label={`Renomear ${list.name}`} onPress={() => { setEditingId(list.id); setEditingName(list.name); }} icon={<Ionicons name="create-outline" size={19} color={theme.muted} />} />}
          <IconButton label={`Duplicar ${list.name}`} onPress={() => void run(() => onDuplicateList(list))} icon={<Ionicons name="copy-outline" size={19} color={theme.muted} />} />
          {owned && <IconButton label={`Excluir ${list.name}`} onPress={() => confirmDelete(list)} icon={<Ionicons name="trash-outline" size={19} color={theme.danger} />} />}
        </View>}
      </SurfaceCard>;
    })}
  </ModalSheet>;
}

const styles = StyleSheet.create({
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  createInput: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.lg, paddingHorizontal: 12, color: theme.ink, backgroundColor: theme.background, fontFamily: theme.font.regular, fontSize: 16 },
  row: { padding: 11, borderRadius: theme.radius.lg, marginBottom: 8 }, activeRow: { borderColor: theme.blue },
  listRow: { flexDirection: 'row', alignItems: 'center' }, listInfo: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, listName: { flexShrink: 1, color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, activeName: { color: theme.blue }, activeBadge: { color: theme.blue, backgroundColor: theme.blueSoft, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 7, fontFamily: theme.font.bold, fontSize: 12 },
  renameRow: { flexDirection: 'row', alignItems: 'center' }, renameInput: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: theme.blue, borderRadius: 10, paddingHorizontal: 10, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 16 },
});
