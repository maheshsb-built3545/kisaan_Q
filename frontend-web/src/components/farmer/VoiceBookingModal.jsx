import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, X, CheckCircle2, AlertCircle,
  Loader2, Building2, Leaf, Clock, Banknote, Sparkles,
  Ticket, ArrowRight, RotateCcw, ShieldCheck, ChevronRight,
  Radio, Check, Play, Send, MessageSquare, Phone, HelpCircle,
  TrendingUp, TrendingDown, Scale, UserCheck, XCircle, ArrowUpRight
} from 'lucide-react';
import { voiceBookingApi } from '../../api/voiceBooking.api';

/**
 * ─── Free-Form Conversational Voice Assistant Modal (Groq Tool-Calling) ─────
 * Supports 7 core farmer actions:
 * 1. Book a slot (Mandi, crop, quantity, arrival date/time)
 * 2. Cancel a booking (Checks penalty and releases queue slot)
 * 3. Check live queue position & wait time
 * 4. Check today's crop MSP & mandi market rate
 * 5. Check token 5-stage status (Gate -> Quality -> Weighbridge -> Procurement -> Payout)
 * 6. Check payout & DBT payment status
 * 7. Help & Helpline info (Toll-Free 1800-123-54726, WhatsApp)
 */
export default function VoiceBookingModal({
  isOpen,
  onClose,
  onConfirmBooking,
  defaultMandi,
  farmerName = 'Mahesh Borde',
  farmerPhone = '9876543210',
  farmerCoords,
  pickupLocation,
  onRequestPickupLocation,
  hasActiveBooking,
  activeToken
}) {
  // Conversational State
  const [language, setLanguage] = useState('mr'); // 'mr' | 'hi' | 'en'
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [lastActionResult, setLastActionResult] = useState(null);
  const [lastActionTaken, setLastActionTaken] = useState('none');

  // Interaction State:
  // 'INITIALIZING' | 'ASSISTANT_SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED'
  const [convState, setConvState] = useState('INITIALIZING');
  const [audioError, setAudioError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualText, setManualText] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);

  // Result state
  const [completedResult, setCompletedResult] = useState(null);

  // Refs
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isComponentMountedRef = useRef(true);
  const hardSafetyTimeoutRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const lastSpokenTimeRef = useRef(0);
  const chatBottomRef = useRef(null);

  const LANGUAGES = [
    { code: 'mr', name: 'मराठी', label: 'Marathi', voiceCode: 'mr-IN' },
    { code: 'hi', name: 'हिन्दी', label: 'Hindi', voiceCode: 'hi-IN' },
    { code: 'en', name: 'English', label: 'English', voiceCode: 'en-IN' }
  ];

  // Quick Action Prompt Suggestions
  const ACTION_PROMPTS = [
    {
      id: 'book',
      mr: '🎙️ कोपरगावला २५ क्विंटल सोयाबीन स्लॉट बुक करा',
      hi: '🎙️ कोपरगांव में २५ क्विंटल सोयाबीन स्लॉट बुक करें',
      en: '🎙️ Book 25 Qtl Soybean slot at Kopargaon',
      action: 'book_slot'
    },
    {
      id: 'price',
      mr: '📊 आजचा सोयाबीन आणि कापूस हमीभाव किती आहे?',
      hi: '📊 आज का सोयाबीन और कपास का भाव क्या है?',
      en: '📊 Check today\'s Soybean & Cotton MSP',
      action: 'check_crop_price'
    },
    {
      id: 'queue',
      mr: '⏳ माझी रांगेतील जागा आणि वेळ तपासा',
      hi: '⏳ मेरी कतार की स्थिति और समय जांचें',
      en: '⏳ Check my live queue wait time',
      action: 'check_queue_position'
    },
    {
      id: 'status',
      mr: '🔍 माझे टोकन कोणत्या टप्प्यावर आहे?',
      hi: '🔍 मेरा टोकन किस चरण पर है?',
      en: '🔍 Check my token 5-stage progress',
      action: 'check_token_status'
    },
    {
      id: 'payout',
      mr: '💰 माझे डीबीटी पेमेंट जमा झाले आहे का?',
      hi: '💰 मेरा भुगतान / डीबीटी चेक करें',
      en: '💰 Check payout & DBT payment status',
      action: 'check_payout_status'
    },
    {
      id: 'cancel',
      mr: '❌ माझे बुकिंग रद्द करा',
      hi: '❌ मेरी बुकिंग रद्द करें',
      en: '❌ Cancel my booking slot',
      action: 'cancel_booking'
    },
    {
      id: 'help',
      mr: '📞 किसान हेल्पलाईन आणि व्हॉट्सअॅप नंबर',
      hi: '📞 हेल्पलाइन और व्हाट्सएप सहायता',
      en: '📞 Help, Helpline & WhatsApp Support',
      action: 'get_support_info'
    }
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, convState]);

  // ─── Browser Native Speech Synthesis (On-Device TTS) ───────────────────
  const speakText = useCallback((text, langCode = language, onComplete = () => {}) => {
    if (!text || typeof window === 'undefined') {
      onComplete();
      return;
    }

    setConvState('ASSISTANT_SPEAKING');

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    let completed = false;
    const handleSpeechEnd = () => {
      if (!completed) {
        completed = true;
        if (isComponentMountedRef.current) {
          onComplete();
        }
      }
    };

    if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      // Clean markdown bold/table characters for spoken utterance
      const cleanSpoken = text
        .replace(/\*\*/g, '')
        .replace(/\|/g, ' ')
        .replace(/#/g, '')
        .replace(/\[|\]/g, '')
        .replace(/---+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanSpoken);
      utterance.lang = langCode === 'mr' ? 'mr-IN' : langCode === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) =>
        v.lang === utterance.lang || v.lang.startsWith(langCode)
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = handleSpeechEnd;
      utterance.onerror = (e) => {
        console.warn('[VoiceBooking] Speech synthesis error:', e);
        handleSpeechEnd();
      };

      try {
        window.speechSynthesis.speak(utterance);
        const words = cleanSpoken.split(' ').length;
        const estimatedDurationMs = Math.max(2500, words * 400);
        setTimeout(handleSpeechEnd, estimatedDurationMs + 1000);
        return;
      } catch (e) {
        console.warn('[VoiceBooking] SpeechSynthesis speak exception:', e);
      }
    }

    handleSpeechEnd();
  }, [language]);

  // ─── Stop Recording Helper ───────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[VoiceBooking] MediaRecorder stop error:', e);
      }
    }
  }, []);

  // ─── Microphone Recording with VAD & Hard Safety Cap ─────────────────────
  const startRecording = useCallback(async () => {
    setAudioError(null);
    setErrorMessage('');
    audioChunksRef.current = [];

    stopRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioBlob.size > 0 && isComponentMountedRef.current) {
          await submitConversationalUtterance({ audioBlob, mimeType });
        }
      };

      recorder.start(250);
      setConvState('LISTENING');

      // Hard safety timeout: 12 seconds cap
      hardSafetyTimeoutRef.current = setTimeout(() => {
        console.log('[VoiceBooking] 12s safety timeout reached. Submitting audio...');
        stopRecording();
      }, 12000);

      // Voice Activity Detection (VAD)
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          hasSpokenRef.current = false;
          lastSpokenTimeRef.current = Date.now();

          vadIntervalRef.current = setInterval(() => {
            if (!isComponentMountedRef.current) return;
            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avgVolume = sum / dataArray.length;
            const now = Date.now();

            if (avgVolume > 14) {
              hasSpokenRef.current = true;
              lastSpokenTimeRef.current = now;
            } else if (hasSpokenRef.current) {
              const silenceDuration = now - lastSpokenTimeRef.current;
              if (silenceDuration > 1800) {
                console.log(`[VoiceBooking] Auto-stop: ${silenceDuration}ms silence detected.`);
                stopRecording();
              }
            }
          }, 100);
        }
      } catch (vadErr) {
        console.warn('[VoiceBooking] VAD initialization skipped:', vadErr);
      }
    } catch (err) {
      console.error('[VoiceBooking] Mic access error:', err);
      setAudioError('Microphone access required, or type / choose an option below.');
      setConvState('LISTENING');
    }
  }, [stopRecording]);

  // ─── Initialize Conversational Session ───────────────────────────────────
  const initSession = useCallback(async (langToUse = language) => {
    setConvState('INITIALIZING');
    setErrorMessage('');
    setTranscript('');
    setMessages([]);
    setCompletedResult(null);
    setLastActionResult(null);
    setLastActionTaken('none');

    try {
      const data = await voiceBookingApi.startSession({
        language: langToUse,
        farmerName,
        phone: farmerPhone
      });

      if (data.success) {
        setSessionId(data.sessionId);
        const greeting = data.initialGreeting || data.questionText || 'Hello! How can I help you today?';

        setMessages([
          { role: 'assistant', text: greeting, timestamp: new Date() }
        ]);

        // Auto-play initial assistant greeting
        speakText(greeting, langToUse, () => {
          setConvState('LISTENING');
          startRecording().catch(() => {});
        });
      } else {
        setErrorMessage(data.message || 'Failed to start voice assistant');
        setConvState('LISTENING');
      }
    } catch (err) {
      console.error('[VoiceBooking] Init session error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Could not connect to voice service');
      setConvState('LISTENING');
    }
  }, [farmerName, farmerPhone, language, speakText, startRecording]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    if (isOpen) {
      initSession(language);
    } else {
      stopRecording();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    return () => {
      isComponentMountedRef.current = false;
      stopRecording();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [isOpen]);

  // Handle language switch
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    initSession(newLang);
  };

  // ─── Submit Conversational Utterance to Groq Tool-Calling Engine ──────────
  const submitConversationalUtterance = async ({ audioBlob, mimeType, textAnswer }) => {
    if (!sessionId) return;
    setConvState('PROCESSING');
    setErrorMessage('');

    try {
      if (textAnswer) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: textAnswer, timestamp: new Date() }
        ]);
      }

      const res = await voiceBookingApi.sendAnswer(sessionId, {
        audioBlob,
        mimeType,
        textAnswer,
        language
      });

      if (res.success) {
        if (res.transcribedText && !textAnswer) {
          setTranscript(res.transcribedText);
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: res.transcribedText, timestamp: new Date() }
          ]);
        }

        const reply = res.replyText || res.question || 'Processed.';
        const action = res.actionTaken || 'none';
        const actionData = res.actionResult || null;

        setLastActionTaken(action);
        setLastActionResult(actionData);

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: reply,
            actionTaken: action,
            actionResult: actionData,
            timestamp: new Date()
          }
        ]);

        if (action === 'book_slot' && (res.token || actionData?.token)) {
          setCompletedResult(res);
        }

        // Auto-play spoken response
        speakText(reply, language, () => {
          setConvState('LISTENING');
          startRecording().catch(() => {});
        });
      } else {
        setErrorMessage(res.message || 'Could not understand request.');
        setConvState('LISTENING');
      }
    } catch (err) {
      console.error('[VoiceBooking] Conversational submit error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Error communicating with Voice AI');
      setConvState('LISTENING');
    }
  };

  const handleManualTextSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const text = manualText.trim();
    setManualText('');
    setShowTypeInput(false);
    submitConversationalUtterance({ textAnswer: text });
  };

  const handleFinishBooking = () => {
    if (onConfirmBooking && completedResult) {
      onConfirmBooking(completedResult.token || completedResult.booking, completedResult.actionResult);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-scaleIn relative flex flex-col max-h-[92vh]">
        
        {/* Top Gradient Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              convState === 'ASSISTANT_SPEAKING'
                ? 'bg-teal-500/20 border border-teal-400 text-teal-400'
                : convState === 'LISTENING'
                ? 'bg-rose-500/20 border border-rose-400 text-rose-400'
                : 'bg-emerald-500/20 border border-emerald-400 text-emerald-400'
            }`}>
              {convState === 'ASSISTANT_SPEAKING' ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : convState === 'LISTENING' ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">
                  {language === 'mr' ? 'किसान व्हॉइस सहाय्यक' : language === 'hi' ? 'किसान वॉयस सहायक' : 'KisanQ Voice Assistant'}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <Sparkles className="w-2.5 h-2.5" /> Groq AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Free-Form Natural Conversation · 7 Actions</p>
            </div>
          </div>

          {/* Language Switcher & Close */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleLanguageChange(l.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    language === l.code
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Conversational Thread */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {convState === 'INITIALIZING' ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Connecting with KisanQ Voice Assistant…</p>
            </div>
          ) : (
            <>
              {/* Message List */}
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fadeIn`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-xs shadow-md'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-xs shadow-lg'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold opacity-75">
                        {msg.role === 'user' ? (
                          <span>👨‍🌾 {farmerName}</span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> KisanQ Assistant
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                    </div>

                    {/* Rich Action Result Cards embedded in Assistant Message */}
                    {msg.actionResult && (
                      <div className="mt-2 w-full max-w-[90%]">
                        {/* 1. BOOKING CONFIRMATION CARD */}
                        {msg.actionTaken === 'book_slot' && msg.actionResult.tokenNumber && (
                          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 text-xs space-y-3 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                              <span className="text-[10px] uppercase font-bold text-emerald-400">✅ Booking Confirmed</span>
                              <span className="font-mono font-black text-emerald-300 text-sm">{msg.actionResult.tokenNumber}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-slate-400">Mandi:</span> <strong className="text-white">{msg.actionResult.mandiName}</strong></div>
                              <div><span className="text-slate-400">Crop & Qty:</span> <strong className="text-white">{msg.actionResult.crop} · {msg.actionResult.quantity} Qtl</strong></div>
                              <div><span className="text-slate-400">Slot Date:</span> <strong className="text-white">{msg.actionResult.slotDate}</strong></div>
                              <div><span className="text-slate-400">Slot Time:</span> <strong className="text-white">{msg.actionResult.slotTime}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* 2. CROP PRICE / MSP CARD */}
                        {msg.actionTaken === 'check_crop_price' && (
                          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs space-y-2 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5" /> Mandi MSP & Market Rates
                              </span>
                              <span className="font-bold text-slate-300">{msg.actionResult.mandiName}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center py-1">
                              <div className="bg-slate-900/60 p-2 rounded-xl">
                                <span className="text-[10px] text-slate-400 block">MSP (हमीभाव)</span>
                                <strong className="text-emerald-400 text-xs">₹{msg.actionResult.statutoryMSP}</strong>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-xl">
                                <span className="text-[10px] text-slate-400 block">Today (आज)</span>
                                <strong className="text-amber-300 text-xs">₹{msg.actionResult.marketPriceToday}</strong>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-xl">
                                <span className="text-[10px] text-slate-400 block">Trend (प्रवाह)</span>
                                <strong className="text-teal-400 text-xs">{msg.actionResult.priceTrend === 'UP' ? '📈 Rising' : '📉 Stable'}</strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. QUEUE POSITION CARD */}
                        {msg.actionTaken === 'check_queue_position' && (
                          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs space-y-2 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Live Queue Status
                              </span>
                              <span className="font-mono text-emerald-400 font-bold">{msg.actionResult.tokenNumber}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                              <div><span className="text-slate-400">Position in Queue:</span> <strong className="text-amber-300 font-black">#{msg.actionResult.queuePosition}</strong></div>
                              <div><span className="text-slate-400">Est. Wait:</span> <strong className="text-white">{msg.actionResult.estimatedWaitTime}</strong></div>
                              <div className="col-span-2"><span className="text-slate-400">Current Stage:</span> <strong className="text-emerald-300">{msg.actionResult.currentStage}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* 4. TOKEN 5-STAGE PROGRESS CARD */}
                        {msg.actionTaken === 'check_token_status' && (
                          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> 5-Stage Checkpoint Tracker
                              </span>
                              <span className="font-mono text-xs text-slate-300">{msg.actionResult.tokenNumber}</span>
                            </div>
                            <div className="space-y-1.5">
                              {msg.actionResult.stages?.map((stg, sIdx) => (
                                <div key={sIdx} className="flex items-center justify-between text-[11px] bg-slate-900/50 px-2.5 py-1.5 rounded-lg">
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold flex items-center justify-center text-emerald-400">{stg.index}</span>
                                    {stg.title}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    stg.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : stg.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {stg.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. PAYOUT / DBT STATUS CARD */}
                        {msg.actionTaken === 'check_payout_status' && (
                          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs space-y-2 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                                <Banknote className="w-3.5 h-3.5" /> DBT Payout Summary
                              </span>
                              <span className="font-mono text-xs text-slate-300">{msg.actionResult.tokenNumber}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-slate-400">Net Quantity:</span> <strong className="text-white">{msg.actionResult.netWeightQuintals} Qtl</strong></div>
                              <div><span className="text-slate-400">Total Payout:</span> <strong className="text-emerald-400 font-bold text-xs">{msg.actionResult.totalPayoutAmount}</strong></div>
                              <div className="col-span-2 text-[10px] text-slate-400"><span className="text-slate-400">Bank Channel:</span> <strong className="text-slate-300">{msg.actionResult.bankAccount}</strong></div>
                            </div>
                          </div>
                        )}

                        {/* 6. HELP & SUPPORT INFO CARD */}
                        {msg.actionTaken === 'get_support_info' && (
                          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs space-y-3 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                              <span className="text-[10px] uppercase font-bold text-teal-400 flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5" /> KisanQ Help & Support
                              </span>
                              <span className="text-[10px] text-emerald-400 font-bold">24x7 Available</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <a
                                href={`tel:${msg.actionResult.helplineTollFree}`}
                                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" /> Toll-Free Call
                              </a>
                              <a
                                href={msg.actionResult.whatsappChatUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Chat
                              </a>
                            </div>
                          </div>
                        )}

                        {/* 7. CANCELLATION CARD */}
                        {msg.actionTaken === 'cancel_booking' && (
                          <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-4 text-xs space-y-2 shadow-lg">
                            <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                              <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Booking Cancelled
                              </span>
                              <span className="font-mono text-xs text-rose-300">{msg.actionResult.tokenNumber}</span>
                            </div>
                            <p className="text-[11px] text-slate-300">{msg.actionResult.message || 'Slot released.'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Central Mic & Turn Visualizer */}
              <div className="text-center space-y-3 pt-2">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  {convState === 'ASSISTANT_SPEAKING' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-teal-400/50 animate-ping opacity-75" />
                      <div className="absolute -inset-3 rounded-full border border-teal-400/30 animate-pulse" />
                    </>
                  )}
                  {convState === 'LISTENING' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-75" />
                      <div className="absolute -inset-3 rounded-full border border-rose-400/40 animate-pulse" />
                    </>
                  )}
                  {convState === 'PROCESSING' && (
                    <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (convState === 'LISTENING') {
                        stopRecording();
                      } else if (convState === 'ASSISTANT_SPEAKING') {
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        setConvState('LISTENING');
                        startRecording().catch(() => {});
                      } else {
                        startRecording().catch(() => {});
                      }
                    }}
                    disabled={convState === 'PROCESSING'}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
                      convState === 'ASSISTANT_SPEAKING'
                        ? 'bg-gradient-to-tr from-teal-600 to-cyan-500 text-slate-950 shadow-teal-500/30'
                        : convState === 'LISTENING'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 scale-105'
                        : convState === 'PROCESSING'
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-slate-950 shadow-emerald-500/30'
                    }`}
                  >
                    {convState === 'PROCESSING' ? (
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    ) : convState === 'ASSISTANT_SPEAKING' ? (
                      <Volume2 className="w-8 h-8 animate-pulse text-slate-950" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                {/* State Label & Guidance */}
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold tracking-wide">
                    {convState === 'ASSISTANT_SPEAKING' ? (
                      <span className="text-teal-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                        {language === 'mr' ? 'AI सहाय्यक बोलत आहे…' : language === 'hi' ? 'AI सहायक बोल रहा है…' : 'AI Assistant is speaking…'}
                      </span>
                    ) : convState === 'LISTENING' ? (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <Radio className="w-3 h-3 text-rose-400 animate-ping" />
                        {language === 'mr' ? 'आता बोला — आम्ही ऐकत आहोत' : language === 'hi' ? 'अब बोलिए — हम सुन रहे हैं' : 'Your turn — speak naturally now'}
                      </span>
                    ) : convState === 'PROCESSING' ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {language === 'mr' ? 'Groq AI तपासत आहे…' : 'Processing with Groq AI…'}
                      </span>
                    ) : null}
                  </div>

                  {convState === 'LISTENING' && (
                    <div className="flex items-center justify-center gap-1.5 h-5 py-0.5">
                      {[30, 70, 100, 50, 90, 65, 40].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-gradient-to-t from-rose-500 to-amber-300 rounded-full animate-pulse"
                          style={{
                            height: `${h}%`,
                            animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                            animationDelay: `${i * 0.08}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {audioError && <p className="text-xs text-amber-400 font-medium">{audioError}</p>}
                {errorMessage && <p className="text-xs text-rose-400 font-medium">{errorMessage}</p>}
              </div>

              {/* Quick Action Suggestion Chips */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {language === 'mr' ? 'जलद पर्याय (टॅप करू शकता):' : language === 'hi' ? 'त्वरित विकल्प:' : 'Quick Actions (1-Tap):'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTypeInput(!showTypeInput)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>{showTypeInput ? 'Hide Type Box' : 'Type instead'}</span>
                  </button>
                </div>

                {showTypeInput ? (
                  <form onSubmit={handleManualTextSubmit} className="flex gap-2 animate-fadeIn">
                    <input
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder={language === 'mr' ? 'उदा. कोपरगावला २५ क्विंटल सोयाबीन बुक करा, किंवा भाव सांगा…' : 'e.g. Book 25 Qtl Soybean slot, or check prices…'}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ACTION_PROMPTS.map((opt) => {
                      const text = opt[language] || opt.en;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={convState === 'PROCESSING'}
                          onClick={() => submitConversationalUtterance({ textAnswer: text })}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <span>{text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => initSession(language)}
            className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
            title="Restart conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>
          <span className="text-[10px] text-slate-500 font-medium">
            KisanQ AI Assistant · Powered by Groq Tool-Calling
          </span>
        </div>

      </div>
    </div>
  );
}
