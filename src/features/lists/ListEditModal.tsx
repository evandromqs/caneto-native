import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';

type MaybePromise = void | Promise<void>;

export interface ListEditModalProps {
  list: ShoppingList | null;
  lists?: ShoppingList[];
  trashCount?: number;
  onOpenTrash?: (list: ShoppingList) => void;
  onClose: () => void;
  onSave: (list: ShoppingList, changes: { name: string; storeName?: string; isShared?: boolean; ownerName?: string }) => MaybePromise;
  onShare: (list: ShoppingList) => MaybePromise;
  onDuplicate: (list: ShoppingList) => MaybePromise;
  onDelete: (list: ShoppingList) => MaybePromise;
  onMergeLists?: (targetListId: string, sourceListId: string, deleteSource?: boolean) => MaybePromise;
  onComplete?: (list: ShoppingList) => MaybePromise;
}

export function ListEditModal(props: ListEditModalProps) {
  return props.list ? <ListEditDialog key={props.list.id} {...props} list={props.list} /> : null;
}

function ListEditDialog({
  list,
  lists = [],
  trashCount,
  onOpenTrash,
  onClose,
  onSave,
  onShare,
  onDuplicate,
  onDelete,
  onMergeLists,
  onComplete,
}: ListEditModalProps & { list: ShoppingList }) {
  const [name, setName] = useState(list.name);
  const [editingName, setEditingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [store] = useState(list.storeName ?? '');
  const [isShared] = useState(list.permission !== 'owner');
  const [ownerName] = useState(list.permission !== 'owner' ? 'Outro usuário' : '');

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
    if (!trimmed) {
      setError('Informe o nome da lista.');
      return;
    }
    void run(
      () =>
        onSave(list, {
          name: trimmed,
          storeName: store.trim() || undefined,
          isShared,
          ownerName: isShared ? ownerName.trim() || undefined : undefined,
        }),
      true,
    );
  };

  const footer = (
    <View style={styles.footerVertical}>
      {confirmingDelete ? (
        <Pressable
          style={({ pressed }) => [styles.dangerFilledBtn, pressed && styles.pressed, busy && styles.disabled]}
          onPress={() => void run(() => onDelete(list), true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Confirmar exclusão da lista"
        >
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{busy ? 'Excluindo...' : 'Excluir lista'}</Text>
        </Pressable>
      ) : (
        canEdit && editingName && (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, (busy || !name.trim()) && styles.disabled]}
            onPress={save}
            disabled={busy || !name.trim()}
            accessibilityRole="button"
            accessibilityLabel="Salvar"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>{busy ? 'Salvando...' : 'Salvar'}</Text>
          </Pressable>
        )
      )}
      <Pressable
        style={({ pressed }) => [confirmingDelete ? styles.cancelNeutralBtn : styles.cancelBtnRed, pressed && styles.pressed]}
        onPress={() => {
          if (confirmingDelete) {
            setConfirmingDelete(false);
          } else if (editingName) {
            setEditingName(false);
          } else {
            onClose();
          }
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
      >
        <Text style={confirmingDelete ? styles.cancelNeutralBtnText : styles.cancelBtnRedText}>Cancelar</Text>
      </Pressable>
    </View>
  );

  return (
    <ModalSheet
      visible
      title={confirmingDelete ? 'Excluir lista?' : editingName ? 'Editar Nome' : 'Opções'}
      hideCloseButton
      centerTitle
      onClose={onClose}
      footer={footer}
    >
      {confirmingDelete ? (
        <View style={styles.confirmBody}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="trash-outline" size={24} color={theme.danger} />
          </View>
          <Text style={styles.confirmMessage}>
            A lista “{list.name}” e todos os seus itens serão removidos permanentemente.
          </Text>
        </View>
      ) : canEdit && editingName ? (
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Nome da Lista</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Compras do Mês"
              placeholderTextColor={theme.placeholder}
              maxLength={80}
              autoFocus
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionsGrid}>
          {canEdit && (
            <QuickAction
              icon="create-outline"
              label="Editar nome"
              disabled={busy}
              onPress={() => setEditingName(true)}
            />
          )}
          {!!onShare && (
            <QuickAction
              icon="share-social-outline"
              label="Compartilhar"
              disabled={busy}
              onPress={() => { onClose(); onShare(list); }}
            />
          )}
          {!!onOpenTrash && (
            <QuickAction
              icon="trash-outline"
              label={`Lixeira${(trashCount ?? 0) > 0 ? ` (${trashCount})` : ''}`}
              disabled={busy}
              onPress={() => { onClose(); onOpenTrash(list); }}
            />
          )}
          <QuickAction
            icon="print-outline"
            label="Imprimir"
            disabled={busy}
            onPress={() => {
              const lines = (list.items ?? []).map(it => `${it.checked ? '☑' : '☐'} ${it.name} (${it.quantity} ${it.unit})`);
              void Share.share({
                title: list.name,
                message: `${list.name}\n\n${lines.length ? lines.join('\n') : 'Lista vazia'}`,
              });
            }}
          />
          {!!onDelete && canEdit && (
            <QuickAction
              icon="trash-bin-outline"
              label="Excluir lista"
              danger
              disabled={busy}
              onPress={() => setConfirmingDelete(true)}
            />
          )}
        </View>
      )}

      {!!error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}
    </ModalSheet>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  disabled,
  active = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        active && styles.quickActionActive,
        danger && styles.quickActionDanger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : danger ? theme.danger : theme.ink} />
      <Text style={[styles.quickActionText, active && styles.quickActionTextActive, danger && styles.dangerText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { gap: 12, marginBottom: 4 },
  actionsGrid: { flexDirection: 'column', gap: 8, marginTop: 10 },
  footerVertical: { flexDirection: 'column', gap: 8, width: '100%' },
  primaryBtn: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dangerFilledBtn: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryBtnText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  cancelBtnRed: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  cancelBtnRedText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  cancelNeutralBtn: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center' },
  cancelNeutralBtnText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  confirmBody: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  confirmIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  confirmMessage: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  fieldGroup: { gap: 5 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    color: theme.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: theme.font.semibold,
  },
  originSection: { marginTop: 10, gap: 8 },
  segmentedControl: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 16,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segmentTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 1,
  },
  segmentTabConnected: {
    backgroundColor: theme.blue,
  },
  segmentText: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 13 },
  segmentTextActive: { color: theme.blue },
  segmentTextConnected: { color: '#FFFFFF' },
  connectedSubform: { gap: 6, marginTop: 4 },
  connectedLabel: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 13 },
  connectedInput: { borderColor: theme.blueLight },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: theme.border,
  },
  connectionCardText: { flex: 1, color: theme.ink, fontFamily: theme.font.regular, fontSize: 12, lineHeight: 18 },
  boldText: { fontFamily: theme.font.bold },
  secondarySection: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginTop: 14,
    paddingTop: 12,
  },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surfaceMuted,
  },
  quickActionActive: {
    backgroundColor: theme.blue,
    borderColor: theme.blue,
  },
  quickActionDanger: { backgroundColor: theme.dangerSoft, borderColor: theme.dangerSoft },
  quickActionText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  quickActionTextActive: { color: '#FFFFFF' },
  dangerText: { color: theme.danger },
  mergePanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  mergeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mergeTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mergeTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  mergeClose: { padding: 4 },
  mergeDescription: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12, lineHeight: 17 },
  mergeEmpty: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeEmptyText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center' },
  mergeForm: { gap: 10 },
  sourceListsContainer: { maxHeight: 120 },
  sourceListOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  sourceListOptionActive: { borderColor: theme.blue },
  sourceListName: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  sourceListNameActive: { color: theme.blue, fontFamily: theme.font.bold },
  sourceListItemCount: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12 },
  sourceInfoCard: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sourceInfoText: { color: theme.ink, fontFamily: theme.font.regular, fontSize: 12 },
  deleteSourceCheckboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  deleteSourceText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 },
  mergeConfirmButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: theme.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  mergeConfirmText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 13 },
  errorText: { color: theme.danger, marginTop: 10, fontFamily: theme.font.semibold, fontSize: 13 },
  footerActions: { flexDirection: 'row', gap: 10 },
  footerButton: { flex: 1, minHeight: 46 },
  saveButton: { flex: 1.35, minHeight: 46 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
}));
