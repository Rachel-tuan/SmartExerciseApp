import { useEffect, useRef, useState } from 'react';

export function useVoiceAssist(defaultOptions = {}) {
  const optionsRef = useRef({
    lang: 'zh-CN',
    rate: 0.9,
    pitch: 1,
    volume: 1,
    ...defaultOptions,
  });
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = (text, opts = {}) => {
    if (!supported || !text) return;
    const merged = { ...optionsRef.current, ...opts };
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = merged.lang;
    utterance.rate = merged.rate;
    utterance.pitch = merged.pitch;
    utterance.volume = merged.volume;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  useEffect(() => () => cancel(), []);

  return { speak, cancel, speaking, supported, options: optionsRef.current };
}