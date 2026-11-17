import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { CanetoIcon } from '../../ui/CanetoIcon';
import { getErrorMessage } from '../../ui/error';
import { createThemedStyles, theme } from '../../ui/theme';
import type { SettingsPreferences } from './SettingsScreen';

const TOTAL_STEPS = 7;

export type OnboardingResult = {
  displayName: string;
  username: string;
  avatarUrl: string;
  visibility: 'public' | 'private';
  isPhotoPublic: boolean;
  preferences: SettingsPreferences;
};

interface OnboardingModalProps {
  visible: boolean;
  required?: boolean;
  userId: string;
  userEmail?: string | null;
  initialProfile?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    visibility?: 'public' | 'discrete' | 'private';
    isPhotoPublic?: boolean;
  } | null;
  initialPreferences: SettingsPreferences;
  onPreviewPreferences?: (next: SettingsPreferences) => void;
  onComplete: (result: OnboardingResult) => void | Promise<void>;
  onClose: () => void;
}

export function OnboardingModal({
  visible,
  required = false,
  userId,
  initialProfile,
  initialPreferences,
  onPreviewPreferences,
  onComplete,
  onClose,
}: OnboardingModalProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [prefs, setPrefs] = useState<SettingsPreferences>(initialPreferences);
  const [resolvingUsername, setResolvingUsername] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const slugFromName = (raw: string) => {
    const base = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 16);
    if (!base) return '';
    return base.length >= 3 ? base : `${base}00`.slice(0, 3);
  };

  const resolveUniqueUsername = async (rawName: string): Promise<string> => {
    const base = slugFromName(rawName) || 'usuario';
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', `${base}%`)
        .neq('id', userId)
        .limit(50);
      const taken = new Set(
        ((data ?? []) as { username?: string | null }[])
          .map(row => (row.username ?? '').toLowerCase())
          .filter(Boolean)
      );
      const candidates = [
        base,
        ...Array.from({ length: 9 }, (_, i) => `${base}${i + 1}`),
        ...['a', 'b', 'c', 'x', 'br'].map(suffix => `${base}_${suffix}`),
        `${base}${Math.floor(10 + Math.random() * 89)}`,
      ];
      return candidates.find(candidate => !taken.has(candidate)) ?? `${base}_${Date.now().toString(36).slice(-4)}`;
    } catch {
      return base;
    }
  };

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setError('');
    const fallbackName = initialProfile?.displayName?.trim() || '';
    setDisplayName(fallbackName);
    setPrefs(initialPreferences);
    if (fallbackName.length >= 2) {
      setResolvingUsername(true);
      void resolveUniqueUsername(fallbackName).then(resolved => {
        setUsername(resolved);
        setResolvingUsername(false);
      });
    } else {
      setUsername('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleNameChange = (value: string) => {
    setDisplayName(value);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setUsername('');
      setResolvingUsername(false);
      return;
    }
    setResolvingUsername(true);
    checkTimer.current = setTimeout(() => {
      void resolveUniqueUsername(trimmed).then(resolved => {
        setUsername(resolved);
        setResolvingUsername(false);
      });
    }, 280);
  };

  const updatePref = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    onPreviewPreferences?.(next);
  };

  if (!visible) return null;

  const handleNext = async () => {
    setError('');
    if (step === 0) {
      if (displayName.trim().length < 2) {
        setError('Informe seu nome (mínimo 2 caracteres).');
        return;
      }
      if (!username) {
        setResolvingUsername(true);
        const resolved = await resolveUniqueUsername(displayName.trim());
        setUsername(resolved);
        setResolvingUsername(false);
      }
      Keyboard.dismiss();
      setStep(1);
      return;
    }
    if (step < 6) {
      setStep(s => (s + 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      return;
    }
    setSaving(true);
    try {
      const finalUsername = username || await resolveUniqueUsername(displayName.trim());
      await onComplete({
        displayName: displayName.trim(),
        username: finalUsername,
        avatarUrl: initialProfile?.avatarUrl || '',
        visibility: initialProfile?.visibility === 'private' ? 'private' : 'public',
        isPhotoPublic: initialProfile?.isPhotoPublic !== false,
        preferences: prefs,
      });
    } catch (e) {
      setError(getErrorMessage(e) || 'Não foi possível concluir o cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const themeLabel = prefs.theme === 'dark' ? 'Escuro' : prefs.theme === 'light' ? 'Claro' : 'Sistema';
  const checkLabel = prefs.checkboxStyle === 'switch' ? 'Chave' : prefs.checkboxStyle === 'square' ? 'Quadrado' : 'Círculo';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!required && !saving) onClose(); }}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView style={[styles.overlay, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 12 }]} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.dialog}>
            <View style={styles.topBar}>
              <View style={styles.stepDots}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
                ))}
              </View>
              <Text style={styles.stepCounter}>Passo {step + 1} de {TOTAL_STEPS}</Text>
              {!required && (
                <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Fechar">
                  <Ionicons name="close" size={20} color={theme.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {step === 0 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="person-outline" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Qual o seu nome?</Text>
                    <Text style={styles.subtitle}>Como você gostaria de ser chamado no Caneto</Text>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Seu nome</Text>
                    <TextInput
                      style={styles.input}
                      value={displayName}
                      onChangeText={handleNameChange}
                      placeholder="Ex: Maria Silva"
                      placeholderTextColor={theme.muted}
                      maxLength={40}
                      autoFocus
                    />
                  </View>
                  {(resolvingUsername || !!username) && (
                    <View style={styles.autoHandleRow}>
                      {resolvingUsername ? (
                        <ActivityIndicator size="small" color={theme.blueLight} />
                      ) : (
                        <Ionicons name="checkmark-circle-outline" size={16} color={theme.blueLight} />
                      )}
                      <Text style={styles.autoHandleText}>
                        {resolvingUsername ? 'Gerando identificador...' : `Identificador: @${username}`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {step === 1 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <CanetoIcon name="list" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Listas Inteligentes</Text>
                    <Text style={styles.subtitle}>Organize suas compras sem esforço, do planejamento ao caixa.</Text>
                  </View>
                  <View style={styles.featureList}>
                    <FeatureRow icon="layers-outline" title="Categorização automática" description="Os produtos são agrupados por corredor e setor." />
                    <FeatureRow icon="mic-outline" title="Adição rápida por voz" description="Dite itens no microfone ou digite com sugestões." />
                    <FeatureRow icon="clipboard-outline" title="Importação em lote" description="Cole mensagens inteiras e transforme em lista em segundos." />
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="color-palette-outline" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Aparência & Leitura</Text>
                    <Text style={styles.subtitle}>Escolha o visual e o tamanho de texto mais confortável</Text>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Tema</Text>
                    <View style={styles.choiceRow}>
                      {([
                        { id: 'light', label: 'Claro', icon: 'sunny-outline' },
                        { id: 'dark', label: 'Escuro', icon: 'moon-outline' },
                        { id: 'system', label: 'Sistema', icon: 'laptop-outline' },
                      ] as const).map(opt => {
                        const active = prefs.theme === opt.id;
                        return (
                          <Pressable key={opt.id} onPress={() => updatePref('theme', opt.id)} style={[styles.choice, active && styles.choiceActive]}>
                            <Ionicons name={opt.icon} size={14} color={active ? '#FFFFFF' : theme.muted} />
                            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Tamanho do texto</Text>
                    <View style={styles.choiceRow}>
                      {([
                        { id: 'small', label: 'Pequeno' },
                        { id: 'normal', label: 'Padrão' },
                        { id: 'large', label: 'Grande' },
                      ] as const).map(opt => {
                        const active = prefs.fontSize === opt.id;
                        return (
                          <Pressable key={opt.id} onPress={() => updatePref('fontSize', opt.id)} style={[styles.choice, active && styles.choiceActive]}>
                            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {step === 3 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <CanetoIcon name="cart" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Compras & Câmera</Text>
                    <Text style={styles.subtitle}>Acompanhe o carrinho, leia códigos de barras e defina como marcar itens.</Text>
                  </View>
                  <View style={styles.featureList}>
                    <FeatureRow icon="barcode-outline" title="Leitor de código e câmera" description="Escaneie produtos e notas fiscais direto na lista." />
                    <FeatureRow icon="calculator-outline" title="Cálculo em tempo real" description="Veja o subtotal por categoria e o total estimado da compra." />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Estilo de marcação</Text>
                    <View style={styles.choiceRow}>
                      {([
                        { id: 'circle', label: 'Círculo', icon: 'ellipse-outline' },
                        { id: 'switch', label: 'Chave', icon: 'toggle-outline' },
                        { id: 'square', label: 'Quadrado', icon: 'checkbox-outline' },
                      ] as const).map(opt => {
                        const active = prefs.checkboxStyle === opt.id;
                        return (
                          <Pressable key={opt.id} onPress={() => updatePref('checkboxStyle', opt.id)} style={[styles.choice, active && styles.choiceActive]}>
                            <Ionicons name={opt.icon} size={15} color={active ? '#FFFFFF' : theme.muted} />
                            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {step === 4 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="options-outline" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Conforto no Mercado</Text>
                    <Text style={styles.subtitle}>Ajuste os comportamentos enquanto faz compras no corredor</Text>
                  </View>
                  <View style={styles.toggleBox}>
                    {[
                      { key: 'keepScreenAwake' as const, label: 'Tela sempre ativa', desc: 'Evita bloqueio enquanto você olha a lista', value: prefs.keepScreenAwake },
                      { key: 'vibration' as const, label: 'Vibração ao tocar', desc: 'Retorno tátil ao marcar produtos', value: prefs.vibration },
                      { key: 'soundEffects' as const, label: 'Sons do app', desc: 'Efeitos sutis em ações concluídas', value: prefs.soundEffects },
                    ].map((row, idx, arr) => (
                      <View key={row.key} style={[styles.toggleRow, idx === arr.length - 1 && styles.toggleRowLast]}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.toggleLabel}>{row.label}</Text>
                          <Text style={styles.toggleDesc}>{row.desc}</Text>
                        </View>
                        <Switch
                          value={row.value}
                          onValueChange={val => updatePref(row.key, val)}
                          trackColor={{ false: theme.borderStrong, true: theme.blue }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {step === 5 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={styles.heroIcon}>
                      <CanetoIcon name="store" size={28} color={theme.blueLight} />
                    </View>
                    <Text style={styles.title}>Locais, Preços & Social</Text>
                    <Text style={styles.subtitle}>Economize comparando mercados e compartilhe listas em tempo real.</Text>
                  </View>
                  <View style={styles.featureList}>
                    <FeatureRow icon="map-outline" title="Mapa e catálogo de lojas" description="Veja lojas próximas, histórico de preços e importe itens direto para sua lista." />
                    <FeatureRow icon="people-outline" title="Listas compartilhadas" description="Convide familiares e amigos usando seu @identificador ou link." />
                  </View>
                </View>
              )}

              {step === 6 && (
                <View style={styles.stepBlock}>
                  <View style={styles.headerCenter}>
                    <View style={[styles.heroIcon, styles.heroIconSuccess]}>
                      <Ionicons name="checkmark-done" size={30} color={theme.success} />
                    </View>
                    <Text style={styles.title}>Tudo pronto, {displayName.trim().split(' ')[0]}!</Text>
                    <Text style={styles.subtitle}>Sua conta está configurada. Você pode alterar esses ajustes a qualquer momento.</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Nome</Text>
                      <Text style={styles.summaryValue}>{displayName.trim()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Identificador</Text>
                      <Text style={styles.summaryValue}>@{username}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryKey}>Tema</Text>
                      <Text style={styles.summaryValue}>{themeLabel}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryRowLast]}>
                      <Text style={styles.summaryKey}>Marcação</Text>
                      <Text style={styles.summaryValue}>{checkLabel}</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {!!error && <Text style={styles.errorBanner}>{error}</Text>}

            <View style={styles.footer}>
              {step > 0 && (
                <Pressable onPress={() => { setError(''); setStep(s => (s - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6); }} disabled={saving} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color={theme.ink} />
                  <Text style={styles.backText}>Voltar</Text>
                </Pressable>
              )}
              <Pressable onPress={() => void handleNext()} disabled={saving} style={[styles.nextBtn, saving && { opacity: 0.65 }]}>
                <Text style={styles.nextText}>{saving ? 'Salvando...' : step === 6 ? 'Começar a usar' : 'Continuar'}</Text>
                {!saving && <Ionicons name={step === 6 ? 'checkmark' : 'arrow-forward'} size={18} color="#FFFFFF" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FeatureRow({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={theme.blueLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.dialog.backdrop, justifyContent: 'center', paddingHorizontal: theme.dialog.horizontalMargin, paddingVertical: 16 },
  keyboard: { width: '100%', maxWidth: theme.dialog.maxWidth, alignSelf: 'center', maxHeight: '92%' },
  dialog: { width: '100%', maxHeight: '100%', backgroundColor: theme.surface, borderRadius: theme.radius.xxl, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  stepDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.borderStrong },
  dotActive: { width: 18, backgroundColor: theme.blue },
  stepCounter: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  scrollBody: { padding: 18 },
  stepBlock: { gap: 14 },
  headerCenter: { alignItems: 'center', gap: 5 },
  heroIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: theme.blueSoft, borderWidth: 1, borderColor: theme.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroIconSuccess: { backgroundColor: theme.successSoft, borderColor: theme.success },
  title: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 20, textAlign: 'center' },
  subtitle: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  fieldGroup: { gap: 6 },
  label: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  input: { minHeight: 46, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, paddingHorizontal: 12, fontFamily: theme.font.semibold, fontSize: 15 },
  autoHandleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.blueSoft, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  autoHandleText: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8 },
  choiceActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  choiceText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  choiceTextActive: { color: '#FFFFFF', fontFamily: theme.font.bold },
  toggleBox: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 14, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLabel: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  toggleDesc: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11, marginTop: 1 },
  featureList: { gap: 10 },
  featureCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  featureDesc: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12, lineHeight: 17 },
  summaryCard: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 14, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryKey: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  summaryValue: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  errorBanner: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surface },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong },
  backText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, borderRadius: 12, backgroundColor: theme.blue },
  nextText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
}));
