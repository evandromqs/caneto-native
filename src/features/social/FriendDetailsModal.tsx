import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingList } from '../../core/models/caneto';
import type { SocialFriend } from './SocialScreen';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { createThemedStyles, theme } from '../../ui/theme';

interface FriendDetailsModalProps {
  visible: boolean;
  friend: SocialFriend | null;
  allLists: ShoppingList[];
  onClose: () => void;
  onOpenList?: (listId: string) => void;
  onShareListWithFriend?: (listId: string, friend: SocialFriend) => Promise<void> | void;
  onRemoveFriend?: (friend: SocialFriend) => Promise<void> | void;
}

export function FriendDetailsModal({
  visible,
  friend,
  allLists,
  onClose,
  onOpenList,
  onShareListWithFriend,
  onRemoveFriend,
}: FriendDetailsModalProps) {
  const [tab, setTab] = useState<'lists' | 'share'>('lists');
  const [busyListId, setBusyListId] = useState<string | null>(null);

  if (!visible || !friend) return null;

  const sharedLists = allLists.filter(
    l => (l as any).sharedWith?.includes(friend.username) || (l as any).sharedWith?.includes(friend.id)
  );

  const unsharedLists = allLists.filter(
    l => !sharedLists.some(s => s.id === l.id) && l.permission === 'owner'
  );

  const handleRemove = () => {
    Alert.alert(
      'Remover amizade',
      `Deseja realmente desfazer a amizade com ${friend.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (onRemoveFriend) {
              await onRemoveFriend(friend);
              onClose();
            }
          },
        },
      ]
    );
  };

  const handleShare = async (listId: string) => {
    if (!onShareListWithFriend || busyListId) return;
    setBusyListId(listId);
    try {
      await onShareListWithFriend(listId, friend);
      Alert.alert('Sucesso', 'Lista compartilhada com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar a lista.');
    } finally {
      setBusyListId(null);
    }
  };

  const avatar = friend.avatarUrl;
  const isEmoji = avatar?.startsWith('emoji:');
  const isHttp = avatar?.startsWith('http') || avatar?.startsWith('data:');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {isHttp && avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>
                    {isEmoji && avatar ? avatar.replace('emoji:', '') : friend.name.charAt(0).toUpperCase()}
                  </Text>
                )}
                {friend.online && <View style={styles.onlineBadge} />}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.name} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Text style={styles.username}>@{friend.username}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {friend.online ? 'Online agora' : 'Amigo no Caneto'}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={20} color={theme.muted} />
            </Pressable>
          </View>

          {/* Segmented Tab */}
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentBtn, tab === 'lists' && styles.segmentBtnActive]}
              onPress={() => setTab('lists')}
            >
              <Text
                style={[styles.segmentText, tab === 'lists' && styles.segmentTextActive]}
              >
                Listas em comum ({sharedLists.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, tab === 'share' && styles.segmentBtnActive]}
              onPress={() => setTab('share')}
            >
              <Text
                style={[styles.segmentText, tab === 'share' && styles.segmentTextActive]}
              >
                Compartilhar nova
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {tab === 'lists' ? (
              sharedLists.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="share-social-outline" size={28} color={theme.blue} />
                  </View>
                  <Text style={styles.emptyTitle}>Nenhuma lista compartilhada</Text>
                  <Text style={styles.emptySubtitle}>
                    Toque na aba &ldquo;Compartilhar nova&rdquo; para convidar {friend.name} para uma lista.
                  </Text>
                </View>
              ) : (
                <View style={styles.listGrid}>
                  {sharedLists.map(l => (
                    <Pressable
                      key={l.id}
                      style={styles.listCard}
                      onPress={() => {
                        onClose();
                        onOpenList?.(l.id);
                      }}
                    >
                      <View style={styles.listCardLeft}>
                        <View style={styles.listIcon}>
                          <CanetoIcon name="cart" size={18} color={theme.blue} />
                        </View>
                        <View>
                          <Text style={styles.listName}>{l.name}</Text>
                          <Text style={styles.listMeta}>
                            {l.items.length} itens · {l.permission === 'owner' ? 'Você é dono' : 'Compartilhada'}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              <View style={styles.listGrid}>
                {unsharedLists.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptySubtitle}>
                      Todas as suas listas já estão compartilhadas ou não há listas disponíveis.
                    </Text>
                  </View>
                ) : (
                  unsharedLists.map(l => (
                    <View key={l.id} style={styles.shareRow}>
                      <View style={styles.listCardLeft}>
                        <View style={styles.listIcon}>
                          <CanetoIcon name="cart" size={18} color={theme.blue} />
                        </View>
                        <View>
                          <Text style={styles.listName}>{l.name}</Text>
                          <Text style={styles.listMeta}>{l.items.length} itens</Text>
                        </View>
                      </View>

                      <Pressable
                        style={[styles.shareBtn, busyListId === l.id && styles.disabled]}
                        onPress={() => handleShare(l.id)}
                        disabled={busyListId === l.id}
                      >
                        <Ionicons name="person-add-outline" size={14} color="white" />
                        <Text style={styles.shareBtnText}>Convidar</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer with Remove button */}
          <View style={styles.footer}>
            <Pressable style={styles.removeBtn} onPress={handleRemove}>
              <Ionicons name="person-remove-outline" size={16} color={theme.danger} />
              <Text style={styles.removeBtnText}>Desconectar amizade</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createThemedStyles(theme =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 18,
    },
    container: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '85%',
      backgroundColor: theme.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    avatarImage: {
      width: 52,
      height: 52,
      borderRadius: 18,
    },
    avatarEmoji: {
      fontSize: 24,
      color: theme.blue,
      fontFamily: theme.font.bold,
    },
    onlineBadge: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#10B981',
      borderWidth: 2,
      borderColor: theme.surface,
    },
    profileInfo: {
      flex: 1,
    },
    name: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 16,
    },
    username: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 13,
      marginTop: 1,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
    },
    statusText: {
      color: theme.subtle,
      fontFamily: theme.font.semibold,
      fontSize: 10,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    segment: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 12,
      padding: 3,
    },
    segmentBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: theme.surface,
      elevation: 2,
    },
    segmentText: {
      color: theme.muted,
      fontFamily: theme.font.semibold,
      fontSize: 12,
    },
    segmentTextActive: {
      color: theme.blue,
      fontFamily: theme.font.bold,
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: 16,
      gap: 10,
    },
    listGrid: {
      gap: 8,
    },
    listCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    listCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    listIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listName: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 13,
    },
    listMeta: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 11,
      marginTop: 1,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.blue,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    shareBtnText: {
      color: 'white',
      fontFamily: theme.font.bold,
      fontSize: 12,
    },
    disabled: {
      opacity: 0.6,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      gap: 8,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
    emptySubtitle: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
    footer: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: theme.dangerSoft,
      borderWidth: 1,
      borderColor: theme.danger,
    },
    removeBtnText: {
      color: theme.danger,
      fontFamily: theme.font.bold,
      fontSize: 13,
    },
  })
);
