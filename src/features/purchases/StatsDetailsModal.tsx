import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Purchase } from '../../core/models/caneto';
import { categoryFor } from '../../core/categories';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { createThemedStyles, theme } from '../../ui/theme';

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface StatsDetailsModalProps {
  visible: boolean;
  purchases: Purchase[];
  onClose: () => void;
  onRecreate?: (purchase: Purchase) => Promise<void>;
}

export function StatsDetailsModal({
  visible,
  purchases,
  onClose,
  onRecreate,
}: StatsDetailsModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalSpent = purchases.reduce((sum, p) => sum + (p.totalSpent || 0), 0);
    const totalPurchases = purchases.length;
    const totalItems = purchases.reduce((sum, p) => sum + (p.totalItems || 0), 0);
    const averageSpent = totalPurchases > 0 ? totalSpent / totalPurchases : 0;

    // Métodos de pagamento
    const paymentMap: Record<string, { count: number; total: number }> = {};
    for (const p of purchases) {
      const method = p.paymentMethod || 'credito';
      if (!paymentMap[method]) {
        paymentMap[method] = { count: 0, total: 0 };
      }
      paymentMap[method].count += 1;
      paymentMap[method].total += p.totalSpent || 0;
    }

    // Categorias
    const catMap: Record<string, { count: number; spent: number }> = {};
    for (const p of purchases) {
      for (const item of p.items) {
        const cat = item.categoryId || 'outros';
        const cost = (item.price ?? 0) * item.quantity;
        if (!catMap[cat]) {
          catMap[cat] = { count: 0, spent: 0 };
        }
        catMap[cat].count += item.quantity;
        catMap[cat].spent += cost;
      }
    }

    const categoryList = Object.entries(catMap)
      .map(([id, data]) => ({
        id,
        category: categoryFor(id),
        count: data.count,
        spent: data.spent,
      }))
      .sort((a, b) => b.spent - a.spent);

    const maxCatSpent = Math.max(1, ...categoryList.map(c => c.spent));

    return {
      totalSpent,
      totalPurchases,
      totalItems,
      averageSpent,
      paymentMap,
      categoryList,
      maxCatSpent,
    };
  }, [purchases]);

  if (!visible) return null;

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
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="pie-chart-outline" size={20} color={theme.blue} />
              </View>
              <View>
                <Text style={styles.title}>Estatísticas de Compras</Text>
                <Text style={styles.subtitle}>Métricas e histórico detalhado</Text>
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

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Cards de Métricas Principais */}
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TOTAL GASTO</Text>
                <Text style={[styles.metricValue, { color: theme.success }]}>
                  {currency(stats.totalSpent)}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>MÉDIA POR COMPRA</Text>
                <Text style={[styles.metricValue, { color: theme.blue }]}>
                  {currency(stats.averageSpent)}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>COMPRAS REALIZADAS</Text>
                <Text style={styles.metricValue}>{stats.totalPurchases}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>ITENS COMPRADOS</Text>
                <Text style={styles.metricValue}>{stats.totalItems}</Text>
              </View>
            </View>

            {/* Gastos por Categoria */}
            {stats.categoryList.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Gastos por Categoria</Text>
                <View style={styles.catList}>
                  {stats.categoryList.map(cat => {
                    const percent = Math.min(
                      100,
                      Math.max(4, (cat.spent / stats.maxCatSpent) * 100)
                    );
                    return (
                      <View key={cat.id} style={styles.catRow}>
                        <View style={styles.catHeader}>
                          <View style={styles.catTitleLeft}>
                            <View
                              style={[
                                styles.catIcon,
                                { backgroundColor: cat.category.background },
                              ]}
                            >
                              <CanetoIcon
                                name={cat.id}
                                size={13}
                                color={cat.category.color}
                              />
                            </View>
                            <Text style={styles.catName}>{cat.category.name}</Text>
                          </View>
                          <Text style={styles.catSpent}>{currency(cat.spent)}</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${percent}%`,
                                backgroundColor: cat.category.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Formas de Pagamento */}
            {Object.keys(stats.paymentMap).length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Formas de Pagamento</Text>
                <View style={styles.paymentList}>
                  {Object.entries(stats.paymentMap).map(([method, data]) => {
                    const label =
                      method === 'pix'
                        ? 'Pix'
                        : method === 'debito'
                        ? 'Cartão de Débito'
                        : method === 'credito'
                        ? 'Cartão de Crédito'
                        : 'Dinheiro';
                    return (
                      <View key={method} style={styles.paymentRow}>
                        <View style={styles.paymentLeft}>
                          <Ionicons
                            name={
                              method === 'pix'
                                ? 'qr-code-outline'
                                : method === 'dinheiro'
                                ? 'cash-outline'
                                : 'card-outline'
                            }
                            size={18}
                            color={theme.blue}
                          />
                          <Text style={styles.paymentLabel}>{label}</Text>
                        </View>
                        <Text style={styles.paymentSpent}>
                          {data.count}× · {currency(data.total)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Histórico das compras */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Idas ao Mercado</Text>
              {purchases.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma compra finalizada ainda.</Text>
              ) : (
                <View style={styles.historyList}>
                  {purchases.map(p => {
                    const isExpanded = expandedId === p.id;
                    return (
                      <View key={p.id} style={styles.historyItem}>
                        <Pressable
                          style={styles.historyHeader}
                          onPress={() =>
                            setExpandedId(prev => (prev === p.id ? null : p.id))
                          }
                        >
                          <View style={styles.historyInfo}>
                            <Text style={styles.historyTitle}>{p.listName}</Text>
                            <Text style={styles.historyDate}>
                              {new Date(p.completedAt).toLocaleDateString('pt-BR')}
                              {p.storeName ? ` · ${p.storeName}` : ''}
                            </Text>
                          </View>
                          <View style={styles.historyRight}>
                            <Text style={styles.historyPrice}>
                              {currency(p.totalSpent || 0)}
                            </Text>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={theme.muted}
                            />
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <View style={styles.historyBody}>
                            <Text style={styles.historyItemsCount}>
                              {p.items.length} {p.items.length === 1 ? 'item' : 'itens'}:
                            </Text>
                            {p.items.map((item, idx) => (
                              <View key={idx} style={styles.expandedItemRow}>
                                <Text style={styles.expandedItemName} numberOfLines={1}>
                                  • {item.name}
                                </Text>
                                <Text style={styles.expandedItemQty}>
                                  {item.quantity} {item.unit}
                                </Text>
                              </View>
                            ))}

                            {onRecreate && (
                              <Pressable
                                style={styles.recreateBtn}
                                onPress={() => onRecreate(p).then(onClose)}
                              >
                                <Ionicons
                                  name="refresh-outline"
                                  size={16}
                                  color={theme.blue}
                                />
                                <Text style={styles.recreateBtnText}>
                                  Criar lista novamente
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.closeFooterBtn} onPress={onClose}>
              <Text style={styles.closeFooterBtnText}>Fechar</Text>
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
      padding: 16,
    },
    container: {
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
      backgroundColor: theme.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
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
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      padding: 18,
      gap: 16,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCard: {
      width: '48%',
      backgroundColor: theme.surfaceMuted,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      gap: 4,
    },
    metricLabel: {
      color: theme.subtle,
      fontFamily: theme.font.semibold,
      fontSize: 10,
      letterSpacing: 0.4,
    },
    metricValue: {
      fontFamily: theme.font.bold,
      fontSize: 16,
      color: theme.ink,
    },
    sectionCard: {
      backgroundColor: theme.surfaceMuted,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 12,
    },
    sectionTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
    catList: {
      gap: 10,
    },
    catRow: {
      gap: 5,
    },
    catHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    catTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    catIcon: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catName: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 12,
    },
    catSpent: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 12,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    paymentList: {
      gap: 8,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    paymentLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    paymentLabel: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 13,
    },
    paymentSpent: {
      color: theme.muted,
      fontFamily: theme.font.bold,
      fontSize: 12,
    },
    emptyText: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 12,
    },
    historyList: {
      gap: 8,
    },
    historyItem: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
    },
    historyInfo: {
      flex: 1,
    },
    historyTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
    historyDate: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 11,
      marginTop: 2,
    },
    historyRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    historyPrice: {
      color: theme.blue,
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
    historyBody: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 12,
      gap: 6,
      backgroundColor: theme.surfaceMuted,
    },
    historyItemsCount: {
      color: theme.subtle,
      fontFamily: theme.font.semibold,
      fontSize: 11,
      marginBottom: 2,
    },
    expandedItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    expandedItemName: {
      color: theme.ink,
      fontFamily: theme.font.regular,
      fontSize: 12,
      flex: 1,
    },
    expandedItemQty: {
      color: theme.muted,
      fontFamily: theme.font.semibold,
      fontSize: 11,
    },
    recreateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    recreateBtnText: {
      color: theme.blue,
      fontFamily: theme.font.semibold,
      fontSize: 13,
    },
    footer: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    closeFooterBtn: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeFooterBtnText: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 14,
    },
  })
);
