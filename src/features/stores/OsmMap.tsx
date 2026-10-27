import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coordinates } from './model';

export type MapMarker = { id: string; name: string; lat: number; lng: number };

const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;height:100%;width:100%;background:#e8eef5} .leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl: true }).setView([-14.2, -51.9], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  window.canetoRender = function (payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    layer.clearLayers();
    if (data.user) L.circleMarker([data.user.lat, data.user.lng], { radius: 8, color: '#0943F1', fillColor: '#386BF6', fillOpacity: 0.95 }).addTo(layer);
    (data.markers || []).forEach(function (marker) {
      L.marker([marker.lat, marker.lng]).addTo(layer).bindPopup(marker.name).on('click', function () {
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
  </View>;
}

const styles = StyleSheet.create({
  frame: { height: 220, marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8EEF5' },
  map: { flex: 1, backgroundColor: 'transparent' },
});
