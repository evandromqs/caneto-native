import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryFor, parseQuickItemInput, type ParsedItemInput } from '../../core/categories';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { createThemedStyles, theme } from '../../ui/theme';

interface BatchImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportItems: (items: ParsedItemInput[]) => Promise<void> | void;
}

export function BatchImportModal({
  visible,
  onClose,
  onImportItems,
}: BatchImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [busy, setBusy] = useState(false);

  const lines = useMemo(() => {
    return rawText
      .split(/\n|,/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, [rawText]);

  const parsedItems = useMemo(() => {
    return lines.map(line => parseQuickItemInput(line));
  }, [lines]);

  if (!visible) return null;

  const handleImport = async () => {
    if (parsedItems.length === 0 || busy) return;
    setBusy(true);
    try {
      await onImportItems(parsedItems);
      setRawText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setRawText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.dialog}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="clipboard-outline" size={20} color={theme.blue} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>Colar Lista Completa</Text>
                <Text style={styles.subtitle}>
                  Importe de mensagens do WhatsApp ou notas
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={20} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>
                Cole sua lista (um item por linha ou separados por vírgula):
              </Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={rawText}
                onChangeText={setRawText}
                placeholder={`Exemplo:\n2kg de alcatra\n3 caixas de leite\n1 pct arroz R$ 24,90\nBanana\nDetergente`}
                placeholderTextColor={theme.subtle}
              />

              {parsedItems.length > 0 && (
                <View style={styles.previewContainer}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>Prévia da lista</Text>
                    <View style={styles.badgeCount}>
                      <Text style={styles.badgeCountText}>
                        {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'itens'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewList}>
                    {parsedItems.map((item, index) => {
                      const category = categoryFor(item.categoryId);
                      return (
                        <View key={`${item.name}-${index}`} style={styles.previewItem}>
                          <View style={styles.previewItemLeft}>
                            <View
                              style={[
                                styles.categoryIconWrapper,
                                { backgroundColor: category.background },
                              ]}
                            >
                              <CanetoIcon
                                name={item.categoryId}
                                size={14}
                                color={category.color}
                              />
                            </View>
                            <View style={styles.previewItemDetails}>
                              <Text style={styles.previewItemName} numberOfLines={1}>
                                {item.name}
                              </Text>
                              <Text style={styles.previewItemMeta}>
                                {item.quantity} {item.unit}
                                {item.price != null &&
                                  ` · R$ ${item.price.toFixed(2).replace('.', ',')}`}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.categoryBadge,
                              { backgroundColor: category.background },
                            ]}
                          >
                            <Text
                              style={[
                                styles.categoryBadgeText,
                                { color: category.color },
                              ]}
                            >
                              {category.name}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={busy}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.importButton,
                  (parsedItems.length === 0 || busy) && styles.disabledButton,
                ]}
                onPress={handleImport}
                disabled={parsedItems.length === 0 || busy}
              >
                <Ionicons name="sparkles" size={16} color="white" />
                <Text style={styles.importButtonText}>
                  {busy
                    ? 'Adicionando...'
                    : parsedItems.length > 0
                    ? `Adicionar (${parsedItems.length}) itens`
                    : 'Adicionar à lista'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
      padding: 16,
    },
    container: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '90%',
    },
    dialog: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 16,
    },
    subtitle: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 12,
      marginTop: 1,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    body: {
      maxHeight: 400,
    },
    bodyContent: {
      padding: 18,
      gap: 14,
    },
    label: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 13,
    },
    textArea: {
      minHeight: 110,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      fontFamily: theme.font.regular,
      fontSize: 14,
      color: theme.ink,
      textAlignVertical: 'top',
    },
    previewContainer: {
      gap: 8,
      marginTop: 4,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 13,
    },
    badgeCount: {
      backgroundColor: theme.blueSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    badgeCountText: {
      color: theme.blue,
      fontFamily: theme.font.bold,
      fontSize: 11,
    },
    previewList: {
      gap: 6,
    },
    previewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    previewItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      flex: 1,
    },
    categoryIconWrapper: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewItemDetails: {
      flex: 1,
    },
    previewItemName: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 13,
    },
    previewItemMeta: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 11,
      marginTop: 1,
    },
    categoryBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    categoryBadgeText: {
      fontFamily: theme.font.bold,
      fontSize: 10,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 10,
    },
    cancelButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    cancelButtonText: {
      color: theme.muted,
      fontFamily: theme.font.semibold,
      fontSize: 14,
    },
    importButton: {
      flex: 2,
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: theme.blue,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
    importButtonText: {
      color: 'white',
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
  })
);
