import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import type { Coordinates } from './model';

export type MapMarker = { id: string; name: string; lat: number; lng: number };

const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;height:100%;width:100%;background:#e8eef5} .leaflet-control-attribution{font-size:10px}.caneto-pin{width:25px;height:25px;border:2px solid #fff;border-radius:8px;background:#0943F1;box-shadow:0 2px 7px #0943F155;display:flex;align-items:center;justify-content:center;color:#fff}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl: true }).setView([-14.2, -51.9], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const storeIcon = L.divIcon({ className: '', html: '<div class="caneto-pin"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l2-5h14l2 5v2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-2-2Z"/><path d="M5 13v7h14v-7M9 20v-6h6v6"/></svg></div>', iconSize: [28, 28], iconAnchor: [14, 14] });
  window.canetoCenterUser = function () { if (window.canetoUser) map.setView([window.canetoUser.lat, window.canetoUser.lng], 16); };
  window.canetoRender = function (payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    layer.clearLayers();
    window.canetoUser = data.user;
    if (data.user) L.circleMarker([data.user.lat, data.user.lng], { radius: 8, color: '#0943F1', fillColor: '#386BF6', fillOpacity: 0.95 }).addTo(layer);
    (data.markers || []).forEach(function (marker) {
      L.marker([marker.lat, marker.lng], { icon: storeIcon }).addTo(layer).on('click', function () {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ id: marker.id }));
      });
    });
    const center = data.user || (data.markers && data.markers[0]);
    if (center) map.setView([center.lat, center.lng], data.user ? 15 : 13);
  };
</script></body></html>`;

export function OsmMap({ user, markers, onSelect }: { user?: Coordinates | null; markers: MapMarker[]; onSelect?: (id: string) => void }) {
  const view = useRef<WebView>(null);
  const ready = useRef(false);
  const payload = useMemo(() => JSON.stringify({
    user: user ? { lat: user.lat, lng: user.lng } : null,
    markers: markers.filter(marker => Number.isFinite(marker.lat) && Number.isFinite(marker.lng)).slice(0, 80),
  }), [user, markers]);

  useEffect(() => {
    if (ready.current) view.current?.injectJavaScript(`window.canetoRender(${JSON.stringify(payload)}); true;`);
  }, [payload]);

  return <View style={styles.frame}>
    <WebView
      ref={view}
      originWhitelist={['*']}
      source={{ html }}
      style={styles.map}
      onLoadEnd={() => { ready.current = true; view.current?.injectJavaScript(`window.canetoRender(${JSON.stringify(payload)}); true;`); }}
      onMessage={event => {
        try {
          const body = JSON.parse(event.nativeEvent.data) as { id?: string };
          if (body.id) onSelect?.(body.id);
        } catch { /* ignore malformed map messages */ }
      }}
    />
    {!!user && <Pressable style={styles.locate} onPress={() => view.current?.injectJavaScript('window.canetoCenterUser(); true;')} accessibilityRole="button" accessibilityLabel="Centralizar mapa na minha localização"><Ionicons name="locate" size={20} color="#0943F1" /></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { height: 240, marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8EEF5' },
  map: { flex: 1, backgroundColor: 'transparent' },
  locate: { position: 'absolute', right: 12, bottom: 18, width: 42, height: 42, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
