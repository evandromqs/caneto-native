import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../../ui/primitives';
import { theme } from '../../ui/theme';
import { getErrorMessage } from '../../ui/error';

type MaybePromise = void | Promise<void>;

export interface CreateListModalProps {
  visible: boolean;
  listCount: number;
  onClose: () => void;
  onCreate: (name: string) => MaybePromise;
  onJoinList?: () => MaybePromise;
  onScanList?: () => MaybePromise;
}

const numberWords = ['Zero', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze'];

export function CreateListModal(props: CreateListModalProps) {
  return props.visible ? <CreateListDialog {...props} /> : null;
}

function CreateListDialog({ listCount, onClose, onCreate, onJoinList, onScanList }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const next = listCount + 1;
  const defaultName = `Lista ${numberWords[next] || next}`;
  const run = async (operation: () => MaybePromise) => {
    if (busy) return;
    try { setBusy(true); await operation(); onClose(); }
    catch (error) { Alert.alert('Não foi possível concluir', getErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar nova lista" />
      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.panel} accessibilityViewIsModal accessibilityLabel="Nova lista">
          {(!!onScanList || !!onJoinList) && <View style={styles.shortcutRow}>
            {!!onScanList && <AppButton label="Escanear lista" variant="secondary" icon={<Ionicons name="camera-outline" size={19} color={theme.blue} />} disabled={busy} style={styles.shortcut} onPress={() => void run(onScanList)} />}
            {!!onJoinList && <AppButton label="Lista do Amigo" variant="secondary" icon={<Ionicons name="key-outline" size={19} color={theme.blue} />} disabled={busy} style={styles.shortcut} onPress={() => void run(onJoinList)} />}
          </View>}
          <TextInput value={name} onChangeText={setName} placeholder={`Ex: ${defaultName}`} placeholderTextColor={theme.placeholder} accessibilityLabel="Nome da nova lista" autoFocus maxLength={80} returnKeyType="done" onSubmitEditing={() => void run(() => onCreate(name.trim() || defaultName))} style={styles.input} />
          <View style={styles.footer}>
            <AppButton label="Fechar" variant="secondary" icon={<Ionicons name="close" size={17} color={theme.ink} />} disabled={busy} onPress={onClose} style={styles.footerButton} />
            <AppButton label="Criar Lista" icon={<Ionicons name="add" size={18} color={theme.surface} />} loading={busy} onPress={() => void run(() => onCreate(name.trim() || defaultName))} style={styles.footerButton} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.60)', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  keyboardArea: { width: '100%', maxWidth: 512, alignSelf: 'center' },
  panel: { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 24, padding: 20, gap: 16, elevation: 16 },
  shortcutRow: { flexDirection: 'row', gap: 10 }, shortcut: { flex: 1, minHeight: 52, paddingHorizontal: 7 },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, paddingHorizontal: 16, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 16 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 4 },
  footerButton: { flex: 1, minHeight: 48 },
});
