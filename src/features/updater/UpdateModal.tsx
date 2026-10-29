import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, theme } from '../../ui/theme';
import type { ApkDownloadProgress, AppReleaseInfo } from './updaterService';
import { downloadAndInstallApk, isNewerVersion, openApkDownload } from './updaterService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppReleaseInfo | null;
  onClose: () => void;
}

export function UpdateModal({ visible, updateInfo, onClose }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<ApkDownloadProgress | null>(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadError, setDownloadError] = useState('');

  if (!visible || !updateInfo) return null;

  const handleClose = () => {
    if (downloading) return;
    setDownloadError('');
    setDownloadProgress(null);
    setDownloadStatus('');
    onClose();
  };

  const handleDownloadAndInstall = async () => {
    setDownloading(true);
    setDownloadError('');
    setDownloadStatus('Iniciando download...');
    try {
      await downloadAndInstallApk(updateInfo.apkUrl, progress => {
        setDownloadProgress(progress);
        setDownloadStatus(`Baixando atualização... ${progress.percentage}%`);
      });
      setDownloadStatus('Abrindo instalador nativo...');
      setTimeout(() => {
        setDownloading(false);
        handleClose();
      }, 1200);
    } catch (err: unknown) {
      console.warn('Erro no download ou instalador nativo:', err);
      const msg = err instanceof Error ? err.message : 'Não foi possível baixar ou iniciar a instalação do APK.';
      setDownloadError(`${msg} Você também pode baixar pelo navegador.`);
      setDownloading(false);
    }
  };

  const handleBrowserFallback = async () => {
    try {
      await openApkDownload(updateInfo.apkUrl);
      handleClose();
    } catch {
      setDownloadError('Não foi possível abrir o link no navegador.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download-outline" size={32} color={theme.blue} />
          </View>

          {/* Titles */}
          <Text style={styles.title}>Nova Atualização!</Text>
          <Text style={styles.subtitle}>
            Uma nova versão do Caneto está pronta para ser instalada no seu aparelho.
          </Text>

          {/* Version Pill */}
          <View style={styles.versionRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionLabel}>Atual: </Text>
              <Text style={styles.versionVal}>v{updateInfo.currentVersion}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={theme.muted} />
            <View style={[styles.versionBadge, styles.newVersionBadge]}>
              <Text style={styles.newVersionLabel}>Nova: </Text>
              <Text style={styles.newVersionVal}>v{updateInfo.latestVersion}</Text>
            </View>
          </View>

          {/* Release Notes */}
          {updateInfo.releaseNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>O que há de novo:</Text>
              <ScrollView style={styles.notesScroll}>
                <Text style={styles.notesText}>{updateInfo.releaseNotes}</Text>
              </ScrollView>
            </View>
          ) : null}

          {/* Progress Section */}
          {downloading && (
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.max(6, downloadProgress?.percentage ?? 6)}%` },
                  ]}
                />
              </View>
              <View style={styles.progressMeta}>
                <Text style={styles.progressPercentText}>
                  {downloadProgress ? `${downloadProgress.percentage}%` : 'Conectando...'}
                </Text>
                {!!downloadProgress && downloadProgress.totalBytesExpectedToWrite > 0 && (
                  <Text style={styles.progressBytesText}>
                    {(downloadProgress.totalBytesWritten / 1048576).toFixed(1)} MB / {(downloadProgress.totalBytesExpectedToWrite / 1048576).toFixed(1)} MB
                  </Text>
                )}
              </View>
              <Text style={styles.statusText}>{downloadStatus}</Text>
            </View>
          )}

          {!downloading && (
            <Text style={styles.helperText}>
              O Caneto baixa e executa o instalador do Android diretamente pelo app.
            </Text>
          )}

          {!isNewerVersion(updateInfo.currentVersion, '1.0.5') ? (
            <Text style={styles.warningText}>
              Se você instalou uma versão até v1.0.5 pelo GitHub, a nova assinatura exige remover o app antigo antes de instalar. Confirme que seus dados estão sincronizados.
            </Text>
          ) : null}

          {downloadError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{downloadError}</Text>
              <Pressable style={styles.browserFallbackButton} onPress={handleBrowserFallback}>
                <Ionicons name="open-outline" size={16} color={theme.blue} />
                <Text style={styles.browserFallbackText}>Baixar pelo navegador</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
              onPress={handleDownloadAndInstall}
              disabled={downloading}
              accessibilityRole="button"
            >
              {downloading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.downloadButtonText}>Baixando atualização...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.downloadButtonText}>Baixar e Instalar Agora</Text>
                </>
              )}
            </Pressable>

            {!downloading && (
              <Pressable
                style={styles.laterButton}
                onPress={handleClose}
                accessibilityRole="button"
              >
                <Text style={styles.laterButtonText}>Lembrar mais tarde</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createThemedStyles(theme => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.blueSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontFamily: theme.font.extrabold,
    color: theme.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.font.regular,
    color: theme.muted,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    fontFamily: theme.font.regular,
    color: theme.muted,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  versionBadge: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  versionLabel: {
    fontSize: 13,
    color: theme.muted,
    fontFamily: theme.font.regular,
  },
  versionVal: {
    fontSize: 13,
    color: theme.ink,
    fontFamily: theme.font.bold,
  },
  newVersionBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  newVersionLabel: {
    fontSize: 13,
    color: theme.blue,
    fontFamily: theme.font.regular,
  },
  newVersionVal: {
    fontSize: 13,
    color: theme.blue,
    fontFamily: theme.font.bold,
  },
  notesBox: {
    width: '100%',
    backgroundColor: theme.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  notesTitle: {
    fontSize: 12,
    fontFamily: theme.font.bold,
    color: theme.subtle,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 85,
  },
  notesText: {
    fontSize: 13,
    fontFamily: theme.font.regular,
    color: theme.ink,
    lineHeight: 18,
  },
  progressSection: {
    width: '100%',
    marginBottom: 14,
    backgroundColor: theme.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.blue,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressPercentText: {
    fontSize: 13,
    fontFamily: theme.font.bold,
    color: theme.blue,
  },
  progressBytesText: {
    fontSize: 12,
    fontFamily: theme.font.regular,
    color: theme.muted,
  },
  statusText: {
    fontSize: 12,
    fontFamily: theme.font.regular,
    color: theme.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: theme.blue,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  downloadButtonDisabled: {
    opacity: 0.8,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: theme.font.bold,
  },
  laterButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  laterButtonText: {
    color: theme.muted,
    fontSize: 14,
    fontFamily: theme.font.semibold,
  },
  errorContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  browserFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  browserFallbackText: {
    color: theme.blue,
    fontSize: 13,
    fontFamily: theme.font.semibold,
    textDecorationLine: 'underline',
  },
  warningText: {
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
}));
