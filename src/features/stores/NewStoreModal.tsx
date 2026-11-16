import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { CANETO_API } from '../../core/api';
import { decodeBase64 } from '../../core/bytes';
import { generateUUID, getErrorMessage } from '../../ui/error';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import { STORE_CATEGORIES, categoryLabel, type Coordinates, type StoreCategory } from './model';
import { useDeviceLocation } from './useDeviceLocation';

const categories = STORE_CATEGORIES.filter(entry => entry.id !== 'all');

export function NewStoreModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <NewStoreDialog onClose={onClose} /> : null;
}

function NewStoreDialog({ onClose }: { onClose: () => void }) {
  const location = useDeviceLocation(true);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StoreCategory>('supermarket');
  const [role, setRole] = useState<'client' | 'owner'>('client');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const coords: Coordinates | null = location.coords;

  const acceptPhoto = (base64?: string | null) => {
    if (!base64) { setError('Não foi possível ler a foto.'); return; }
    setPhotos(prev => [...prev, `data:image/jpeg;base64,${base64}`].slice(0, 4));
    setCameraOpen(false);
    setError('');
  };

  const capture = async () => {
    const shot = await camera.current?.takePictureAsync({ base64: true, quality: 0.45 });
    acceptPhoto(shot?.base64);
  };

  const fromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.45 });
    if (!result.canceled) acceptPhoto(result.assets[0]?.base64);
  };

  const identify = async () => {
    const primaryPhoto = photos[0];
    if (!primaryPhoto) return;
    setBusy(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Entre na sua conta para analisar a fachada.');
      const response = await fetch(`${CANETO_API}/api/places/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: primaryPhoto }),
      });
      const body = await response.json() as { name?: string; category?: string; error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível reconhecer a fachada.');
      if (body.name) setName(body.name);
      if (body.category && categories.some(entry => entry.id === body.category)) setCategory(body.category as StoreCategory);
      if (!body.name) setError('Nome não identificado.');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!name.trim() || !coords || photos.length < 2) {
      setError('Adicione no mínimo 2 fotos para finalizar.');
      return;
    }
    setBusy(true);
    setError('');
    const uploadedPaths: string[] = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Entre na sua conta para enviar um local.');
      for (const item of photos) {
        const bytes = decodeBase64(item.split(',')[1] || '');
        if (bytes.byteLength > 2_000_000) throw new Error('Uma das fotos ficou grande demais. Tire outra foto.');
        const path = `${user.id}/${generateUUID()}.jpg`;
        const upload = await supabase.storage.from('store-submissions').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) throw upload.error;
        uploadedPaths.push(path);
      }
      const insert = await supabase.from('store_submissions').insert({
        user_id: user.id,
        name: name.trim(),
        category,
        latitude: coords.lat,
        longitude: coords.lng,
        photo_path: uploadedPaths[0],
      });
      if (insert.error) throw insert.error;
      setDone(true);
    } catch (cause) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('store-submissions').remove(uploadedPaths);
      }
      setError(getErrorMessage(cause));
    } finally { setBusy(false); }
  };

  const handleNext = () => {
    setError('');
    if (step === 0) {
      if (name.trim().length < 2) {
        setError('Informe o nome do local (mínimo 2 caracteres).');
        return;
      }
      if (!coords) {
        setError('Aguarde a obtenção da localização.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    void submit();
  };

  const subtitle = done
    ? 'Cadastro concluído'
    : step === 0
      ? 'Passo 1 de 3 · Nome e localização'
      : step === 1
        ? 'Passo 2 de 3 · Categoria e vínculo'
        : 'Passo 3 de 3 · Fotos e revisão';

  const footer = done ? (
    <Pressable style={styles.primary} onPress={onClose} accessibilityRole="button">
      <Text style={styles.primaryText}>Concluir</Text>
    </Pressable>
  ) : (
    <View style={styles.footerRow}>
      {step === 0 ? (
        <Pressable style={styles.closeLeftBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
          <Text style={styles.closeLeftText}>Fechar</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.backBtn} disabled={busy} onPress={() => { setError(''); setCameraOpen(false); setStep(s => (s - 1) as 0 | 1 | 2); }} accessibilityRole="button">
          <Ionicons name="arrow-back" size={17} color={theme.ink} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      )}
      <Pressable
        style={[
          styles.primary,
          styles.footerPrimary,
          ((step === 0 && (!name.trim() || !coords)) || (step === 2 && photos.length < 2) || busy) && styles.disabled,
        ]}
        disabled={(step === 0 && (!name.trim() || !coords)) || (step === 2 && photos.length < 2) || busy}
        onPress={handleNext}
      >
        {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>{step === 2 ? 'Finalizar' : 'Continuar'}</Text>}
      </Pressable>
    </View>
  );

  return (
    <ModalSheet visible title="Novo local" subtitle={subtitle} hideCloseButton centerTitle onClose={onClose} footer={footer}>
      {done ? (
        <View style={styles.doneBox}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-done" size={30} color={theme.success} />
          </View>
          <Text style={styles.doneTitle}>Local enviado!</Text>
          <Text style={styles.body}>Ele aparecerá no mapa assim que for aprovado.</Text>
        </View>
      ) : (
        <View style={styles.gap}>
          <View style={styles.stepDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          {step === 0 && (
            <View style={styles.centeredSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.labelCentered}>Nome do local</Text>
                <TextInput
                  style={styles.inputCentered}
                  value={name}
                  onChangeText={setName}
                  maxLength={120}
                  placeholder="Ex: Supermercado Central"
                  placeholderTextColor={theme.muted}
                />
              </View>
              <View style={styles.locationCard}>
                <Ionicons name={coords ? 'location' : 'locate-outline'} size={20} color={coords ? theme.success : theme.blueLight} />
                <Text style={styles.locationTitle}>{coords ? 'Localização capturada' : 'Obtendo localização...'}</Text>
                <Text style={styles.location}>
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : location.message || 'Ative o GPS para marcar o ponto'}
                </Text>
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.centeredSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.labelCentered}>Você é dono ou cliente?</Text>
                <View style={styles.row}>
                  {([
                    { id: 'client', label: 'Cliente', icon: 'person-outline' },
                    { id: 'owner', label: 'Dono', icon: 'briefcase-outline' },
                  ] as const).map(opt => {
                    const active = role === opt.id;
                    return (
                      <Pressable key={opt.id} style={[styles.roleBtn, active && styles.roleBtnOn]} onPress={() => setRole(opt.id)}>
                        <Ionicons name={opt.icon} size={16} color={active ? '#FFFFFF' : theme.ink} />
                        <Text style={[styles.roleText, active && styles.roleTextOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.labelCentered}>Categoria</Text>
                <View style={styles.chips}>
                  {categories.map(entry => (
                    <Pressable key={entry.id} style={[styles.chip, category === entry.id && styles.chipOn]} onPress={() => setCategory(entry.id)}>
                      <Text style={[styles.chipText, category === entry.id && styles.chipTextOn]}>{entry.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.centeredSection}>
              <Text style={styles.labelCentered}>Fotos do local ({photos.length}/2 mínimo)</Text>
              {cameraOpen ? (
                <View style={styles.gap}>
                  <CameraView ref={camera} style={styles.camera} facing="back" />
                  <View style={styles.row}>
                    <Pressable style={[styles.primary, styles.flex1]} onPress={() => void capture()}><Text style={styles.primaryText}>Capturar</Text></Pressable>
                    <Pressable style={[styles.secondary, styles.flex1]} onPress={() => setCameraOpen(false)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.row}>
                  <Pressable
                    style={[styles.primary, styles.flex1]}
                    onPress={() => {
                      if (!permission?.granted) {
                        void requestPermission().then(next => {
                          if (next.granted) setCameraOpen(true);
                          else setError('Permita a câmera para fotografar o local.');
                        });
                      } else {
                        setCameraOpen(true);
                      }
                    }}
                  >
                    <Ionicons name="camera-outline" size={18} color="white" />
                    <Text style={styles.primaryText}>Câmera</Text>
                  </Pressable>
                  <Pressable style={[styles.secondary, styles.flex1]} onPress={() => void fromGallery()}>
                    <Ionicons name="images-outline" size={18} color={theme.ink} />
                    <Text style={styles.secondaryText}>Galeria</Text>
                  </Pressable>
                </View>
              )}

              {photos.length > 0 && (
                <View style={styles.photosGrid}>
                  {photos.map((uri, index) => (
                    <View key={`${index}-${uri.slice(-12)}`} style={styles.photoItem}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <Pressable style={styles.removePhoto} onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {photos.length > 0 && (
                <Pressable style={styles.secondary} disabled={busy} onPress={() => void identify()}>
                  <Ionicons name="sparkles-outline" size={16} color={theme.ink} />
                  <Text style={styles.secondaryText}>{busy ? 'Analisando...' : 'Detectar nome pela foto'}</Text>
                </Pressable>
              )}

              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>Revisão</Text>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Nome</Text><Text style={styles.reviewVal} numberOfLines={1}>{name.trim()}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Categoria</Text><Text style={styles.reviewVal}>{categoryLabel(category)}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Vínculo</Text><Text style={styles.reviewVal}>{role === 'owner' ? 'Dono' : 'Cliente'}</Text></View>
                <View style={[styles.reviewRow, styles.reviewRowLast]}><Text style={styles.reviewKey}>Fotos</Text><Text style={styles.reviewVal}>{photos.length} adicionada(s)</Text></View>
              </View>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 8, width: '100%' },
  flex1: { flex: 1 },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.borderStrong },
  dotActive: { width: 22, backgroundColor: theme.blue },
  centeredSection: { gap: 14, alignItems: 'center', width: '100%' },
  fieldGroup: { gap: 6, width: '100%' },
  labelCentered: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13, textAlign: 'center' },
  inputCentered: { minHeight: 46, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 14, color: theme.ink, fontFamily: theme.font.semibold, fontSize: 15, textAlign: 'center' },
  locationCard: { width: '100%', alignItems: 'center', gap: 4, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  locationTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  location: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 12, textAlign: 'center' },
  roleBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  roleBtnOn: { backgroundColor: theme.blue, borderColor: theme.blue },
  roleText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  roleTextOn: { color: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  chip: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  chipOn: { backgroundColor: theme.blue, borderColor: theme.blue },
  chipText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 12 },
  chipTextOn: { color: 'white' },
  camera: { width: '100%', height: 210, borderRadius: 16, overflow: 'hidden', backgroundColor: '#020817' },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, width: '100%' },
  photoItem: { position: 'relative', width: 78, height: 78, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  photoThumb: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(2,6,23,0.75)', alignItems: 'center', justifyContent: 'center' },
  reviewCard: { width: '100%', borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, overflow: 'hidden' },
  reviewTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12, textAlign: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10 },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewKey: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  reviewVal: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 12, flexShrink: 1, textAlign: 'right' },
  primary: { minHeight: 46, borderRadius: 12, backgroundColor: theme.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 14 },
  primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 14 },
  secondary: { width: '100%', minHeight: 44, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 12 },
  secondaryText: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  footerPrimary: { flex: 1 },
  closeLeftBtn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  closeLeftText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  backBtn: { minHeight: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  backText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 14 },
  doneBox: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  doneIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.successSoft, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 18 },
  body: { color: theme.muted, fontFamily: theme.font.regular, lineHeight: 20, fontSize: 13, textAlign: 'center' },
  error: { color: theme.danger, fontFamily: theme.font.semibold, fontSize: 12, textAlign: 'center' },
  disabled: { opacity: 0.5 },
}));
