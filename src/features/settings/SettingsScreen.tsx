import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { triggerHaptic } from '../../core/device/haptics';
import { playSound } from '../../core/device/sounds';

export type SettingsPreferences = {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'normal' | 'large';
  checkboxStyle: 'circle' | 'switch' | 'square';
  highContrast: boolean;
  keepScreenAwake: boolean;
  vibration: boolean;
  soundEffects: boolean;
  notifications?: boolean;
};
export type PlanInfo = { tier: 'free' | 'pro'; scansUsed: number; scansLimit: number };
export type PurchaseSummary = { totalSpent: number; totalPurchases: number; totalItems: number };
export type SettingsProfile = { displayName?: string | null; username?: string | null; avatarUrl?: string | null; email?: string | null };
export type OnlineUpdateInfo = { number: string; message: string; shortId: string | null; channel: string; runtimeVersion: string; isEmbedded: boolean };
export type SettingsScreenProps = {
  profile: SettingsProfile;
  plan?: PlanInfo;
  purchases?: PurchaseSummary;
  preferences?: SettingsPreferences;
  version?: string;
  buildDate?: string;
  onOpenPlan?: () => void;
  onSelectPlanCycle?: (cycle: 'monthly' | 'yearly') => void | Promise<void>;
  onOpenProfile?: () => void;
  onOpenHistory?: () => void;
  onChangePreferences?: (next: SettingsPreferences) => void;
  onOpenChangelog?: () => void;
  onOpenOnboarding?: () => void;
  onlineUpdate?: OnlineUpdateInfo;
  checkingOnlineUpdate?: boolean;
  onCheckOnlineUpdate?: () => void;
  onCheckUpdate?: () => void;
  onOpenFeedback?: () => void;
  onSignOut?: () => void;
};

const scaled = (size: number) => Math.round(size * theme.fontScale);

function Card({ children, plan = false }: { children: React.ReactNode; plan?: boolean }) {
  return <View style={[styles.card, plan && styles.planCard]}>{children}</View>;
}

function SectionHeader({ icon, color, children }: { icon: keyof typeof Ionicons.glyphMap; color?: string; children: string }) {
  return (
    <View style={styles.headingLeft}>
      <Ionicons name={icon} size={18} color={color ?? theme.blueLight} />
      <Text style={[styles.sectionTitle, { fontSize: scaled(15) }]}>{children}</Text>
    </View>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[]; onChange?: (value: T) => void }) {
  return (
    <View style={styles.choiceRow}>
      {options.map(option => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.choice, selected && styles.choiceSelected, !onChange && styles.disabled]}
            onPress={onChange ? () => onChange(option.value) : undefined}
            disabled={!onChange}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !onChange }}
          >
            {option.icon && <Ionicons name={option.icon} size={15} color={selected ? '#FFFFFF' : theme.muted} />}
            <Text style={[styles.choiceText, { fontSize: scaled(12) }, selected && styles.choiceTextSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({ icon, title, description, value, onChange, disabled, last = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && styles.toggleRowLast, disabled && styles.disabled]}>
      <View style={[styles.toggleIcon, value && styles.toggleIconActive]}>
        <Ionicons name={icon} size={18} color={value ? theme.blueLight : theme.muted} />
      </View>
      <View style={styles.toggleInfo}>
        <Text style={[styles.toggleTitle, { fontSize: scaled(13) }]}>{title}</Text>
        <Text style={[styles.toggleDescription, { fontSize: scaled(11) }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled || !onChange}
        trackColor={{ false: theme.borderStrong, true: theme.blue }}
        thumbColor="#FFFFFF"
        accessibilityLabel={title}
      />
    </View>
  );
}

function Avatar({ profile }: { profile: SettingsProfile }) {
  const name = profile.displayName || profile.email?.split('@')[0] || 'Usuário Caneto';
  const uri = profile.avatarUrl;
  return (
    <View style={styles.avatar}>
      {uri?.startsWith('http') || uri?.startsWith('data:')
        ? <Image source={{ uri }} style={styles.avatarImage} />
        : <Text style={styles.avatarLetter}>{uri?.replace(/^emoji:/, '') || name.charAt(0).toUpperCase()}</Text>}
    </View>
  );
}

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function SettingsScreen(props: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState<'monthly' | 'yearly' | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const preference = props.preferences;
  const update = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    if (!preference) return;
    const next = { ...preference, [key]: value };
    void triggerHaptic(key === 'vibration' && value ? 'medium' : 'selection', next.vibration);
    void playSound(key === 'soundEffects' && value ? 'check' : 'tap', next.soundEffects);
    props.onChangePreferences?.(next);
  };
  const total = props.purchases;
  const average = total && total.totalPurchases > 0 ? total.totalSpent / total.totalPurchases : 0;
  const name = props.profile.displayName || props.profile.email?.split('@')[0] || 'Usuário Caneto';
  const plan = props.plan;
  const percent = plan && plan.scansLimit > 0 ? Math.min(100, Math.max(0, plan.scansUsed / plan.scansLimit * 100)) : 0;
  const canOpenPlan = plan && plan.tier !== 'pro' && !!(props.onSelectPlanCycle || props.onOpenPlan);

  const handlePlanPress = () => {
    if (props.onSelectPlanCycle) {
      setPlanModalOpen(true);
    } else {
      props.onOpenPlan?.();
    }
  };

  const chooseCycle = async (cycle: 'monthly' | 'yearly') => {
    if (!props.onSelectPlanCycle) return;
    setPlanBusy(cycle);
    try {
      await props.onSelectPlanCycle(cycle);
      setPlanModalOpen(false);
    } finally {
      setPlanBusy(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 96 }]}
    >
      {plan && (
        <Pressable onPress={canOpenPlan ? handlePlanPress : undefined} disabled={!canOpenPlan} accessibilityRole={canOpenPlan ? 'button' : undefined}>
          <Card plan>
            <View style={styles.topRow}>
              <Image source={require('./assets/caneto_pro_icon.webp')} style={styles.planImage} resizeMode="contain" />
              <View style={styles.flex}>
                <Text style={[styles.profileName, { fontSize: scaled(16) }]}>{plan.tier === 'pro' ? 'Caneto Pro' : 'Plano gratuito'}</Text>
                {plan.tier === 'pro' && (
                  <View style={styles.planActiveBadge}>
                    <Text style={styles.planActiveText}>Ativo</Text>
                  </View>
                )}
              </View>
              {plan.tier !== 'pro' && canOpenPlan && (
                <View style={styles.proButton}>
                  <Text style={styles.proButtonText}>Seja Pro</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.divider} />
            <Text style={[styles.smallLabel, { fontSize: scaled(11) }]}>Capturas inteligentes no mês:</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.danger : percent >= 80 ? theme.warning : theme.blue }]} />
            </View>
            <Text style={[styles.countText, { fontSize: scaled(12) }]}>
              {plan.scansUsed} de {plan.scansLimit} ({Math.max(0, plan.scansLimit - plan.scansUsed)} restantes)
            </Text>
          </Card>
        </Pressable>
      )}

      <Pressable onPress={props.onOpenProfile} disabled={!props.onOpenProfile} accessibilityRole={props.onOpenProfile ? 'button' : undefined}>
        <Card>
          <View style={styles.topRow}>
            <Avatar profile={props.profile} />
            <View style={styles.flex}>
              <Text style={[styles.profileName, { fontSize: scaled(16) }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.profileSubtitle, { fontSize: scaled(13) }]} numberOfLines={1}>
                {props.profile.username ? `@${props.profile.username}` : props.profile.email || 'Sem identificador'}
              </Text>
            </View>
            {props.onOpenProfile && (
              <View style={styles.secondaryBadge}>
                <Text style={styles.secondaryBadgeText}>Editar</Text>
                <Ionicons name="options-outline" size={14} color={theme.ink} />
              </View>
            )}
          </View>
        </Card>
      </Pressable>

      {total && (
        <Pressable onPress={props.onOpenHistory} disabled={!props.onOpenHistory} accessibilityRole={props.onOpenHistory ? 'button' : undefined}>
          <Card>
            <View style={styles.cardHeading}>
              <SectionHeader icon="trending-up-outline">Resumo de compras</SectionHeader>
              {props.onOpenHistory && (
                <View style={styles.secondaryBadge}>
                  <Text style={styles.secondaryBadgeText}>Detalhes</Text>
                  <Ionicons name="arrow-forward" size={13} color={theme.ink} />
                </View>
              )}
            </View>
            <View style={styles.statGrid}>
              {([
                ['TOTAL GASTO', brl(total.totalSpent), theme.success, 'wallet-outline'],
                ['MÉDIA POR COMPRA', brl(average), theme.blueLight, 'analytics-outline'],
                ['COMPRAS', String(total.totalPurchases), theme.ink, 'bag-check-outline'],
                ['ITENS COMPRADOS', String(total.totalItems), theme.ink, 'cube-outline'],
              ] as const).map(([label, value, color, icon]) => (
                <View key={label} style={styles.statCell}>
                  <View style={styles.statHeaderRow}>
                    <Ionicons name={icon} size={13} color={color} />
                    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                  </View>
                  <Text style={[styles.statValue, { color, fontSize: scaled(16) }]} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>
          </Card>
        </Pressable>
      )}

      {preference && (
        <>
          <Card>
            <SectionHeader icon="color-palette-outline">Aparência</SectionHeader>
            <Text style={styles.smallLabel}>TEMA</Text>
            <Choice
              value={preference.theme}
              options={[
                { value: 'light', label: 'Claro', icon: 'sunny-outline' },
                { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
                { value: 'system', label: 'Sistema', icon: 'laptop-outline' },
              ]}
              onChange={props.onChangePreferences ? value => update('theme', value) : undefined}
            />
            <View style={styles.divider} />
            <View style={styles.labelRow}>
              <Ionicons name="text-outline" size={14} color={theme.blueLight} />
              <Text style={styles.smallLabel}>TAMANHO DO TEXTO</Text>
            </View>
            <Choice
              value={preference.fontSize}
              options={[
                { value: 'small', label: 'Pequeno' },
                { value: 'normal', label: 'Padrão' },
                { value: 'large', label: 'Grande' },
              ]}
              onChange={props.onChangePreferences ? value => update('fontSize', value) : undefined}
            />
            <View style={styles.divider} />
            <Text style={styles.smallLabel}>ESTILO DE MARCAÇÃO</Text>
            <Choice
              value={preference.checkboxStyle}
              options={[
                { value: 'circle', label: 'Círculo', icon: 'ellipse-outline' },
                { value: 'switch', label: 'Chave', icon: 'toggle-outline' },
                { value: 'square', label: 'Quadrado', icon: 'checkbox-outline' },
              ]}
              onChange={props.onChangePreferences ? value => update('checkboxStyle', value) : undefined}
            />
            <View style={styles.divider} />
            <View style={styles.toggleGroup}>
              <ToggleRow
                icon="contrast-outline"
                title="Alto contraste"
                description="Bordas reforçadas para uso sob luz forte"
                value={preference.highContrast}
                onChange={props.onChangePreferences ? value => update('highContrast', value) : undefined}
                last
              />
            </View>
          </Card>

          <Card>
            <SectionHeader icon="options-outline" color={theme.blueLight}>Preferências de uso</SectionHeader>
            <View style={styles.toggleGroup}>
              <ToggleRow
                icon="flash-outline"
                title="Tela sempre ativa"
                description="Evita que o celular bloqueie durante as compras"
                value={preference.keepScreenAwake}
                onChange={props.onChangePreferences ? value => update('keepScreenAwake', value) : undefined}
              />
              <ToggleRow
                icon="phone-portrait-outline"
                title="Vibração ao tocar"
                description="Resposta tátil ao marcar itens e botões"
                value={preference.vibration}
                onChange={props.onChangePreferences ? value => update('vibration', value) : undefined}
              />
              <ToggleRow
                icon="volume-high-outline"
                title="Sons do app"
                description="Efeitos sonoros sutis em ações concluídas"
                value={preference.soundEffects}
                onChange={props.onChangePreferences ? value => update('soundEffects', value) : undefined}
                last={preference.notifications === undefined}
              />
              {preference.notifications !== undefined && (
                <ToggleRow
                  icon="notifications-outline"
                  title="Notificações"
                  description="Avisos de alterações e listas compartilhadas"
                  value={preference.notifications}
                  onChange={props.onChangePreferences ? value => update('notifications', value) : undefined}
                  last
                />
              )}
            </View>
          </Card>
        </>
      )}

      {props.onOpenFeedback && (
        <Card>
          <SectionHeader icon="bulb-outline" color={theme.warning}>Ideias e Sugestões</SectionHeader>
          <Text style={[styles.toggleDescription, { fontSize: scaled(12) }]}>
            Sugira novas funções e melhorias para a equipe de desenvolvimento.
          </Text>
          <Pressable style={styles.feedbackButton} onPress={props.onOpenFeedback} accessibilityRole="button">
            <Ionicons name="bulb-outline" size={16} color={theme.warning} />
            <Text style={styles.feedbackButtonText}>Escrever ideia ou sugestão</Text>
          </Pressable>
        </Card>
      )}

      <Card>
        <SectionHeader icon="cloud-download-outline">Atualizações e Sobre</SectionHeader>
        <View style={styles.aboutRow}>
          <View style={styles.flex}>
            <Text style={[styles.toggleTitle, { fontSize: scaled(13) }]}>
              Caneto™ v{props.version || '1.2.5'}.{props.onlineUpdate?.number && props.onlineUpdate.number !== 'Base' ? props.onlineUpdate.number : '0'}
            </Text>
            <Text style={[styles.toggleDescription, { fontSize: scaled(11) }]}>
              {props.buildDate ? `Atualizado em ${props.buildDate}` : 'Atualizações automáticas ativadas'}
            </Text>
          </View>
          {props.onCheckUpdate && (
            <Pressable style={styles.secondaryBadge} onPress={props.onCheckUpdate} accessibilityRole="button">
              <Ionicons name="cloud-download-outline" size={14} color={theme.ink} />
              <Text style={styles.secondaryBadgeText}>Ver APK</Text>
            </Pressable>
          )}
        </View>
        {props.onOpenOnboarding && (
          <View style={styles.aboutRow}>
            <View style={styles.flex}>
              <Text style={[styles.toggleTitle, { fontSize: scaled(13) }]}>Guia de boas-vindas</Text>
              <Text style={[styles.toggleDescription, { fontSize: scaled(11) }]}>Aprenda a aproveitar todos os recursos</Text>
            </View>
            <Pressable style={styles.secondaryBadge} onPress={props.onOpenOnboarding} accessibilityRole="button">
              <Text style={styles.secondaryBadgeText}>Abrir guia</Text>
            </Pressable>
          </View>
        )}
      </Card>

      {props.onSignOut && (
        <Pressable style={styles.signOut} onPress={() => setSignOutConfirmOpen(true)} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>
      )}

      <View style={styles.footerCard}>
        <Image source={require('./assets/evandromqs.webp')} style={styles.footerImage} />
        <Text style={styles.footer}>Criado por Evandro Mqs</Text>
      </View>

      <ModalSheet
        visible={planModalOpen}
        title="Assinar Caneto Pro"
        hideCloseButton
        centerTitle
        onClose={() => { if (!planBusy) setPlanModalOpen(false); }}
        footer={
          <View style={styles.planModalFooter}>
            <Pressable
              style={[styles.planOptionPrimary, !!planBusy && styles.disabled]}
              disabled={!!planBusy}
              onPress={() => void chooseCycle('yearly')}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles-outline" size={17} color="#FFFFFF" />
              <Text style={styles.planOptionPrimaryText}>{planBusy === 'yearly' ? 'Abrindo...' : 'Plano Anual (Econômico)'}</Text>
            </Pressable>
            <Pressable
              style={[styles.planOptionSecondary, !!planBusy && styles.disabled]}
              disabled={!!planBusy}
              onPress={() => void chooseCycle('monthly')}
              accessibilityRole="button"
            >
              <Text style={styles.planOptionSecondaryText}>{planBusy === 'monthly' ? 'Abrindo...' : 'Plano Mensal'}</Text>
            </Pressable>
            <Pressable
              style={styles.planCancelBtn}
              disabled={!!planBusy}
              onPress={() => setPlanModalOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.planCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.planModalBody}>
          <Image source={require('./assets/caneto_pro_icon.webp')} style={styles.planModalIcon} resizeMode="contain" />
          <Text style={styles.planModalLead}>Desbloqueie até 150 capturas inteligentes com IA por mês.</Text>
          <View style={styles.planBenefits}>
            {[
              'Leitura rápida de notas fiscais (NFC-e)',
              'Reconhecimento de produtos por câmera',
              'Catálogo colaborativo e histórico completo',
            ].map(benefit => (
              <View key={benefit} style={styles.planBenefitRow}>
                <Ionicons name="checkmark-circle" size={17} color={theme.success} />
                <Text style={styles.planBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>
      </ModalSheet>

      <ConfirmModal
        visible={signOutConfirmOpen}
        title="Sair da conta?"
        message="Você precisará entrar novamente para sincronizar suas listas."
        confirmLabel="Sair da conta"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          setSignOutConfirmOpen(false);
          props.onSignOut?.();
        }}
      />
    </ScrollView>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { gap: 14, paddingHorizontal: 16, paddingTop: 8 },
  card: { borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 11 },
  planCard: { backgroundColor: theme.blueSoft, borderColor: theme.blueLight },
  flex: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7 },
  headingLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  planImage: { width: 46, height: 46 },
  profileName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 },
  profileSubtitle: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 13 },
  planActiveBadge: { alignSelf: 'flex-start', marginTop: 2, backgroundColor: theme.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  planActiveText: { color: theme.success, fontFamily: theme.font.bold, fontSize: 11 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 54, height: 54 },
  avatarLetter: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 23 },
  proButton: { backgroundColor: theme.blue, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  proButtonText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 12 },
  secondaryBadge: { backgroundColor: theme.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: theme.borderStrong, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', gap: 5, alignItems: 'center' },
  secondaryBadgeText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallLabel: { color: theme.subtle, fontFamily: theme.font.bold, fontSize: 11, letterSpacing: 0.5 },
  progressTrack: { height: 8, borderRadius: 5, backgroundColor: theme.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 5 },
  countText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 },
  link: { color: theme.blueLight, fontFamily: theme.font.semibold, fontSize: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { flexBasis: '47%', flexGrow: 1, backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 11, gap: 5 },
  statHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { flex: 1, color: theme.subtle, fontFamily: theme.font.semibold, fontSize: 10, letterSpacing: 0.4 },
  statValue: { fontFamily: theme.font.bold, fontSize: 16 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 8 },
  choiceSelected: { borderColor: theme.blue, backgroundColor: theme.blue },
  choiceText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  choiceTextSelected: { color: '#FFFFFF', fontFamily: theme.font.bold },
  disabled: { opacity: 0.65 },
  toggleGroup: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 12, overflow: 'hidden' },
  toggleRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border, padding: 11 },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  toggleIconActive: { backgroundColor: theme.blueSoft },
  toggleInfo: { flex: 1 },
  toggleTitle: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  toggleDescription: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 11 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 12, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
  signOut: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 13 },
  footerCard: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 8 },
  footerImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: theme.borderStrong },
  footer: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 },
  updateMeta: { color: theme.subtle, fontFamily: theme.font.semibold, fontSize: 10, marginTop: 3 },
  feedbackButton: { minHeight: 44, borderRadius: 12, backgroundColor: theme.warningSoft, borderWidth: 1, borderColor: theme.warning, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  feedbackButtonText: { color: theme.warning, fontFamily: theme.font.bold, fontSize: 13 },
  planModalBody: { alignItems: 'center', gap: 12, paddingVertical: 6 },
  planModalIcon: { width: 64, height: 64 },
  planModalLead: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  planBenefits: { width: '100%', gap: 8, backgroundColor: theme.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12 },
  planBenefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planBenefitText: { flex: 1, color: theme.ink, fontFamily: theme.font.regular, fontSize: 13 },
  planModalFooter: { width: '100%', gap: 8 },
  planOptionPrimary: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  planOptionPrimaryText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  planOptionSecondary: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center' },
  planOptionSecondaryText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  planCancelBtn: { width: '100%', minHeight: 42, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  planCancelText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
}));
