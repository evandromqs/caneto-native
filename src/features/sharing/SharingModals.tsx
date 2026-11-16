import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../../ui/ModalSheet';
import { createThemedStyles, theme } from '../../ui/theme';
import type { List } from '../../data';
import { ensureShareCode, loadAccessRequests, respondAccessRequest, type AccessRequest } from './repository';
import { getErrorMessage } from '../../ui/error';

function extractShareCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/[?&]code=([A-Za-z0-9]{4,12})/i);
  if (match?.[1]) return match[1].toUpperCase();
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function JoinListModal({ visible, onClose, onJoin }: { visible: boolean; onClose: () => void; onJoin: (code: string) => Promise<'joined' | 'pending'> }) {
  return visible ? <JoinListDialog onClose={onClose} onJoin={onJoin} /> : null;
}

function JoinListDialog({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => Promise<'joined' | 'pending'> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const submitCode = async (targetCode: string) => {
    const clean = extractShareCode(targetCode);
    if (clean.length < 4) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await onJoin(clean);
      setMessage(result === 'pending' ? 'Solicitação enviada. Aguarde a aprovação do dono da lista.' : 'Você entrou na lista.');
      if (result === 'joined') onClose();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openQrScanner = async () => {
    setMessage('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setMessage('Permita o acesso à câmera para ler o QR Code da lista.');
        return;
      }
    }
    setScannerOpen(true);
  };

  return (
    <ModalSheet
      visible
      title="Entrar em uma lista"
      subtitle="Use o QR Code ou digite o código"
      hideCloseButton
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Pressable style={styles.closeLeftBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
            <Text style={styles.closeLeftText}>Fechar</Text>
          </Pressable>
          <Pressable
            style={[styles.primary, styles.footerPrimary, (busy || code.length < 4) && styles.disabled]}
            disabled={busy || code.length < 4}
            onPress={() => void submitCode(code)}
          >
            <Text style={styles.primaryText}>{busy ? 'Conectando...' : 'Entrar'}</Text>
          </Pressable>
        </View>
      }
    >
      <Pressable style={styles.qrScanButton} onPress={() => void openQrScanner()} disabled={busy} accessibilityRole="button">
        <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
        <Text style={styles.primaryText}>Ler QR Code</Text>
      </Pressable>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>ou digite o código</Text>
        <View style={styles.orLine} />
      </View>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={value => { setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setMessage(''); }}
        autoCapitalize="characters"
        maxLength={8}
        placeholder="Código (ex: COM123)"
        placeholderTextColor={theme.muted}
      />
      {!!message && <Text style={styles.message}>{message}</Text>}

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)} statusBarTranslucent>
        <View style={styles.scannerRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={event => {
              const extracted = extractShareCode(event.data ?? '');
              if (extracted.length >= 4) {
                setScannerOpen(false);
                setCode(extracted);
                void submitCode(extracted);
              }
            }}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerHint}>Aponte para o QR Code da lista</Text>
            <View style={styles.scannerFrame} />
            <Pressable style={styles.scannerClose} onPress={() => setScannerOpen(false)}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
              <Text style={styles.primaryText}>Fechar câmera</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ModalSheet>
  );
}

export function ShareListModal({ visible, list, onClose, onChanged }: { visible: boolean; list: List | null; onClose: () => void; onChanged: () => Promise<void> }) {
  return visible && list ? <ShareListDialog key={list.id} list={list} onClose={onClose} onChanged={onChanged} /> : null;
}

function ShareListDialog({ list, onClose, onChanged }: { list: List; onClose: () => void; onChanged: () => Promise<void> }) {
  const [code, setCode] = useState(list.share_code ?? '');
  const [mode, setMode] = useState<'qr' | 'code'>('qr');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const shareCode = await ensureShareCode(list);
        if (active) setCode(shareCode);
        const pending = await loadAccessRequests(list.id);
        if (active) {
          setRequests(pending);
          setMessage('');
        }
      } catch (error) {
        if (active) setMessage(getErrorMessage(error));
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 12000);
    return () => { active = false; clearInterval(timer); };
  }, [list]);

  const shareUrl = code ? `https://caneto.online/app?code=${code}` : '';
  const qrImageUrl = shareUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(shareUrl)}` : '';

  return (
    <ModalSheet
      visible
      title="Compartilhar lista"
      subtitle={list.name}
      hideCloseButton
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Pressable style={styles.closeLeftBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
            <Text style={styles.closeLeftText}>Fechar</Text>
          </Pressable>
          <Pressable
            style={[styles.primary, styles.footerPrimary, !code && styles.disabled]}
            disabled={!code}
            onPress={() => void Share.share({ message: `Entre na minha lista "${list.name}" no Caneto! Código: ${code}\n${shareUrl}` })}
          >
            <Ionicons name="share-social-outline" color="white" size={18} />
            <Text style={styles.primaryText}>Compartilhar</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'qr' && styles.tabActive]} onPress={() => setMode('qr')}>
          <Ionicons name="qr-code-outline" size={16} color={mode === 'qr' ? '#FFFFFF' : theme.ink} />
          <Text style={[styles.tabText, mode === 'qr' && styles.tabTextActive]}>QR Code</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'code' && styles.tabActive]} onPress={() => setMode('code')}>
          <Ionicons name="key-outline" size={16} color={mode === 'code' ? '#FFFFFF' : theme.ink} />
          <Text style={[styles.tabText, mode === 'code' && styles.tabTextActive]}>Código</Text>
        </Pressable>
      </View>

      {mode === 'qr' ? (
        <View style={styles.qrCard}>
          {qrImageUrl ? (
            <View style={styles.qrFrame}>
              <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
            </View>
          ) : (
            <ActivityIndicator size="large" color={theme.blueLight} />
          )}
          <Text style={styles.qrCaption}>Código: <Text style={styles.qrCodeInline}>{code || '...'}</Text></Text>
        </View>
      ) : (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Código da lista</Text>
          <Text style={styles.code} selectable>{code || 'Gerando...'}</Text>
          {!!shareUrl && <Text style={styles.linkPreview} numberOfLines={1} selectable>{shareUrl}</Text>}
        </View>
      )}

      {!!message && <Text style={styles.message}>{message}</Text>}

      {requests.length > 0 && <Text style={styles.requestsTitle}>Solicitações de acesso ({requests.length})</Text>}
      {requests.map(request => (
        <View key={request.id} style={styles.request}>
          <Text style={styles.requestName}>{request.requester_name}</Text>
          <Pressable
            accessibilityLabel={`Aprovar ${request.requester_name}`}
            onPress={() => void respondAccessRequest(request.id, true).then(async () => {
              setRequests(current => current.filter(item => item.id !== request.id));
              await onChanged();
            }).catch(error => setMessage(getErrorMessage(error)))}
          >
            <Ionicons name="checkmark-circle" size={28} color={theme.success} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Recusar ${request.requester_name}`}
            onPress={() => void respondAccessRequest(request.id, false).then(() => setRequests(current => current.filter(item => item.id !== request.id))).catch(error => setMessage(getErrorMessage(error)))}
          >
            <Ionicons name="close-circle" size={28} color={theme.danger} />
          </Pressable>
        </View>
      ))}
    </ModalSheet>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  explanation: { color: theme.muted, fontFamily: theme.font.regular, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, minHeight: 40, borderRadius: 11, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: theme.blue, borderColor: theme.blue },
  tabText: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 13 },
  tabTextActive: { color: '#FFFFFF' },
  qrCard: { alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  qrFrame: { padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF' },
  qrImage: { width: 176, height: 176 },
  qrCaption: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 13 },
  qrCodeInline: { color: theme.ink, fontFamily: theme.font.bold, letterSpacing: 1.5 },
  codeBox: { alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted, borderRadius: 14, padding: 16 },
  codeLabel: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  code: { color: theme.ink, fontFamily: theme.font.bold, fontSize: 26, letterSpacing: 4 },
  linkPreview: { color: theme.blueLight, fontFamily: theme.font.regular, fontSize: 11, marginTop: 2 },
  shareActions: { marginTop: 12 },
  qrScanButton: { backgroundColor: theme.blue, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: theme.border },
  orText: { color: theme.muted, fontFamily: theme.font.semibold, fontSize: 12 },
  label: { color: theme.ink, fontFamily: theme.font.semibold, fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.background, color: theme.ink, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, fontSize: 17, fontFamily: theme.font.bold, marginBottom: 12, letterSpacing: 2 },
  primary: { backgroundColor: theme.blue, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: 'white', fontFamily: theme.font.bold, fontSize: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  footerPrimary: { flex: 1 },
  closeLeftBtn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  closeLeftText: { color: theme.danger, fontFamily: theme.font.bold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  message: { color: theme.danger, fontFamily: theme.font.regular, fontSize: 12, marginTop: 10, textAlign: 'center' },
  requestsTitle: { fontFamily: theme.font.bold, color: theme.ink, fontSize: 14, marginTop: 16, marginBottom: 6 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderTopWidth: 1, borderTopColor: theme.border },
  requestName: { flex: 1, color: theme.ink, fontFamily: theme.font.semibold },
  scannerRoot: { flex: 1, backgroundColor: '#000000' },
  scannerOverlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.35)' },
  scannerHint: { color: '#FFFFFF', fontFamily: theme.font.bold, fontSize: 16, textAlign: 'center' },
  scannerFrame: { width: 230, height: 230, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF' },
  scannerClose: { backgroundColor: theme.danger, borderRadius: 12, minHeight: 46, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
}));
