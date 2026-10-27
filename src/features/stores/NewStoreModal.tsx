import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { CANETO_API } from '../../core/api';
import { decodeBase64 } from '../../core/bytes';
import { generateUUID } from '../../ui/error';
import { ModalSheet } from '../../ui/ModalSheet';
import { theme } from '../../ui/theme';
import { STORE_CATEGORIES, type Coordinates, type StoreCategory } from './model';
import { useDeviceLocation } from './useDeviceLocation';

const categories = STORE_CATEGORIES.filter(entry => entry.id !== 'all');

export function NewStoreModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <NewStoreDialog onClose={onClose} /> : null;
}

function NewStoreDialog({ onClose }: { onClose: () => void }) {
  const location = useDeviceLocation(true);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StoreCategory>('supermarket');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const coords: Coordinates | null = location.coords;

  const usePhoto = (base64?: string | null) => {
    if (!base64) { setError('Não foi possível ler a foto.'); return; }
    setPhoto(`data:image/jpeg;base64,${base64}`);
    setCameraOpen(false);
    setError('');
  };

  const capture = async () => {
    const shot = await camera.current?.takePictureAsync({ base64: true, quality: 0.45 });
    usePhoto(shot?.base64);
  };

  const fromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.45 });
    if (!result.canceled) usePhoto(result.assets[0]?.base64);
  };

  const identify = async () => {
    if (!photo) return;
    setBusy(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Entre na sua conta para analisar a fachada.');
      const response = await fetch(`${CANETO_API}/api/places/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: photo }),
      });
      const body = await response.json() as { name?: string; category?: string; error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível reconhecer a fachada.');
      if (body.name) setName(body.name);
      if (body.category && categories.some(entry => entry.id === body.category)) setCategory(body.category as StoreCategory);
      if (!body.name) setError('Nome não identificado. Informe o nome da loja antes de enviar.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao analisar a foto.');
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!name.trim() || !photo || !coords) { setError('Informe o nome, tire uma foto e permita a localização.'); return; }
    setBusy(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Entre na sua conta para enviar um local.');
      const bytes = decodeBase64(photo.split(',')[1] || '');
      if (bytes.byteLength > 2_000_000) throw new Error('A foto ficou grande demais. Tire outra foto.');
      const path = `${user.id}/${generateUUID()}.jpg`;
      const upload = await supabase.storage.from('store-submissions').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) throw upload.error;
      const insert = await supabase.from('store_submissions').insert({ user_id: user.id, name: name.trim(), category, latitude: coords.lat, longitude: coords.lng, photo_path: path });
      if (insert.error) {
        await supabase.storage.from('store-submissions').remove([path]);
        throw insert.error;
      }
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o local.');
    } finally { setBusy(false); }
  };

  return <ModalSheet visible title="Novo local" subtitle="A fachada fica pendente até a aprovação" onClose={onClose}>
    {done ? <View style={styles.gap}>
      <Text style={styles.body}>Local enviado para confirmação. Ele aparece no mapa depois que o administrador aprovar.</Text>
      <Pressable style={styles.primary} onPress={onClose}><Text style={styles.primaryText}>Concluir</Text></Pressable>
    </View> : <View style={styles.gap}>
      {cameraOpen ? <View style={styles.gap}>
        <CameraView ref={camera} style={styles.camera} facing="back" />
        <View style={styles.row}>
          <Pressable style={styles.primary} onPress={() => void capture()}><Text style={styles.primaryText}>Capturar fachada</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => setCameraOpen(false)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
        </View>
      </View> : <Pressable style={styles.primary} onPress={() => { if (!permission?.granted) void requestPermission().then(next => { if (next.granted) setCameraOpen(true); else setError('Permita a câmera para fotografar a fachada.'); }); else setCameraOpen(true); }}>
        <Ionicons name="camera-outline" size={18} color="white" /><Text style={styles.primaryText}>{photo ? 'Fotografar novamente' : 'Abrir câmera'}</Text>
      </Pressable>}
      <Pressable onPress={() => void fromGallery()}><Text style={styles.link}>Ou escolher foto da galeria</Text></Pressable>
      {!!photo && <Image source={{ uri: photo }} style={styles.preview} accessibilityLabel="Prévia da fachada" />}
      {!!photo && <Pressable style={styles.secondary} disabled={busy} onPress={() => void identify()}><Text style={styles.secondaryText}>{busy ? 'Analisando...' : 'Detectar nome com IA'}</Text></Pressable>}
      <Text style={styles.label}>Nome do local</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} placeholder="Nome exibido na fachada" placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Categoria</Text>
      <View style={styles.chips}>{categories.map(entry => <Pressable key={entry.id} style={[styles.chip, category === entry.id && styles.chipOn]} onPress={() => setCategory(entry.id)}><Text style={[styles.chipText, category === entry.id && styles.chipTextOn]}>{entry.label}</Text></Pressable>)}</View>
      <Text style={styles.location}>{coords ? `Localização marcada: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : location.message || 'Obtendo localização...'}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.primary, (!name.trim() || !photo || !coords || busy) && styles.disabled]} disabled={!name.trim() || !photo || !coords || busy} onPress={() => void submit()}>
        {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Enviar para aprovação</Text>}
      </Pressable>
    </View>}
  </ModalSheet>;
}

const styles = StyleSheet.create({
  gap: { gap: 12 }, row: { flexDirection: 'row', gap: 8 },
  camera: { height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: '#020817' },
  preview: { width: '100%', height: 160, borderRadius: 12 },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  primaryText: { color: 'white', fontFamily: theme.font.bold },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: theme.blue, fontFamily: theme.font.semibold },
  link: { color: theme.blue, fontFamily: theme.font.semibold, textAlign: 'center', textDecorationLine: 'underline' },
  label: { color: theme.ink, fontFamily: theme.font.bold },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.ink, fontFamily: theme.font.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { backgroundColor: theme.blue, borderColor: theme.blue },
  chipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 },
  chipTextOn: { color: 'white' },
  location: { color: theme.muted, fontFamily: theme.font.regular },
  error: { color: theme.danger, fontFamily: theme.font.regular },
  body: { color: theme.ink, fontFamily: theme.font.regular, lineHeight: 22 },
  disabled: { opacity: 0.5 },
});
