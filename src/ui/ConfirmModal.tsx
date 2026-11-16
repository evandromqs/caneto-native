import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from './ModalSheet';
import { createThemedStyles, theme } from './theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <Pressable
        style={({ pressed }) => [styles.button, danger ? styles.dangerButton : styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
        onPress={() => void handleConfirm()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
      >
        <Text style={styles.confirmText}>{busy ? 'Aguarde...' : confirmLabel}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      >
        <Text style={styles.cancelText}>{cancelLabel}</Text>
      </Pressable>
    </View>
  );

  return (
    <ModalSheet visible={visible} title={title} hideCloseButton centerTitle onClose={onCancel} footer={footer}>
      <View style={styles.body}>
        <View style={[styles.iconWrap, danger ? styles.iconDanger : styles.iconPrimary]}>
          <Ionicons name={danger ? 'trash-outline' : 'alert-circle-outline'} size={24} color={danger ? theme.danger : theme.blueLight} />
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  body: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconDanger: { backgroundColor: theme.dangerSoft },
  iconPrimary: { backgroundColor: theme.blueSoft },
  message: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  footer: { flexDirection: 'column', gap: 8, width: '100%' },
  button: { width: '100%', minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dangerButton: { backgroundColor: theme.danger },
  primaryButton: { backgroundColor: theme.blue },
  cancelButton: { backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong },
  confirmText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  cancelText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
}));
