import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from '../../ui/theme';

export type SettingsPreferences = {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'normal' | 'large';
  checkboxStyle: 'circle' | 'switch';
  highContrast: boolean;
  keepScreenAwake: boolean;
  vibration: boolean;
  soundEffects: boolean;
  notifications?: boolean;
};
export type PlanInfo = { tier: 'free' | 'pro'; scansUsed: number; scansLimit: number };
export type PurchaseSummary = { totalSpent: number; totalPurchases: number; totalItems: number };
export type SettingsProfile = { displayName?: string | null; username?: string | null; avatarUrl?: string | null; email?: string | null };
export type SettingsScreenProps = {
  profile: SettingsProfile;
  plan?: PlanInfo;
  purchases?: PurchaseSummary;
  preferences?: SettingsPreferences;
  version?: string;
  buildDate?: string;
  onOpenPlan?: () => void;
  onOpenProfile?: () => void;
  onOpenHistory?: () => void;
  onChangePreferences?: (next: SettingsPreferences) => void;
  onOpenChangelog?: () => void;
  onOpenOnboarding?: () => void;
  onCheckUpdate?: () => void;
  onSignOut?: () => void;
};

function Card({ children, plan = false }: { children: React.ReactNode; plan?: boolean }) { return <View style={[styles.card, plan && styles.planCard]}>{children}</View>; }
function SectionTitle({ children }: { children: string }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[]; onChange?: (value: T) => void }) {
  return <View style={styles.choiceRow}>{options.map(option => <Pressable key={option.value}
    style={[styles.choice, value === option.value && styles.choiceSelected, !onChange && styles.disabled]}
    onPress={onChange ? () => onChange(option.value) : undefined} disabled={!onChange}
    accessibilityRole="radio" accessibilityState={{ selected: value === option.value, disabled: !onChange }}>
    {option.icon && <Ionicons name={option.icon} size={16} color={value === option.value ? theme.blue : theme.muted} />}
    <Text style={[styles.choiceText, value === option.value && styles.choiceTextSelected]}>{option.label}</Text>
  </Pressable>)}</View>;
}
function ToggleRow({ icon, title, description, value, onChange, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; description: string;
  value: boolean; onChange?: (value: boolean) => void; disabled?: boolean;
}) {
  return <View style={[styles.toggleRow, disabled && styles.disabled]}>
    <View style={[styles.toggleIcon, value && styles.toggleIconActive]}><Ionicons name={icon} size={18} color={value ? theme.blue : theme.muted} /></View>
    <View style={styles.toggleInfo}><Text style={styles.toggleTitle}>{title}</Text><Text style={styles.toggleDescription}>{description}</Text></View>
    <Switch value={value} onValueChange={onChange} disabled={disabled || !onChange} trackColor={{ false: '#CBD5E1', true: theme.blue }} thumbColor="#FFFFFF" accessibilityLabel={title} />
  </View>;
}
function Avatar({ profile }: { profile: SettingsProfile }) {
  const name = profile.displayName || profile.email?.split('@')[0] || 'Usuário Caneto';
  const uri = profile.avatarUrl;
  return <View style={styles.avatar}>{uri?.startsWith('http') || uri?.startsWith('data:') ?
    <Image source={{ uri }} style={styles.avatarImage} /> :
    <Text style={styles.avatarLetter}>{uri?.replace(/^emoji:/, '') || name.charAt(0).toUpperCase()}</Text>}</View>;
}
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function SettingsScreen(props: SettingsScreenProps) {
  const preference = props.preferences;
  const update = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    if (preference) props.onChangePreferences?.({ ...preference, [key]: value });
  };
  const total = props.purchases;
  const average = total && total.totalPurchases > 0 ? total.totalSpent / total.totalPurchases : 0;
  const name = props.profile.displayName || props.profile.email?.split('@')[0] || 'Usuário Caneto';
  const plan = props.plan;
  const percent = plan && plan.scansLimit > 0 ? Math.min(100, Math.max(0, plan.scansUsed / plan.scansLimit * 100)) : 0;

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    {plan && <Pressable onPress={props.onOpenPlan} disabled={!props.onOpenPlan} accessibilityRole={props.onOpenPlan ? 'button' : undefined}>
      <Card plan><View style={styles.topRow}>
        <Image source={require('./assets/caneto_pro_icon.webp')} style={styles.planImage} resizeMode="contain" />
        <View style={styles.flex}><Text style={styles.profileName}>{plan.tier === 'pro' ? 'Caneto Pro' : 'Plano gratuito'}</Text>{plan.tier === 'pro' && <Text style={styles.planActive}>Ativo</Text>}</View>
        {plan.tier !== 'pro' && props.onOpenPlan && <View style={styles.proButton}><Text style={styles.proButtonText}>Seja Pro</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></View>}
      </View><View style={styles.divider} /><Text style={styles.smallLabel}>Capturas inteligentes no mês:</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.danger : percent >= 80 ? theme.warning : theme.blue }]} /></View>
        <Text style={styles.countText}>{plan.scansUsed} de {plan.scansLimit} ({Math.max(0, plan.scansLimit - plan.scansUsed)} restantes)</Text>
      </Card>
    </Pressable>}

    <Pressable onPress={props.onOpenProfile} disabled={!props.onOpenProfile} accessibilityRole={props.onOpenProfile ? 'button' : undefined}>
      <Card><View style={styles.topRow}><Avatar profile={props.profile} /><View style={styles.flex}>
        <Text style={styles.profileName} numberOfLines={1}>{name}</Text><Text style={styles.profileSubtitle} numberOfLines={1}>{props.profile.username ? `@${props.profile.username}` : props.profile.email || 'Sem identificador'}</Text>
      </View>{props.onOpenProfile && <View style={styles.editBadge}><Text style={styles.editText}>Editar</Text><Ionicons name="options-outline" size={14} color={theme.muted} /></View>}</View></Card>
    </Pressable>

    {total && <Pressable onPress={props.onOpenHistory} disabled={!props.onOpenHistory} accessibilityRole={props.onOpenHistory ? 'button' : undefined}>
      <Card><View style={styles.cardHeading}><View style={styles.headingLeft}><Ionicons name="trending-up-outline" size={18} color={theme.blue} /><SectionTitle>Resumo de compras</SectionTitle></View>{props.onOpenHistory && <Text style={styles.link}>Ver histórico →</Text>}</View>
        <View style={styles.statGrid}>{([['TOTAL GASTO', brl(total.totalSpent), theme.success], ['MÉDIA POR COMPRA', brl(average), theme.blue], ['COMPRAS', String(total.totalPurchases), theme.ink], ['ITENS COMPRADOS', String(total.totalItems), theme.ink]] as const).map(([label, value, color]) => <View key={label} style={styles.statCell}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, { color }]}>{value}</Text></View>)}</View>
      </Card>
    </Pressable>}

    {preference && <>
      <Card><SectionTitle>Aparência</SectionTitle>
        <Text style={styles.smallLabel}>TEMA</Text>
        <Choice value={preference.theme} options={[{ value: 'light', label: 'Claro', icon: 'sunny-outline' }, { value: 'dark', label: 'Escuro', icon: 'moon-outline' }, { value: 'system', label: 'Sistema', icon: 'laptop-outline' }]} onChange={props.onChangePreferences ? value => update('theme', value) : undefined} />
        <View style={styles.divider} /><View style={styles.labelRow}><Ionicons name="text-outline" size={14} color={theme.blue} /><Text style={styles.smallLabel}>TAMANHO DO TEXTO</Text></View>
        <Choice value={preference.fontSize} options={[{ value: 'small', label: 'Pequeno' }, { value: 'normal', label: 'Padrão' }, { value: 'large', label: 'Grande' }]} onChange={props.onChangePreferences ? value => update('fontSize', value) : undefined} />
        <View style={styles.divider} /><Text style={styles.smallLabel}>ESTILO DE MARCAÇÃO</Text>
        <Choice value={preference.checkboxStyle} options={[{ value: 'circle', label: 'Círculo', icon: 'ellipse-outline' }, { value: 'switch', label: 'Chave', icon: 'toggle-outline' }]} onChange={props.onChangePreferences ? value => update('checkboxStyle', value) : undefined} />
        <View style={styles.divider} /><View style={styles.toggleGroup}><ToggleRow icon="sunny-outline" title="Alto contraste" description="Bordas reforçadas para uso sob luz forte" value={preference.highContrast} onChange={props.onChangePreferences ? value => update('highContrast', value) : undefined} /></View>
      </Card>
      <Card><SectionTitle>Preferências de uso</SectionTitle><View style={styles.toggleGroup}>
        <ToggleRow icon="flash-outline" title="Tela sempre ativa" description="Evita que o celular bloqueie durante as compras" value={preference.keepScreenAwake} onChange={props.onChangePreferences ? value => update('keepScreenAwake', value) : undefined} />
        <ToggleRow icon="phone-portrait-outline" title="Vibração ao tocar" description="Resposta tátil ao marcar itens e botões" value={preference.vibration} onChange={props.onChangePreferences ? value => update('vibration', value) : undefined} />
        <ToggleRow icon="volume-high-outline" title="Sons do app" description="Efeitos sonoros sutis em ações concluídas" value={preference.soundEffects} onChange={props.onChangePreferences ? value => update('soundEffects', value) : undefined} />
        {preference.notifications !== undefined && <ToggleRow icon="notifications-outline" title="Notificações" description="Avisos de alterações e listas compartilhadas" value={preference.notifications} onChange={props.onChangePreferences ? value => update('notifications', value) : undefined} />}
      </View></Card>
    </>}

    <Card>
      <SectionTitle>Atualização do Aplicativo</SectionTitle>
      <View style={styles.aboutRow}>
        <View style={styles.flex}>
          <Text style={styles.toggleTitle}>Caneto™ v{props.version || '1.0.3'}</Text>
          <Text style={styles.toggleDescription}>Verifique e instale novas versões direto do GitHub</Text>
        </View>
        {props.onCheckUpdate && <Pressable style={styles.proButton} onPress={props.onCheckUpdate} accessibilityRole="button">
          <Ionicons name="cloud-download-outline" size={15} color="#FFFFFF" />
          <Text style={styles.proButtonText}>Verificar</Text>
        </Pressable>}
      </View>
    </Card>

    {(props.version || props.onOpenOnboarding || props.onOpenChangelog) && <Card><SectionTitle>Sobre o app</SectionTitle>
      {props.version && <View style={styles.aboutRow}><View style={styles.flex}><Text style={styles.toggleTitle}>Caneto™ {props.version}</Text>{props.buildDate && <Text style={styles.toggleDescription}>Atualizado em {props.buildDate}</Text>}</View>{props.onOpenChangelog && <Pressable style={styles.proButton} onPress={props.onOpenChangelog}><Text style={styles.proButtonText}>Novidades</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></Pressable>}</View>}
      {props.onOpenOnboarding && <View style={styles.aboutRow}><View style={styles.flex}><Text style={styles.toggleTitle}>Guia de boas-vindas</Text><Text style={styles.toggleDescription}>Aprenda a aproveitar todos os recursos</Text></View><Pressable style={styles.editBadge} onPress={props.onOpenOnboarding}><Text style={styles.editText}>Abrir guia</Text></Pressable></View>}
    </Card>}
    {props.onSignOut && <Pressable style={styles.signOut} onPress={props.onSignOut} accessibilityRole="button"><Ionicons name="log-out-outline" size={18} color={theme.danger} /><Text style={styles.signOutText}>Sair da conta</Text></Pressable>}
    <View style={styles.footerCard}><Image source={require('./assets/evandromqs.webp')} style={styles.footerImage} /><Text style={styles.footer}>Criado por Evandro Mqs</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background }, content: { gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 124 }, card: { borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 11 }, planCard: { backgroundColor: '#F4F7FF' },
  flex: { flex: 1, minWidth: 0 }, topRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7 }, headingLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 }, sectionTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 15 },
  planImage: { width: 46, height: 46 }, profileName: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 16 }, profileSubtitle: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 13 }, planActive: { color: theme.blue, fontFamily: theme.font.bold, fontSize: 11 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: 54, height: 54 }, avatarLetter: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 23 },
  proButton: { backgroundColor: theme.blue, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11 }, proButtonText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 12 }, editBadge: { backgroundColor: theme.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', gap: 4, alignItems: 'center' }, editText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 4 }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, smallLabel: { color: theme.subtle, fontFamily: theme.font.bold, fontSize: 11, letterSpacing: 0.5 }, progressTrack: { height: 8, borderRadius: 5, backgroundColor: theme.border, overflow: 'hidden' }, progressFill: { height: 8, borderRadius: 5 }, countText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 },
  link: { color: theme.blue, fontFamily: theme.font.semibold, fontSize: 12 }, statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, statCell: { width: '48%', backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 10, gap: 5 }, statLabel: { color: theme.subtle, fontFamily: theme.font.semibold, fontSize: 10, letterSpacing: 0.4 }, statValue: { fontFamily: theme.font.bold, fontSize: 16 },
  choiceRow: { flexDirection: 'row', gap: 8 }, choice: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 4 }, choiceSelected: { borderColor: theme.blue, backgroundColor: theme.blueSoft }, choiceText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 }, choiceTextSelected: { color: theme.blue, fontFamily: theme.font.bold }, disabled: { opacity: 0.75 },
  toggleGroup: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 12, overflow: 'hidden' }, toggleRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border, padding: 11 }, toggleIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#E6EBF2', alignItems: 'center', justifyContent: 'center' }, toggleIconActive: { backgroundColor: theme.blueSoft }, toggleInfo: { flex: 1 }, toggleTitle: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 }, toggleDescription: { color: theme.subtle, fontFamily: theme.font.regular, fontSize: 11 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: 11, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }, signOut: { minHeight: 49, borderRadius: 15, borderWidth: 1, borderColor: '#FECACA', backgroundColor: theme.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, signOutText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 13 }, footerCard: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.border, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 8 }, footerImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#B8CAFB' }, footer: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 },
});
