import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, theme } from '../../ui/theme';

interface Highlight {
  tag: 'novo' | 'melhoria' | 'correcao' | 'design';
  text: string;
}

interface VersionItem {
  version: string;
  date: string;
  title: string;
  highlights: Highlight[];
}

const VERSIONS: VersionItem[] = [
  {
    version: 'v1.1.0',
    date: '29 de Outubro de 2026',
    title: 'Importação em lote, ações de mercado, tela ativa, vibração e novo fechamento',
    highlights: [
      { tag: 'novo', text: 'Colar Lista Completa: importe múltiplos itens de uma só vez colando texto do WhatsApp ou notas.' },
      { tag: 'novo', text: 'Ações de Mercado: desmarque todos os itens ou limpe os comprados com um único toque.' },
      { tag: 'novo', text: 'Tela Sempre Ativa: mantenha a tela do aparelho acesa enquanto faz compras no mercado.' },
      { tag: 'novo', text: 'Resposta Tátil e Sons: vibração e feedback ao marcar itens na lista.' },
      { tag: 'novo', text: 'Perfil de Amigos: veja detalhes e compartilhe listas diretamente no Social.' },
      { tag: 'melhoria', text: 'Fechamento de Compras: fluxo em 3 passos com conferência de nota fiscal e divergência de preço.' },
      { tag: 'melhoria', text: 'Estilo de Marcação: selecione entre círculo tradicional e chave deslizante.' },
      { tag: 'melhoria', text: 'Resumo com Métricas: visualize gastos por categoria e histórico detalhado das compras.' },
    ],
  },
  {
    version: 'v1.0.8',
    date: '28 de Outubro de 2026',
    title: 'Atualizações contínuas via EAS e edição aprimorada',
    highlights: [
      { tag: 'novo', text: 'Atualizações Online: recebimento de melhorias JavaScript instantaneamente via EAS Update.' },
      { tag: 'melhoria', text: 'Edição de Itens: teclado numérico BRL, foto de etiqueta e leitor de código de barras.' },
      { tag: 'melhoria', text: 'Unir Listas: combinação rápida de itens de listas abertas.' },
    ],
  },
  {
    version: 'v1.0.7',
    date: '27 de Outubro de 2026',
    title: 'Lixeira local e sincronização offline com o Supabase',
    highlights: [
      { tag: 'novo', text: 'Lixeira de Itens: retenção com desfazer e restauração segura.' },
      { tag: 'melhoria', text: 'Sincronização Local-First: fila de alterações offline que sincroniza ao reconectar.' },
    ],
  },
];

interface ChangelogModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChangelogModal({ visible, onClose }: ChangelogModalProps) {
  if (!visible) return null;

  const renderBadge = (tag: Highlight['tag']) => {
    switch (tag) {
      case 'novo':
        return (
          <View style={[styles.badge, styles.badgeNovo]}>
            <Ionicons name="sparkles" size={10} color="#059669" />
            <Text style={[styles.badgeText, { color: '#059669' }]}>Novo</Text>
          </View>
        );
      case 'melhoria':
        return (
          <View style={[styles.badge, styles.badgeMelhoria]}>
            <Ionicons name="flash" size={10} color={theme.blue} />
            <Text style={[styles.badgeText, { color: theme.blue }]}>Melhoria</Text>
          </View>
        );
      case 'correcao':
        return (
          <View style={[styles.badge, styles.badgeCorrecao]}>
            <Ionicons name="bug" size={10} color="#D97706" />
            <Text style={[styles.badgeText, { color: '#D97706' }]}>Correção</Text>
          </View>
        );
      case 'design':
        return (
          <View style={[styles.badge, styles.badgeDesign]}>
            <Ionicons name="color-palette" size={10} color="#7C3AED" />
            <Text style={[styles.badgeText, { color: '#7C3AED' }]}>Visual</Text>
          </View>
        );
    }
  };

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
            <View style={styles.headerTitleRow}>
              <View style={styles.dot} />
              <Text style={styles.headerTitle}>Novidades do Caneto</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={20} color={theme.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {VERSIONS.map((v, index) => (
              <View key={v.version} style={styles.versionCard}>
                <View style={styles.versionHeader}>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>{v.version}</Text>
                  </View>
                  <Text style={styles.versionDate}>{v.date}</Text>
                </View>

                <Text style={styles.versionTitle}>{v.title}</Text>

                <View style={styles.highlightsList}>
                  {v.highlights.map((h, i) => (
                    <View key={i} style={styles.highlightRow}>
                      <View style={styles.highlightBadgeWrapper}>
                        {renderBadge(h.tag)}
                      </View>
                      <Text style={styles.highlightText}>{h.text}</Text>
                    </View>
                  ))}
                </View>

                {index < VERSIONS.length - 1 && <View style={styles.cardDivider} />}
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Entendido</Text>
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
      maxWidth: 520,
      maxHeight: '88%',
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
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.blue,
    },
    headerTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 16,
    },
    closeButton: {
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
      padding: 20,
      gap: 18,
    },
    versionCard: {
      gap: 10,
    },
    versionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    versionBadge: {
      backgroundColor: theme.blueSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    versionBadgeText: {
      color: theme.blue,
      fontFamily: theme.font.bold,
      fontSize: 12,
    },
    versionDate: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 12,
    },
    versionTitle: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
    highlightsList: {
      gap: 9,
      marginTop: 2,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    highlightBadgeWrapper: {
      marginTop: 2,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    badgeNovo: {
      backgroundColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    badgeMelhoria: {
      backgroundColor: theme.blueSoft,
      borderColor: theme.blueSoft,
    },
    badgeCorrecao: {
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    badgeDesign: {
      backgroundColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },
    badgeText: {
      fontFamily: theme.font.bold,
      fontSize: 9,
      textTransform: 'uppercase',
    },
    highlightText: {
      flex: 1,
      color: theme.ink,
      fontFamily: theme.font.regular,
      fontSize: 13,
      lineHeight: 18,
    },
    cardDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginTop: 14,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    doneButton: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneButtonText: {
      color: 'white',
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
  })
);
