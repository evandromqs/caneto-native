import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { AppButton } from '../../ui/primitives';
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
  const [store, setStore] = useState(list.storeName ?? '');
  const [isShared, setIsShared] = useState(list.permission !== 'owner');
  const [ownerName, setOwnerName] = useState(list.permission !== 'owner' ? 'Outro usuário' : '');
  const [isMergingOpen, setIsMergingOpen] = useState(false);
  const [selectedSourceListId, setSelectedSourceListId] = useState<string>('');
  const [deleteSourceAfterMerge, setDeleteSourceAfterMerge] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const own = list.permission === 'owner';
  const canEdit = own || list.permission === 'editor';

  const otherOpenLists = lists.filter(l => !l.isCompleted && l.id !== list.id);
  const selectedSource = otherOpenLists.find(l => l.id === selectedSourceListId);

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

  const handleConfirmMerge = async () => {
    if (!selectedSourceListId || !onMergeLists) return;
    await run(async () => {
      await onMergeLists(list.id, selectedSourceListId, deleteSourceAfterMerge);
      setIsMergingOpen(false);
    }, true);
  };

  const confirmDelete = () => {
    Alert.alert('Excluir lista?', `A lista “${list.name}” e seus itens serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void run(() => onDelete(list), true) },
    ]);
  };

  const footer = (
    <View style={styles.footerActions}>
      <AppButton label={canEdit ? 'Cancelar' : 'Fechar'} variant="ghost" onPress={onClose} disabled={busy} style={styles.footerButton} />
      {canEdit && (
        <AppButton
          label="Salvar Alterações"
          icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
          loading={busy}
          disabled={!name.trim()}
          onPress={save}
          style={styles.saveButton}
        />
      )}
    </View>
  );

  return (
    <ModalSheet
      visible
      title="Editar Lista"
      subtitle="Nome, estabelecimento e modo de conexão"
      headerIcon={<Ionicons name="create-outline" size={21} color={theme.blue} />}
      onClose={onClose}
      footer={footer}
    >
      {canEdit && (
        <View style={styles.form}>
          {/* Nome da Lista */}
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

          {/* Supermercado / Estabelecimento */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelWithIcon}>
              <Ionicons name="storefront-outline" size={14} color={theme.blue} />
              <Text style={styles.fieldLabel}>Supermercado / Estabelecimento (Opcional)</Text>
            </View>
            <TextInput
              style={styles.input}
              value={store}
              onChangeText={setStore}
              placeholder="Ex: Pão de Açúcar, Carrefour, Atacadão..."
              placeholderTextColor={theme.placeholder}
              maxLength={120}
            />
          </View>
        </View>
      )}

      {/* Tipo de Lista / Origem */}
      <View style={styles.originSection}>
        <View style={styles.labelWithIcon}>
          <Ionicons name="link-outline" size={14} color={theme.blue} />
          <Text style={styles.fieldLabel}>Tipo de Lista / Origem</Text>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentTab, !isShared && styles.segmentTabActive]}
            onPress={() => setIsShared(false)}
          >
            <Ionicons name="person-outline" size={15} color={!isShared ? theme.blue : theme.muted} />
            <Text style={[styles.segmentText, !isShared && styles.segmentTextActive]}>
              Minha Lista (Própria)
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, isShared && styles.segmentTabConnected]}
            onPress={() => {
              setIsShared(true);
              if (!ownerName || ownerName === 'Você') setOwnerName('Ana Souza');
            }}
          >
            <Ionicons name="link-outline" size={15} color={isShared ? '#FFFFFF' : theme.muted} />
            <Text style={[styles.segmentText, isShared && styles.segmentTextConnected]}>
              Conectada
            </Text>
          </Pressable>
        </View>

        {isShared && (
          <View style={styles.connectedSubform}>
            <View style={styles.labelWithIcon}>
              <Ionicons name="people-outline" size={13} color={theme.blue} />
              <Text style={styles.connectedLabel}>Nome do usuário proprietário</Text>
            </View>
            <TextInput
              style={[styles.input, styles.connectedInput]}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Ex: Ana Souza, Carlos Silva, etc."
              placeholderTextColor={theme.placeholder}
            />
            <View style={styles.connectionCard}>
              <Ionicons name="link-outline" size={15} color={theme.blue} />
              <Text style={styles.connectionCardText}>
                No card será exibido: <Text style={styles.boldText}>Criado por {ownerName || 'outro usuário'}</Text>
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Ações Secundárias: Compartilhar, Duplicar, Unir, Lixeira, Excluir */}
      <View style={styles.secondarySection}>
        <View style={styles.quickActions}>
          {own && (
            <QuickAction
              icon="share-social-outline"
              label="Compartilhar"
              onPress={() => {
                onClose();
                void onShare(list);
              }}
              disabled={busy}
            />
          )}
          <QuickAction
            icon="copy-outline"
            label="Duplicar"
            onPress={() => void run(() => onDuplicate(list), true)}
            disabled={busy}
          />
          {onMergeLists && (
            <QuickAction
              icon="git-merge-outline"
              label="Unir"
              active={isMergingOpen}
              onPress={() => setIsMergingOpen(v => !v)}
              disabled={busy}
            />
          )}
          {onOpenTrash && !list.isCompleted && list.permission !== 'viewer' && (
            <QuickAction
              icon="archive-outline"
              label={`Lixeira${trashCount && trashCount > 0 ? ` (${trashCount})` : ''}`}
              onPress={() => {
                onClose();
                onOpenTrash(list);
              }}
              disabled={busy}
            />
          )}
          {own && onComplete && (
            <QuickAction
              icon={list.isCompleted ? 'refresh-outline' : 'checkmark-circle-outline'}
              label={list.isCompleted ? 'Reabrir' : 'Finalizar'}
              onPress={() => {
                if (list.isCompleted) void run(() => onComplete(list), true);
                else {
                  onClose();
                  void onComplete(list);
                }
              }}
              disabled={busy}
            />
          )}
          {own && <QuickAction icon="trash-outline" label="Excluir" onPress={confirmDelete} disabled={busy} danger />}
        </View>
      </View>

      {/* 🔀 PAINEL DE UNIR LISTA COM OUTRA EM ABERTO */}
      {isMergingOpen && (
        <View style={styles.mergePanel}>
          <View style={styles.mergeHeader}>
            <View style={styles.mergeTitleWrap}>
              <Ionicons name="git-merge-outline" size={17} color={theme.blue} />
              <Text style={styles.mergeTitle}>Unir com outra lista em aberto</Text>
            </View>
            <Pressable onPress={() => setIsMergingOpen(false)} style={styles.mergeClose}>
              <Ionicons name="close" size={17} color={theme.muted} />
            </Pressable>
          </View>

          <Text style={styles.mergeDescription}>
            Selecione outra lista em aberto para adicionar todos os itens dela a{' '}
            <Text style={styles.boldText}>“{list.name}”</Text>:
          </Text>

          {otherOpenLists.length === 0 ? (
            <View style={styles.mergeEmpty}>
              <Text style={styles.mergeEmptyText}>Não há outras listas em aberto disponíveis para unir.</Text>
            </View>
          ) : (
            <View style={styles.mergeForm}>
              <ScrollView style={styles.sourceListsContainer} nestedScrollEnabled>
                {otherOpenLists.map(sourceList => {
                  const isChosen = selectedSourceListId === sourceList.id;
                  return (
                    <Pressable
                      key={sourceList.id}
                      style={[styles.sourceListOption, isChosen && styles.sourceListOptionActive]}
                      onPress={() => setSelectedSourceListId(sourceList.id)}
                    >
                      <Ionicons
                        name={isChosen ? 'radio-button-on' : 'radio-button-off'}
                        size={17}
                        color={isChosen ? theme.blue : theme.muted}
                      />
                      <Text style={[styles.sourceListName, isChosen && styles.sourceListNameActive]} numberOfLines={1}>
                        {sourceList.name}
                      </Text>
                      <Text style={styles.sourceListItemCount}>({sourceList.items.length} itens)</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!!selectedSource && (
                <View style={styles.sourceInfoCard}>
                  <Text style={styles.sourceInfoText}>
                    Serão importados <Text style={styles.boldText}>{selectedSource.items.length} item(ns)</Text> da lista selecionada.
                  </Text>
                </View>
              )}

              <Pressable
                style={styles.deleteSourceCheckboxRow}
                onPress={() => setDeleteSourceAfterMerge(v => !v)}
              >
                <Ionicons
                  name={deleteSourceAfterMerge ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={deleteSourceAfterMerge ? theme.blue : theme.muted}
                />
                <Text style={styles.deleteSourceText}>Excluir a outra lista após unir</Text>
              </Pressable>

              <Pressable
                style={[styles.mergeConfirmButton, (!selectedSourceListId || busy) && styles.disabled]}
                disabled={!selectedSourceListId || busy}
                onPress={() => void handleConfirmMerge()}
              >
                <Ionicons name="git-merge-outline" size={17} color="#FFFFFF" />
                <Text style={styles.mergeConfirmText}>{busy ? 'Unindo listas...' : 'Confirmar e Unir Listas'}</Text>
              </Pressable>
            </View>
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
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : danger ? theme.danger : theme.blue} />
      <Text style={[styles.quickActionText, active && styles.quickActionTextActive, danger && styles.dangerText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { gap: 12, marginBottom: 4 },
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
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 11,
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
