import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { createThemedStyles, theme } from '../../ui/theme';

interface Step {
  icon: string;
  isCanetoIcon?: boolean;
  title: string;
  description: string;
  tip: string;
}

const STEPS: Step[] = [
  {
    icon: 'list',
    isCanetoIcon: true,
    title: 'Listas Inteligentes',
    description: 'Crie listas para diferentes mercados ou momentos. Seus itens são organizados por categoria automaticamente.',
    tip: 'Dica: Cole mensagens inteiras com a importação em lote.',
  },
  {
    icon: 'cart',
    isCanetoIcon: true,
    title: 'Área de Compras',
    description: 'Acompanhe o total estimado, marque produtos no carrinho e use o teclado rápido para preços por quilo ou unidade.',
    tip: 'Dica: Ative a tela sempre acesa para não precisar desbloquear o celular.',
  },
  {
    icon: 'store',
    isCanetoIcon: true,
    title: 'Locais & Estabelecimentos',
    description: 'Vincule lojas às suas listas, consulte preços anteriores e localize mercados próximos de você.',
    tip: 'Dica: Você pode reabrir listas finalizadas a qualquer momento.',
  },
  {
    icon: 'social',
    isCanetoIcon: true,
    title: 'Social & Compartilhamento',
    description: 'Convide amigos para editar listas com você. As alterações sincronizam entre aparelhos em tempo real.',
    tip: 'Dica: Compartilhe por código, link ou convite direto.',
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingModal({ visible, onClose }: OnboardingModalProps) {
  const [index, setIndex] = useState(0);

  if (!visible) return null;

  const current = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setIndex(0);
      onClose();
    } else {
      setIndex(i => i + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) setIndex(i => i - 1);
  };

  const handleClose = () => {
    setIndex(0);
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
        <View style={styles.dialog}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.stepDots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>
            <Pressable
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={20} color={theme.muted} />
            </Pressable>
          </View>

          {/* Hero / Icon Card */}
          <View style={styles.heroArea}>
            <View style={styles.iconCircle}>
              {current.isCanetoIcon ? (
                <CanetoIcon name={current.icon} size={36} color={theme.blue} />
              ) : (
                <Ionicons name={current.icon as any} size={36} color={theme.blue} />
              )}
            </View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.description}>{current.description}</Text>

            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={16} color={theme.warning} />
              <Text style={styles.tipText}>{current.tip}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {index > 0 ? (
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={16} color={theme.muted} />
                <Text style={styles.backButtonText}>Anterior</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.backButton} onPress={handleClose}>
                <Text style={styles.backButtonText}>Pular</Text>
              </Pressable>
            )}

            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {isLast ? 'Começar a usar' : 'Próximo'}
              </Text>
              <Ionicons
                name={isLast ? 'checkmark' : 'arrow-forward'}
                size={16}
                color="white"
              />
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
    dialog: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: theme.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      padding: 22,
      gap: 18,
      elevation: 8,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepDots: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: theme.blue,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    heroArea: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    iconCircle: {
      width: 76,
      height: 76,
      borderRadius: 24,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    title: {
      color: theme.ink,
      fontFamily: theme.font.bold,
      fontSize: 20,
      textAlign: 'center',
    },
    description: {
      color: theme.muted,
      fontFamily: theme.font.regular,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      marginTop: 4,
    },
    tipText: {
      color: theme.ink,
      fontFamily: theme.font.semibold,
      fontSize: 12,
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    backButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.surfaceMuted,
    },
    backButtonText: {
      color: theme.muted,
      fontFamily: theme.font.semibold,
      fontSize: 14,
    },
    nextButton: {
      flex: 1.6,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.blue,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    nextButtonText: {
      color: 'white',
      fontFamily: theme.font.bold,
      fontSize: 14,
    },
  })
);
