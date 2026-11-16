import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CANETO_API } from '../../core/api';
import { triggerHaptic } from '../../core/device/haptics';
import { playSound } from '../../core/device/sounds';
import { getErrorMessage } from '../../ui/error';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';

type Category = 'improvement' | 'idea' | 'bug' | 'other';
const categories: { id: Category; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'improvement', label: 'Melhoria', icon: 'sparkles-outline' },
  { id: 'idea', label: 'Nova ideia', icon: 'bulb-outline' },
  { id: 'bug', label: 'Problema', icon: 'bug-outline' },
  { id: 'other', label: 'Outro', icon: 'chatbubble-ellipses-outline' },
];

export function FeedbackModal({ visible, onClose, userId, email, name }: {
  visible: boolean; onClose: () => void; userId: string; email?: string; name?: string;
}) {
  const [category, setCategory] = useState<Category>('improvement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const close = () => {
    setError('');
    setSent(false);
    setTitle('');
    setContent('');
    onClose();
  };

  const submit = async () => {
    if (content.trim().length < 3) {
      setError('Escreva sua ideia ou sugestão.');
      void triggerHaptic('warning');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: title.trim() || categories.find(c => c.id === category)?.label || 'Sugestão',
        content: content.trim(),
        category,
        userEmail: email,
        userName: name,
        userId,
        createdAt: Date.now(),
      };
      const response = await fetch(`${CANETO_API}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Não foi possível enviar a sugestão.');
      }
      if (typeof localStorage !== 'undefined') {
        try {
          const prevRaw = localStorage.getItem('caneto.feedback.sent.v1');
          const prev = prevRaw ? (JSON.parse(prevRaw) as unknown[]) : [];
          localStorage.setItem('caneto.feedback.sent.v1', JSON.stringify([payload, ...prev.slice(0, 19)]));
        } catch {}
      }
      void triggerHaptic('success');
      void playSound('complete');
      setSent(true);
    } catch (cause) {
      setError(getErrorMessage(cause));
      void triggerHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const footer = sent ? (
    <Pressable style={styles.submit} onPress={close} accessibilityRole="button">
      <Text style={styles.submitText}>Concluir</Text>
    </Pressable>
  ) : (
    <View style={styles.footerRow}>
      <Pressable style={styles.closeLeftBtn} onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Fechar">
        <Text style={styles.closeLeftText}>Fechar</Text>
      </Pressable>
      <Pressable
        style={[styles.submit, styles.footerPrimary, (busy || content.trim().length < 3) && styles.disabled]}
        disabled={busy || content.trim().length < 3}
        onPress={() => void submit()}
      >
        {busy ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Enviar</Text>}
      </Pressable>
    </View>
  );

  return (
    <ModalSheet visible={visible} title="Ideias e Sugestões" subtitle="Ajude a evoluir o Caneto" hideCloseButton centerTitle onClose={close} footer={footer}>
      {sent ? (
        <View style={styles.sentBox}>
          <View style={styles.sentIcon}>
            <Ionicons name="checkmark-done" size={28} color={theme.success} />
          </View>
          <Text style={styles.sentTitle}>Sugestão enviada!</Text>
          <Text style={styles.sentSub}>Obrigado por colaborar com a evolução do Caneto.</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categories}>
            {categories.map(entry => {
              const active = category === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setCategory(entry.id); void triggerHaptic('selection'); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={entry.icon} size={14} color={active ? '#FFFFFF' : theme.ink} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Assunto (opcional)</Text>
            <TextInput
              style={styles.field}
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              placeholder="Ex: Filtro por corredor"
              placeholderTextColor={theme.muted}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mensagem</Text>
            <TextInput
              style={[styles.field, styles.message]}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              placeholder="Conte sua ideia, sugestão de melhoria ou problema encontrado..."
              placeholderTextColor={theme.muted}
            />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { gap: 12 },
  fieldGroup: { gap: 5 },
  label: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: theme.border, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: theme.surfaceMuted },
  chipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  chipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 },
  chipTextActive: { color: 'white', fontFamily: theme.font.bold },
  field: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, paddingHorizontal: 12, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14 },
  message: { minHeight: 116, paddingTop: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  footerPrimary: { flex: 1 },
  closeLeftBtn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  closeLeftText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  submit: { minHeight: 46, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: 'white', fontFamily: theme.font.bold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  error: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center' },
  sentBox: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  sentIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: theme.successSoft, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 18 },
  sentSub: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13, textAlign: 'center' },
}));
