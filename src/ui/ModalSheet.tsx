import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, theme } from './theme';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
};

export function ModalSheet({ visible, title, subtitle, onClose, children, footer, testID }: Props) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar janela" />
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet} accessibilityViewIsModal accessibilityLabel={title} testID={testID}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Fechar janela"><Ionicons name="close" size={22} color={theme.muted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
          {!!footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', paddingHorizontal: theme.dialog.horizontalMargin, paddingVertical: 12 },
  keyboardArea: { width: '100%', maxWidth: theme.dialog.maxWidth, alignSelf: 'center', maxHeight: '100%' },
  sheet: { backgroundColor: theme.surface, borderRadius: theme.radius.xxl, maxHeight: '100%', overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderColor: theme.border },
  heading: { flex: 1, paddingRight: 8 },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 20, lineHeight: 28 },
  subtitle: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14, lineHeight: 21 },
  close: { width: theme.touchTarget, height: theme.touchTarget, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, paddingBottom: 20 },
  footer: { borderTopWidth: 1, borderTopColor: theme.border, padding: 16 },
}));
