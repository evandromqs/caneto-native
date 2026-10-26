import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../ui/theme';
import type { AppReleaseInfo } from './updaterService';
import { downloadAndInstallApk } from './updaterService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppReleaseInfo | null;
  onClose: () => void;
}

export function UpdateModal({ visible, updateInfo, onClose }: UpdateModalProps) {
  if (!visible || !updateInfo) return null;

  const handleDownload = async () => {
    if (updateInfo.apkUrl) {
      await downloadAndInstallApk(updateInfo.apkUrl);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
            Uma nova versão do Caneto está disponível para o seu aparelho.
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

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={styles.downloadButton}
              onPress={handleDownload}
              accessibilityRole="button"
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>
                Baixar e Instalar com 1 Clique
              </Text>
            </Pressable>

            <Pressable
              style={styles.laterButton}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.laterButtonText}>Lembrar mais tarde</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
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
    marginBottom: 16,
    lineHeight: 20,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  versionBadge: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    maxHeight: 90,
  },
  notesText: {
    fontSize: 13,
    fontFamily: theme.font.regular,
    color: theme.ink,
    lineHeight: 18,
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
});
