import { useEffect, useState } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, Text, View } from 'react-native';

type LaunchSplashProps = {
  dark: boolean;
};

export function LaunchSplash({ dark }: LaunchSplashProps) {
  const [waveScale] = useState(() => new Animated.Value(0));
  const [copyOpacity] = useState(() => new Animated.Value(0));
  const [copyScale] = useState(() => new Animated.Value(0.86));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(waveScale, {
        toValue: 48,
        duration: 1350,
        delay: 120,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(copyOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(copyScale, {
            toValue: 1,
            damping: 14,
            stiffness: 140,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [copyOpacity, copyScale, waveScale]);

  const targetBg = dark ? '#080D1A' : '#F7F9FF';
  const ink = dark ? '#F8FAFC' : '#0F172A';
  const muted = dark ? '#94A3B8' : '#64748B';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.waveDot,
          {
            backgroundColor: targetBg,
            transform: [{ scale: waveScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.copy,
          {
            opacity: copyOpacity,
            transform: [{ scale: copyScale }],
          },
        ]}
      >
        <Text style={[styles.brand, { color: ink }]}>
          Caneto<Text style={styles.trademark}>™</Text>
        </Text>
        <Text style={[styles.tagline, { color: muted }]}>A lista que te entende</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0943F1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  waveDot: { position: 'absolute', width: 28, height: 28, borderRadius: 14 },
  copy: { alignItems: 'center', zIndex: 1 },
  brand: { fontSize: 36, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  trademark: { color: '#0943F1', fontSize: 14, fontWeight: '700' },
  tagline: { marginTop: 4, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
});
