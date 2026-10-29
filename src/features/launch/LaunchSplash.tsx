import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';

type LaunchSplashProps = {
  dark: boolean;
};

export function LaunchSplash({ dark }: LaunchSplashProps) {
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.82));
  const [copyOpacity] = useState(() => new Animated.Value(0));
  const [copyTranslateY] = useState(() => new Animated.Value(12));
  const [progress] = useState(() => new Animated.Value(0.12));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 13,
        stiffness: 145,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(copyOpacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(copyTranslateY, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(progress, {
        toValue: 1,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [copyOpacity, copyTranslateY, logoOpacity, logoScale, progress]);

  const backgroundColor = dark ? '#080D1A' : '#F7F9FF';
  const ink = dark ? '#F8FAFC' : '#0F172A';
  const muted = dark ? '#94A3B8' : '#64748B';

  const progressTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-116, 0],
  });

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[styles.glow, { backgroundColor: dark ? '#10245B' : '#DFE7FF' }]} />
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={[styles.logoCard, { backgroundColor: dark ? '#0F172A' : '#FFFFFF' }]}>
          <Image source={require('../../../assets/logo.webp')} style={styles.logo} resizeMode="contain" />
        </View>
      </Animated.View>
      <Animated.View style={[styles.copy, { opacity: copyOpacity, transform: [{ translateY: copyTranslateY }] }]}>
        <Text style={[styles.brand, { color: ink }]}>Caneto<Text style={styles.trademark}>™</Text></Text>
        <Text style={[styles.tagline, { color: muted }]}>A lista que te entende</Text>
      </Animated.View>
      <View style={[styles.progressTrack, { backgroundColor: dark ? '#1E293B' : '#DCE3F2' }]}>
        <Animated.View style={[styles.progressBar, { transform: [{ translateX: progressTranslateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.55 },
  logoWrap: { zIndex: 1 },
  logoCard: { width: 132, height: 132, borderRadius: 42, alignItems: 'center', justifyContent: 'center', shadowColor: '#0943F1', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 10 },
  logo: { width: 68, height: 112 },
  copy: { alignItems: 'center', marginTop: 24, zIndex: 1 },
  brand: { fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -1 },
  trademark: { color: '#0943F1', fontSize: 13, fontWeight: '700' },
  tagline: { marginTop: 3, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  progressTrack: { position: 'absolute', bottom: 62, width: 116, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBar: { width: 116, height: 4, borderRadius: 2, backgroundColor: '#0943F1' },
});
