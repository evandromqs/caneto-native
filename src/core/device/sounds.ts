import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export type SoundType = 'check' | 'uncheck' | 'add' | 'scan' | 'complete' | 'delete' | 'tap';

let soundEnabledGlobal = true;
let webViewPlayBridge: ((type: SoundType) => void) | null = null;

export function setSoundEnabled(enabled: boolean): void {
  soundEnabledGlobal = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabledGlobal;
}

const SOUND_SYNTH_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
(function(){
  var ctx = null;
  function getCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(function(){});
    return ctx;
  }
  function tone(c, freq, endFreq, start, dur, vol, wave) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = wave || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (endFreq && endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + dur);
  }
  window.canetoPlaySound = function(type) {
    try {
      var c = getCtx();
      if (!c) return;
      var now = c.currentTime;
      if (type === 'check') {
        tone(c, 587.33, 587.33, now, 0.12, 0.25, 'sine');
        tone(c, 880, 880, now + 0.06, 0.22, 0.30, 'sine');
      } else if (type === 'uncheck') {
        tone(c, 480, 320, now, 0.10, 0.20, 'sine');
      } else if (type === 'add') {
        tone(c, 650, 1150, now, 0.09, 0.26, 'sine');
      } else if (type === 'scan') {
        tone(c, 1200, 1200, now, 0.07, 0.22, 'triangle');
        tone(c, 1600, 1600, now + 0.07, 0.12, 0.25, 'triangle');
      } else if (type === 'complete') {
        tone(c, 523.25, 523.25, now, 0.12, 0.24, 'sine');
        tone(c, 659.25, 659.25, now + 0.10, 0.12, 0.24, 'sine');
        tone(c, 783.99, 783.99, now + 0.20, 0.14, 0.26, 'sine');
        tone(c, 1046.5, 1046.5, now + 0.30, 0.28, 0.30, 'sine');
      } else if (type === 'delete') {
        tone(c, 360, 190, now, 0.14, 0.22, 'sawtooth');
      } else {
        tone(c, 720, 540, now, 0.045, 0.16, 'sine');
      }
    } catch (e) {}
  };
})();
</script></body></html>`;

export async function playSound(type: SoundType = 'tap', enabled: boolean = soundEnabledGlobal): Promise<void> {
  if (!enabled) return;
  try {
    webViewPlayBridge?.(type);
  } catch {
    // ignore
  }
}

export function SoundEngine() {
  const ref = useRef<WebView<Record<string, unknown>> | null>(null);
  useEffect(() => {
    webViewPlayBridge = (type: SoundType) => {
      ref.current?.injectJavaScript(`window.canetoPlaySound && window.canetoPlaySound(${JSON.stringify(type)}); true;`);
    };
    return () => {
      webViewPlayBridge = null;
    };
  }, []);

  return React.createElement(
    View,
    { style: { width: 1, height: 1, opacity: 0, position: 'absolute', overflow: 'hidden' }, pointerEvents: 'none' },
    React.createElement(WebView, {
      ref,
      originWhitelist: ['*'],
      source: { html: SOUND_SYNTH_HTML },
      mediaPlaybackRequiresUserAction: false,
      allowsInlineMediaPlayback: true,
      javaScriptEnabled: true,
    })
  );
}
