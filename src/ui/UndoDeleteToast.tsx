import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem } from '../core/models/caneto';
import { theme } from './theme';

export interface UndoDeleteToastProps {
  item: ShoppingItem | null;
  onUndo: (item: ShoppingItem) => void;
  onDismiss: (item: ShoppingItem) => void;
  durationMs?: number;
}

export function UndoDeleteToast({ item, onUndo, onDismiss, durationMs = 5000 }: UndoDeleteToastProps) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(-20));
  const [progressAnim] = useState(() => new Animated.Value(100));
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!item) return;

    progressAnim.setValue(100);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 0, duration: durationMs, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) {
        dismissRef.current(item);
      }
    });

    return () => {
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();
      progressAnim.stopAnimation();
    };
  }, [item, durationMs, fadeAnim, slideAnim, progressAnim]);

  if (!item) return null;

  const handleUndo = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => onUndo(item));
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => onDismiss(item));
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={`Item ${item.name} excluído. Disponível na lixeira por até 6 horas.`}
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Ionicons name="trash" size={17} color="#F43F5E" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              Item <Text style={styles.itemName}>&ldquo;{item.name}&rdquo;</Text> excluído
            </Text>
            <Text style={styles.subtitle}>Disponível na lixeira por até 6h</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Desfazer exclusão"
            onPress={handleUndo}
            style={({ pressed }) => [styles.undoButton, pressed && styles.undoButtonPressed]}
          >
            <Ionicons name="arrow-undo" size={14} color="white" />
            <Text style={styles.undoText}>Desfazer</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dispensar aviso"
            onPress={handleDismiss}
            style={styles.closeButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color="#94A3B8" />
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 10 : 16,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 10,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: theme.font.bold,
  },
  itemName: {
    color: '#FDA4AF',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: theme.font.regular,
    marginTop: 1,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.blue,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  undoButtonPressed: {
    backgroundColor: '#0732B8',
  },
  undoText: {
    color: 'white',
    fontFamily: theme.font.bold,
    fontSize: 13,
  },
  closeButton: {
    padding: 4,
    marginLeft: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.blue,
  },
});
