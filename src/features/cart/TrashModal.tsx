import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DeletedShoppingItem } from '../../core/models/caneto';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';
import { formatRemainingTime, SIX_HOURS_MS } from './trashRepository';

export interface TrashModalProps {
  visible: boolean;
  listName: string;
  trashItems: readonly DeletedShoppingItem[];
  onClose: () => void;
  onRestoreItem: (item: DeletedShoppingItem) => void | Promise<void>;
  onRestoreAll: () => void | Promise<void>;
  onEmptyTrash: () => void | Promise<void>;
}

export function TrashModal(props: TrashModalProps) {
  return props.visible ? <TrashDialog {...props} /> : null;
}

function TrashDialog({
  listName,
  trashItems,
  onClose,
  onRestoreItem,
  onRestoreAll,
  onEmptyTrash,
}: TrashModalProps) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);

  // Atualiza o relógio a cada minuto para manter os tempos de expiração precisos
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const validTrash = trashItems.filter(item => currentTime - item.deletedAt < SIX_HOURS_MS);

  const handleRestoreItem = async (item: DeletedShoppingItem) => {
    try {
      setBusyItem(item.id);
      await onRestoreItem(item);
    } catch (error) {
      Alert.alert('Erro ao restaurar', getErrorMessage(error));
    } finally {
      setBusyItem(null);
    }
  };

  const handleRestoreAll = async () => {
    try {
      setRestoringAll(true);
      await onRestoreAll();
    } catch (error) {
      Alert.alert('Erro ao restaurar todos', getErrorMessage(error));
    } finally {
      setRestoringAll(false);
    }
  };

  const handleEmptyTrash = () => {
    Alert.alert(
      'Esvaziar lixeira?',
      'Deseja realmente esvaziar a lixeira desta lista permanentemente? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Esvaziar',
          style: 'destructive',
          onPress: () => {
            void Promise.resolve(onEmptyTrash()).catch(error => {
              Alert.alert('Erro', getErrorMessage(error));
            });
          },
        },
      ]
    );
  };

  return (
    <ModalSheet
      visible
      title="Lixeira da Lista"
      subtitle={`${listName} • Itens salvos por até 6 horas`}
      onClose={onClose}
    >
      {validTrash.length > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.counterText}>
            {validTrash.length} {validTrash.length === 1 ? 'item na lixeira' : 'itens na lixeira'}
          </Text>
          <View style={styles.actionButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restaurar todos os itens"
              onPress={handleRestoreAll}
              disabled={restoringAll}
              style={[styles.restoreAllButton, restoringAll && styles.disabled]}
            >
              {restoringAll ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="arrow-undo" size={14} color="white" />
                  <Text style={styles.restoreAllText}>Restaurar Todos</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Esvaziar lixeira permanentemente"
              onPress={handleEmptyTrash}
              disabled={restoringAll}
              style={[styles.emptyButton, restoringAll && styles.disabled]}
            >
              <Text style={styles.emptyButtonText}>Esvaziar</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.listContainer} keyboardShouldPersistTaps="handled">
        {validTrash.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="file-tray-outline" size={32} color={theme.muted} />
            </View>
            <Text style={styles.emptyTitle}>A lixeira desta lista está vazia</Text>
            <Text style={styles.emptyDescription}>
              Quando você excluir itens da lista, eles ficarão salvos aqui por até 6 horas antes de
              serem apagados permanentemente.
            </Text>
          </View>
        ) : (
          validTrash.map(item => {
            const isRestoring = busyItem === item.id;
            const totalPrice =
              item.price != null ? (item.price * item.quantity).toFixed(2).replace('.', ',') : null;

            return (
              <View key={`${item.id}-${item.deletedAt}`} style={styles.itemRow}>
                <View style={styles.itemThumbnail}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.photo} />
                  ) : (
                    <Text style={styles.thumbnailText}>{item.quantity}x</Text>
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemMeta}>
                      {item.quantity} {item.unit}
                    </Text>
                    {totalPrice && <Text style={styles.itemMeta}>• R$ {totalPrice}</Text>}
                    <Text style={styles.itemMeta}>•</Text>
                    <View style={styles.timerBadge}>
                      <Ionicons name="time-outline" size={11} color="#D97706" />
                      <Text style={styles.timerText}>{formatRemainingTime(item.deletedAt)}</Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restaurar ${item.name}`}
                  onPress={() => handleRestoreItem(item)}
                  disabled={isRestoring || restoringAll}
                  style={[styles.restoreItemButton, isRestoring && styles.disabled]}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color={theme.blue} />
                  ) : (
                    <>
                      <Ionicons name="arrow-undo" size={13} color={theme.blue} />
                      <Text style={styles.restoreItemText}>Restaurar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar lixeira"
          style={styles.closeFooterButton}
          onPress={onClose}
        >
          <Text style={styles.closeFooterText}>Fechar</Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  counterText: {
    color: theme.ink,
    fontFamily: theme.font.semibold,
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.blue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  restoreAllText: {
    color: 'white',
    fontFamily: theme.font.bold,
    fontSize: 12,
  },
  emptyButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  emptyButtonText: {
    color: theme.danger,
    fontFamily: theme.font.semibold,
    fontSize: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  listContainer: {
    gap: 8,
    paddingBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  itemThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  thumbnailText: {
    fontFamily: theme.font.bold,
    fontSize: 13,
    color: theme.ink,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.ink,
    marginBottom: 2,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  itemMeta: {
    color: theme.muted,
    fontSize: 12,
    fontFamily: theme.font.regular,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timerText: {
    color: '#D97706',
    fontFamily: theme.font.semibold,
    fontSize: 11,
  },
  restoreItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.blueSoft,
    borderWidth: 1,
    borderColor: 'rgba(9, 67, 241, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },
  restoreItemText: {
    color: theme.blue,
    fontFamily: theme.font.bold,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.ink,
    textAlign: 'center',
  },
  emptyDescription: {
    fontFamily: theme.font.regular,
    fontSize: 13,
    color: theme.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  closeFooterButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: theme.surfaceMuted,
  },
  closeFooterText: {
    fontFamily: theme.font.bold,
    color: theme.ink,
    fontSize: 14,
  },
}));
