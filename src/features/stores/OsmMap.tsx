import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, isDarkTheme, theme } from '../../ui/theme';
import type { Coordinates } from './model';

export type MapMarker = { id: string; name: string; lat: number; lng: number };

const buildMapHtml = (initialDark: boolean) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{margin:0;height:100%;width:100%;background:${initialDark ? '#0F172A' : '#E8EEF5'}}
  body.dark,body.dark #map{background:#0F172A}
  body.dark .leaflet-tile-pane{filter:invert(92%) hue-rotate(180deg) brightness(95%) contrast(92%)}
  body.dark .leaflet-control-zoom a{background:#0F172A;color:#F8FAFC;border-color:#1E293B}
  body.dark .leaflet-control-attribution{background:rgba(15,23,42,0.82);color:#94A3B8}
  body.dark .leaflet-control-attribution a{color:#60A5FA}
  .leaflet-control-attribution{font-size:9px}
  .caneto-pin{width:26px;height:26px;border:2px solid #fff;border-radius:8px;background:#0943F1;box-shadow:0 2px 8px rgba(9,67,241,0.45);display:flex;align-items:center;justify-content:center;color:#fff}
</style>
</head><body class="${initialDark ? 'dark' : ''}"><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl: true }).setView([-14.2, -51.9], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);

  window.canetoSetTheme = function (dark) {
    document.body.classList.toggle('dark', !!dark);
  };

  const layer = L.layerGroup().addTo(map);
  const storeIcon = L.divIcon({ className: '', html: '<div class="caneto-pin"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l2-5h14l2 5v2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-2-2Z"/><path d="M5 13v7h14v-7M9 20v-6h6v6"/></svg></div>', iconSize: [28, 28], iconAnchor: [14, 14] });
  window.canetoCenterUser = function () { if (window.canetoUser) map.setView([window.canetoUser.lat, window.canetoUser.lng], 16); };
  window.canetoRender = function (payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (typeof data.dark === 'boolean') window.canetoSetTheme(data.dark);
    layer.clearLayers();
    window.canetoUser = data.user;
    if (data.user) L.circleMarker([data.user.lat, data.user.lng], { radius: 8, color: '#FFFFFF', weight: 2, fillColor: '#386BF6', fillOpacity: 1 }).addTo(layer);
    (data.markers || []).forEach(function (marker) {
      L.marker([marker.lat, marker.lng], { icon: storeIcon }).addTo(layer).on('click', function () {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ id: marker.id }));
      });
    });
    const center = data.user || (data.markers && data.markers[0]);
    if (center && !window.__canetoInitialCentered) {
      window.__canetoInitialCentered = true;
      map.setView([center.lat, center.lng], data.user ? 15 : 13);
    }
  };
</script></body></html>`;

export function OsmMap({ user, markers, onSelect }: { user?: Coordinates | null; markers: MapMarker[]; onSelect?: (id: string) => void }) {
  const view = useRef<WebView<Record<string, unknown>> | null>(null);
  const ready = useRef(false);
  const dark = isDarkTheme();
  const initialHtml = useMemo(() => buildMapHtml(isDarkTheme()), []);
  const payload = useMemo(() => JSON.stringify({
    dark,
    user: user ? { lat: user.lat, lng: user.lng } : null,
    markers: markers.filter(marker => Number.isFinite(marker.lat) && Number.isFinite(marker.lng)).slice(0, 80),
  }), [dark, user, markers]);

  useEffect(() => {
    if (ready.current) view.current?.injectJavaScript(`window.canetoRender(${JSON.stringify(payload)}); true;`);
  }, [payload]);

  return <View style={styles.frame}>
    <WebView
      ref={view}
      originWhitelist={['*']}
      source={{ html: initialHtml }}
      style={styles.map}
      onLoadEnd={() => { ready.current = true; view.current?.injectJavaScript(`window.canetoRender(${JSON.stringify(payload)}); true;`); }}
      onMessage={(event: WebViewMessageEvent): void => {
        try {
          const body = JSON.parse(event.nativeEvent.data) as { id?: string };
          if (body.id) onSelect?.(body.id);
        } catch { /* ignore malformed map messages */ }
      }}
    />
    {!!user && <Pressable style={styles.locate} onPress={() => view.current?.injectJavaScript('window.canetoCenterUser(); true;')} accessibilityRole="button" accessibilityLabel="Centralizar mapa na minha localização"><Ionicons name="locate" size={20} color={theme.blueLight} /></Pressable>}
  </View>;
}

const styles = createThemedStyles(theme => StyleSheet.create({
  frame: { height: 196, marginHorizontal: 16, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', backgroundColor: theme.surface },
  map: { flex: 1, backgroundColor: 'transparent' },
  locate: { position: 'absolute', right: 12, bottom: 16, width: 40, height: 40, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 4 },
}));
