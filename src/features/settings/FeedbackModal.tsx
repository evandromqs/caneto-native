import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CANETO_API } from '../../core/api';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';

type Category = 'improvement' | 'idea' | 'bug' | 'other';
const categories: { id: Category; label: string }[] = [
  { id: 'improvement', label: 'Melhoria' }, { id: 'idea', label: 'Nova ideia' },
  { id: 'bug', label: 'Problema' }, { id: 'other', label: 'Outro' },
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
  const close = () => { setError(''); setSent(false); setTitle(''); setContent(''); onClose(); };
  const submit = async () => {
    if (content.trim().length < 2) { setError('Escreva sua ideia ou sugestão.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`${CANETO_API}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), category, userEmail: email, userName: name, userId }),
      });
      const body = await response.json() as { error?: string; savedLocally?: boolean };
      if (!response.ok || body.savedLocally) throw new Error(body.error || 'O servidor recebeu a sugestão, mas ainda não conseguiu salvá-la. Tente novamente mais tarde.');
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar agora.');
    } finally { setBusy(false); }
  };
  return <ModalSheet visible={visible} title="Ideias e Sugestões" subtitle="Ajude a melhorar o Caneto" onClose={close}>
    {sent ? <View style={styles.form}><Text style={styles.success}>Sugestão enviada. Obrigado por colaborar!</Text><Pressable style={styles.submit} onPress={close}><Text style={styles.submitText}>Concluir</Text></Pressable></View>
      : <View style={styles.form}>
        <Text style={styles.label}>Tipo de sugestão</Text>
        <View style={styles.categories}>{categories.map(entry => <Pressable key={entry.id} style={[styles.chip, category === entry.id && styles.chipActive]} onPress={() => setCategory(entry.id)} accessibilityRole="radio" accessibilityState={{ selected: category === entry.id }}><Text style={[styles.chipText, category === entry.id && styles.chipTextActive]}>{entry.label}</Text></Pressable>)}</View>
        <Text style={styles.label}>Título (opcional)</Text><TextInput style={styles.field} value={title} onChangeText={setTitle} maxLength={140} placeholder="Resuma sua ideia" placeholderTextColor={theme.muted} />
        <Text style={styles.label}>Sua mensagem</Text><TextInput style={[styles.field, styles.message]} value={content} onChangeText={setContent} multiline textAlignVertical="top" placeholder="Descreva sua ideia ou problema" placeholderTextColor={theme.muted} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.submit} disabled={busy} onPress={() => void submit()}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Enviar sugestão</Text>}</Pressable>
      </View>}
  </ModalSheet>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  form: { gap: 10 }, label: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: theme.surfaceMuted },
  chipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  chipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 }, chipTextActive: { color: 'white' },
  field: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, color: theme.ink, fontFamily: theme.font.regular },
  message: { minHeight: 130, paddingTop: 10 },
  submit: { minHeight: 48, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: 'white', fontFamily: theme.font.bold },
  error: { color: theme.danger, fontFamily: theme.font.regular }, success: { color: theme.success, fontFamily: theme.font.bold },
}));
