import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import type { Item, List } from '../../data';

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

type ItemProps = { item: Item | null; visible: boolean; onClose: () => void; onSave: (changes: { name: string; quantity: number; unit: string; price: number | null }) => Promise<void>; onDelete: () => Promise<void> };
const units = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz', 'lata', 'garrafa'];
export function ItemEditModal({ item, visible, onClose, onSave, onDelete }: ItemProps) {
  return visible && item ? <ItemEditDialog key={item.id} item={item} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null;
}
function ItemEditDialog({ item, onClose, onSave, onDelete }: Omit<ItemProps, 'visible' | 'item'> & { item: Item }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(item.price == null ? '' : String(item.price).replace('.', ','));
  const numericPrice = price.trim() ? Number(price.replace(',', '.')) : null;
  return <ModalSheet visible title="Editar produto" subtitle={item.name} onClose={onClose}>
    <Text style={styles.label}>Nome</Text><TextInput style={styles.input} value={name} onChangeText={setName} />
    <Text style={styles.label}>Quantidade</Text><View style={styles.quantityRow}><Pressable style={styles.stepper} onPress={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))}><Text style={styles.stepperText}>−</Text></Pressable><TextInput style={[styles.input, styles.quantityInput]} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} /><Pressable style={styles.stepper} onPress={() => setQuantity(String((Number(quantity) || 0) + 1))}><Text style={styles.stepperText}>+</Text></Pressable></View>
    <Text style={styles.label}>Unidade</Text><View style={styles.unitRow}>{units.map(value => <Pressable key={value} style={[styles.unit, unit === value && styles.unitActive]} onPress={() => setUnit(value)}><Text style={[styles.unitText, unit === value && styles.unitTextActive]}>{value}</Text></Pressable>)}</View>
    <Text style={styles.label}>Preço unitário (R$)</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="0,00" />
    <Pressable style={styles.primary} onPress={() => { if (name.trim() && Number(quantity) > 0 && (numericPrice === null || Number.isFinite(numericPrice))) void onSave({ name: name.trim(), quantity: Number(quantity), unit, price: numericPrice }); else Alert.alert('Confira nome, quantidade e preço.'); }}><Text style={styles.primaryText}>Salvar produto</Text></Pressable>
    <Action icon="trash-outline" label="Excluir produto" danger onPress={() => Alert.alert('Excluir produto?', item.name, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void onDelete() }])} />
  </ModalSheet>;
}

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
}));
