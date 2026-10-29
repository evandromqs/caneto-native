import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import type { List } from '../../data';

type NewProps = { visible: boolean; busy: boolean; onClose: () => void; onCreate: (name: string) => Promise<void> };
export function NewListModal({ visible, busy, onClose, onCreate }: NewProps) {
  return visible ? <NewListDialog busy={busy} onClose={onClose} onCreate={onCreate} /> : null;
}
function NewListDialog({ busy, onClose, onCreate }: Omit<NewProps, 'visible'>) {
  const [name, setName] = useState('');
  return <ModalSheet visible title="Nova lista" subtitle="Organize sua próxima compra" onClose={onClose}>
    <Text style={styles.label}>Nome da lista</Text><TextInput style={styles.input} placeholder="Ex: Compras do mês" value={name} onChangeText={setName} autoFocus maxLength={80} />
    <Pressable style={[styles.primary, (busy || !name.trim()) && styles.disabled]} disabled={busy || !name.trim()} onPress={() => onCreate(name)}><Text style={styles.primaryText}>Criar lista</Text></Pressable>
  </ModalSheet>;
}

type ListProps = { list: List | null; visible: boolean; ownerId: string; onClose: () => void; onRename: (name: string, store: string) => Promise<void>; onDuplicate: () => Promise<void>; onDelete: () => Promise<void>; onComplete: () => Promise<void>; onShare: () => void };
export function ListActionsModal({ list, visible, ownerId, onClose, onRename, onDuplicate, onDelete, onComplete, onShare }: ListProps) {
  return visible && list ? <ListActionsDialog key={list.id} list={list} ownerId={ownerId} onClose={onClose} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} onComplete={onComplete} onShare={onShare} /> : null;
}
function ListActionsDialog({ list, ownerId, onClose, onRename, onDuplicate, onDelete, onComplete, onShare }: Omit<ListProps, 'visible' | 'list'> & { list: List }) {
  const [name, setName] = useState(list.name);
  const [store, setStore] = useState(list.store_name ?? '');
  const editable = list.permission === 'editor';
  const own = list.user_id === ownerId;
  return <ModalSheet visible title="Editar Lista" subtitle="Nome, estabelecimento e ações" onClose={onClose}>
    {editable && <><Text style={styles.label}>Nome da lista</Text><TextInput style={styles.input} value={name} onChangeText={setName} maxLength={80} /><Text style={styles.label}>Supermercado / Estabelecimento (Opcional)</Text><TextInput style={styles.input} value={store} onChangeText={setStore} placeholder="Ex: Carrefour" /><Pressable style={styles.primary} onPress={() => onRename(name, store)} disabled={!name.trim()}><Text style={styles.primaryText}>Salvar alterações</Text></Pressable></>}
    <View style={styles.divider} />
    {own && <Action icon="share-social-outline" label="Compartilhar lista" onPress={onShare} />}
    <Action icon="copy-outline" label="Duplicar lista" onPress={onDuplicate} />
    {editable && <Action icon={list.is_completed ? 'refresh-outline' : 'checkmark-circle-outline'} label={list.is_completed ? 'Reabrir lista' : 'Finalizar compra'} onPress={onComplete} />}
    {own && <Action icon="trash-outline" label="Excluir lista" danger onPress={() => Alert.alert('Excluir lista?', 'A lista e seus itens serão removidos.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void onDelete() }])} />}
  </ModalSheet>;
}

export { ItemEditModal, type ItemChanges, type ItemEditModalProps } from './ItemEditModal';


function Action({ icon, label, onPress, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void | Promise<unknown>; danger?: boolean }) {
  return <Pressable style={styles.action} onPress={onPress}><Ionicons name={icon} size={19} color={danger ? theme.danger : theme.blue} /><Text style={[styles.actionText, danger && { color: theme.danger }]}>{label}</Text><Ionicons name="chevron-forward" size={16} color="#94A3B8" /></Pressable>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  label: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 14, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, minHeight: 48, paddingHorizontal: 13, fontSize: 16, fontFamily: theme.font.regular, marginBottom: 17 },
  primary: { backgroundColor: theme.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 3 }, primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 15 }, disabled: { opacity: 0.5 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 17 }, action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 5 }, actionText: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15 },
  quantityRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' }, quantityInput: { flex: 1, textAlign: 'center' }, stepper: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.blueSoft, alignItems: 'center', justifyContent: 'center' }, stepperText: { color: theme.blue, fontSize: 24, fontFamily: theme.font.bold },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 }, unit: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }, unitActive: { backgroundColor: theme.blue, borderColor: theme.blue }, unitText: { color: theme.ink, fontFamily: theme.font.semibold }, unitTextActive: { color: 'white' },
  photoCard: { width: '100%', height: 190, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, padding: 6, marginBottom: 14, overflow: 'hidden' },
  itemPhoto: { width: '100%', height: '100%', borderRadius: 12 },
  photoFallback: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.background },
  photoHint: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  compactLabel: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13, marginBottom: 5 },
  compactInput: { minHeight: 44, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, color: theme.ink, borderRadius: 10, paddingHorizontal: 12, fontFamily: theme.font.semibold, fontSize: 14 },
  productName: { marginBottom: 12 },
  twoColumns: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  column: { flex: 1, minWidth: 0 },
  compactStepper: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, overflow: 'hidden' },
  stepperSide: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepperInput: { flex: 1, minWidth: 0, textAlign: 'center', color: theme.ink, fontFamily: theme.font.bold, fontSize: 14, paddingVertical: 0 },
  compactUnits: { minHeight: 44, alignItems: 'center', gap: 5 },
  compactUnit: { minWidth: 42, height: 42, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  compactUnitActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  compactUnitText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12 },
  compactUnitTextActive: { color: '#FFFFFF' },
  priceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 11 },
  priceField: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, paddingLeft: 12, marginBottom: 13 },
  currency: { color: theme.muted, fontFamily: theme.font.bold, fontSize: 14 },
  priceInput: { flex: 1, minWidth: 0, color: theme.ink, fontFamily: theme.font.bold, fontSize: 17, textAlign: 'center', paddingVertical: 8 },
  calculator: { width: 38, height: 38, marginRight: 5, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.blueSoft },
  detailsToggle: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background },
  detailsTitle: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  detailsSummary: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailsSummaryText: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 11 },
  detailsBody: { borderWidth: 1, borderTopWidth: 0, borderColor: theme.border, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, padding: 12, gap: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 5 },
  categoryChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  categoryChipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  categoryChipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 11 },
  categoryChipTextActive: { color: '#FFFFFF' },
  itemError: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12, marginTop: 10 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemDelete: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 11 },
  itemDeleteText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  itemSave: { minHeight: 44, minWidth: 126, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18, borderRadius: 11, backgroundColor: theme.blue },
  itemSaveText: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 14 },
  itemPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
}));
