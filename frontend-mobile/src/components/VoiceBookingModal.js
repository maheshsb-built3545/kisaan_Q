import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  Alert,
  Linking
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import voiceBookingApi from '../api/voiceBooking.api';
import OfflineBanner from './OfflineBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'mr', name: 'मराठी', label: 'Marathi' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi' },
  { code: 'en', name: 'English', label: 'English' }
];

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
    mr: '📊 आजचा सोयाबीन व कापूस हमीभाव किती आहे?',
    hi: '📊 आज का सोयाबीन व कपास का भाव क्या है?',
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

export default function VoiceBookingModal({
  visible,
  onClose,
  onBookingConfirmed,
  farmerName = 'Mahesh Borde',
  farmerPhone = '9876543210'
}) {
  const { t, i18n } = useTranslation();
  const currentAppLang = (i18n.language && ['mr', 'hi', 'en'].includes(i18n.language)) ? i18n.language : 'mr';

  // State
  const [language, setLanguage] = useState(currentAppLang);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [lastActionResult, setLastActionResult] = useState(null);
  const [lastActionTaken, setLastActionTaken] = useState('none');

  // Interaction State:
  // 'INITIALIZING' | 'ASSISTANT_SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED'
  const [convState, setConvState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualText, setManualText] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [permissionExplaining, setPermissionExplaining] = useState(false);

  // Completed booking data
  const [completedResult, setCompletedResult] = useState(null);

  // Audio & Recording Refs
  const recordingRef = useRef(null);
  const isMountedRef = useRef(true);
  const hardSafetyTimeoutRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const lastSpokenTimeRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef(null);

  // Pulse animation for mic
  useEffect(() => {
    let animation;
    if (convState === 'LISTENING') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true
          })
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1.0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [convState]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupAudio();
    };
  }, []);

  // Sync language with modal prop or app
  useEffect(() => {
    if (currentAppLang && currentAppLang !== language) {
      setLanguage(currentAppLang);
    }
  }, [currentAppLang]);

  // Reset & Start Session when modal opens
  useEffect(() => {
    if (visible) {
      resetSession();
      initAudioMode();
    } else {
      cleanupAudio();
    }
  }, [visible]);

  const initAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      const perm = await Audio.getPermissionsAsync();
      setHasPermission(perm.granted);
    } catch (err) {
      console.warn('[VoiceBooking] Audio mode init warning:', err.message);
    }
  };

  const cleanupAudio = async () => {
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }

    try {
      Speech.stop();
    } catch (e) {}

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
  };

  const resetSession = async () => {
    await cleanupAudio();
    setSessionId(null);
    setMessages([]);
    setTranscript('');
    setErrorMessage('');
    setManualText('');
    setShowTypeInput(false);
    setIsOffline(false);
    setCompletedResult(null);
    setLastActionResult(null);
    setLastActionTaken('none');
    startNewSession(language);
  };

  // ─── Start Session ─────────────────────────────────────────────────────────
  const startNewSession = async (lang) => {
    setConvState('INITIALIZING');
    setErrorMessage('');
    setIsOffline(false);

    try {
      const data = await voiceBookingApi.startSession({
        language: lang,
        farmerName,
        phone: farmerPhone
      });

      if (!isMountedRef.current) return;

      if (data && data.success) {
        setSessionId(data.sessionId);
        const greeting = data.initialGreeting || data.question || 'Hello! How can I help you today?';

        setMessages([
          { role: 'assistant', text: greeting, timestamp: new Date() }
        ]);

        // Auto-play the assistant greeting
        speakAssistantText(greeting, lang);
      } else {
        setErrorMessage(data?.message || 'Failed to initialize voice assistant');
        setConvState('INITIALIZING');
      }
    } catch (err) {
      console.warn('[VoiceBooking] Start session error:', err);
      if (!isMountedRef.current) return;
      setIsOffline(true);
      setErrorMessage('Network error: Unable to connect to Voice Assistant');
      setConvState('INITIALIZING');
    }
  };

  // ─── Playback Audio with expo-speech (On-Device TTS) ────────────────────────
  const speakAssistantText = async (textToSpeak, lang = language) => {
    await cleanupAudio();
    if (!isMountedRef.current) return;

    if (!textToSpeak) {
      handleAudioFinished();
      return;
    }

    setConvState('ASSISTANT_SPEAKING');

    const langMap = {
      mr: 'mr-IN',
      hi: 'hi-IN',
      en: 'en-IN'
    };
    const voiceLang = langMap[lang] || 'en-IN';

    // Strip markdown formatting for speech
    const cleanSpoken = textToSpeak
      .replace(/\*\*/g, '')
      .replace(/\|/g, ' ')
      .replace(/#/g, '')
      .replace(/\[|\]/g, '')
      .replace(/---+/g, ' ')
      .trim();

    try {
      Speech.stop();
      Speech.speak(cleanSpoken, {
        language: voiceLang,
        rate: 0.95,
        pitch: 1.0,
        onDone: () => {
          if (isMountedRef.current) {
            handleAudioFinished();
          }
        },
        onError: (err) => {
          console.warn('[VoiceBooking] Speech synthesis error:', err);
          if (isMountedRef.current) {
            handleAudioFinished();
          }
        },
        onStopped: () => {
          // Playback stopped
        }
      });
    } catch (err) {
      console.warn('[VoiceBooking] Speech synthesis exception:', err);
      if (isMountedRef.current) {
        handleAudioFinished();
      }
    }
  };

  const handleAudioFinished = async () => {
    try {
      const perm = await Audio.getPermissionsAsync();
      if (!isMountedRef.current) return;
      setHasPermission(perm.granted);
      setCanAskAgain(perm.canAskAgain !== false);

      if (!perm.granted) {
        setPermissionExplaining(true);
        setConvState('INITIALIZING');
        if (perm.canAskAgain === false) {
          setShowTypeInput(true);
        }
      } else {
        startRecording();
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      setPermissionExplaining(true);
      setShowTypeInput(true);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.warn('[VoiceBooking] Unable to open app settings:', err.message);
    }
  };

  // ─── Request Microphone Permission ─────────────────────────────────────────
  const requestMicPermission = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      setHasPermission(perm.granted);
      setCanAskAgain(perm.canAskAgain !== false);

      if (perm.granted) {
        setPermissionExplaining(false);
        startRecording();
      } else {
        setPermissionExplaining(true);
        if (perm.canAskAgain === false) {
          setShowTypeInput(true);
        } else {
          Alert.alert(
            language === 'mr' ? 'मायक्रोफोन परवानगी आवश्यक' : language === 'hi' ? 'माइक्रोफ़ोन अनुमति आवश्यक' : 'Microphone Permission Required',
            language === 'mr' ? 'व्हॉईस सहाय्यकासाठी मायक्रोफोन परवानगी आवश्यक आहे. कृपया परवानगी द्या किंवा खालील पर्यायातून टाईप करा.' : 'Please enable microphone access to use voice booking, or type instead.'
          );
        }
      }
    } catch (e) {
      setPermissionExplaining(true);
      setShowTypeInput(true);
    }
  };

  // ─── Start Recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    await cleanupAudio();
    if (!isMountedRef.current) return;

    try {
      setConvState('LISTENING');
      setErrorMessage('');
      hasSpokenRef.current = false;
      lastSpokenTimeRef.current = Date.now();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {}
      });

      // VAD metering
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;

        if (status.metering !== undefined && status.metering > -35) {
          hasSpokenRef.current = true;
          lastSpokenTimeRef.current = Date.now();
        }

        // Auto-stop after 2 seconds of silence
        if (hasSpokenRef.current && (Date.now() - lastSpokenTimeRef.current > 2000)) {
          if (isMountedRef.current && convState === 'LISTENING') {
            stopRecordingAndSubmit();
          }
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // Hard safety timeout: 12 seconds cap
      hardSafetyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && recordingRef.current) {
          console.log('[VoiceBooking] Hard safety timeout (12s) reached. Stopping recording.');
          stopRecordingAndSubmit();
        }
      }, 12000);
    } catch (err) {
      console.warn('[VoiceBooking] Start recording error:', err);
      if (isMountedRef.current) {
        setErrorMessage('Could not access microphone. You can type instead.');
        setShowTypeInput(true);
        setConvState('INITIALIZING');
      }
    }
  };

  // ─── Stop Recording & Submit ───────────────────────────────────────────────
  const stopRecordingAndSubmit = async () => {
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }

    if (!recordingRef.current) return;

    try {
      setConvState('PROCESSING');
      const rec = recordingRef.current;
      recordingRef.current = null;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      if (!uri) {
        throw new Error('No audio recording found');
      }

      submitAnswerToBackend({ audioUri: uri, mimeType: 'audio/m4a', language });
    } catch (err) {
      console.warn('[VoiceBooking] Stop recording error:', err);
      if (isMountedRef.current) {
        await cleanupAudio();
        setErrorMessage('Failed to capture audio. Please try again or type.');
        setConvState('INITIALIZING');
      }
    }
  };

  // ─── Submit Manual Text Answer ─────────────────────────────────────────────
  const submitTextAnswer = (textToSubmit = manualText) => {
    const text = (textToSubmit || '').trim();
    if (!text) return;
    setManualText('');
    setShowTypeInput(false);

    setMessages((prev) => [
      ...prev,
      { role: 'user', text, timestamp: new Date() }
    ]);

    submitAnswerToBackend({ textAnswer: text, language });
  };

  // ─── Backend Communication & State Handling ──────────────────────────────
  const submitAnswerToBackend = async (payload) => {
    if (!sessionId) {
      setErrorMessage('Active session not found. Restarting...');
      startNewSession(language);
      return;
    }

    const payloadWithLang = {
      language,
      ...payload
    };

    setConvState('PROCESSING');
    setErrorMessage('');
    setIsOffline(false);

    try {
      const result = await voiceBookingApi.sendAnswer(sessionId, payloadWithLang);
      if (!isMountedRef.current) return;

      if (!result || !result.success) {
        throw new Error(result?.message || 'Processing failed');
      }

      if (result.transcribedText && !payload.textAnswer) {
        setTranscript(result.transcribedText);
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: result.transcribedText, timestamp: new Date() }
        ]);
      }

      const reply = result.replyText || result.question || 'Done.';
      const action = result.actionTaken || 'none';
      const actionData = result.actionResult || null;

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

      if (action === 'book_slot' && (result.token || actionData?.token)) {
        setCompletedResult(result.token || actionData?.token);
      }

      // Auto-play spoken response via on-device Speech
      speakAssistantText(reply, language);
    } catch (err) {
      console.warn('[VoiceBooking] Answer processing error:', err);
      if (!isMountedRef.current) return;

      await cleanupAudio();
      const isNetworkErr = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('Network');
      if (isNetworkErr) {
        setIsOffline(true);
        setErrorMessage('Network connection lost. Check connectivity or type instead.');
      } else {
        setErrorMessage(err.response?.data?.message || err.message || 'Error processing response. You can type instead.');
      }
      setConvState('INITIALIZING');
    }
  };

  // ─── Change Language ───────────────────────────────────────────────────────
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    startNewSession(newLang);
  };

  // ─── Confirm Booking & Close ───────────────────────────────────────────────
  const handleConfirmFinalBooking = () => {
    if (onBookingConfirmed && completedResult) {
      onBookingConfirmed(completedResult, lastActionResult);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <View style={styles.micBadge}>
                <Text style={{ fontSize: 18 }}>🎙️</Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {language === 'mr' ? 'किसान व्हॉइस सहाय्यक' : language === 'hi' ? 'किसान वॉयस सहायक' : 'KisanQ Voice Assistant'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {language === 'mr' ? 'नैसर्गिक बोला — ७ कृती (Groq AI)' : language === 'hi' ? 'प्राकृतिक बोलें — ७ कार्य' : 'Natural Free-Form Conversation · 7 Actions'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Language Selector */}
          <View style={styles.langRow}>
            {LANGUAGES.map((item) => {
              const active = item.code === language;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.langChip, active && styles.langChipActive]}
                  onPress={() => handleLanguageChange(item.code)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                    {item.name} ({item.label})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Offline Banner if disconnected */}
          {isOffline && (
            <OfflineBanner
              onRetry={() => {
                setIsOffline(false);
                startNewSession(language);
              }}
              message={
                language === 'mr'
                  ? 'इंटरनेट कनेक्शन नाही. कृपया नेटवर्क तपासा.'
                  : 'No internet connection. Please check your network.'
              }
            />
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollArea}
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Permission Prompt Card */}
            {permissionExplaining && (
              <View style={styles.permissionCard}>
                <Text style={styles.permissionIcon}>🎙️</Text>
                <Text style={styles.permissionTitle}>
                  {language === 'mr' ? 'मायक्रोफोन परवानगी आवश्यक' : 'Microphone Access Required'}
                </Text>
                <Text style={styles.permissionText}>
                  {language === 'mr'
                    ? 'थेट मराठी/हिंदीत बोलण्यासाठी मायक्रोफोन परवानगी द्या किंवा खालील पर्यायातून टाईप करा.'
                    : 'KisanQ requires microphone access to transcribe your speech. You can also choose to type.'}
                </Text>
                <View style={styles.permissionBtnRow}>
                  {canAskAgain !== false ? (
                    <TouchableOpacity style={styles.grantPermBtn} onPress={requestMicPermission} activeOpacity={0.8}>
                      <Text style={styles.grantPermBtnText}>🎙️ Allow Mic</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.grantPermBtn} onPress={handleOpenSettings} activeOpacity={0.8}>
                      <Text style={styles.grantPermBtnText}>⚙️ Open Settings</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.typeInsteadPermBtn}
                    onPress={() => {
                      setPermissionExplaining(false);
                      setShowTypeInput(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeInsteadPermBtnText}>⌨️ Type Instead</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Conversational Message Stream */}
            <View style={styles.messageStream}>
              {messages.map((msg, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.messageBubbleWrapper,
                    msg.role === 'user' ? styles.userBubbleWrapper : styles.assistantBubbleWrapper
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                    ]}
                  >
                    <Text style={styles.messageRoleTag}>
                      {msg.role === 'user' ? `👨‍🌾 ${farmerName}` : '🤖 KisanQ Assistant'}
                    </Text>
                    <Text style={[styles.messageText, msg.role === 'user' && styles.userMessageText]}>
                      {msg.text}
                    </Text>
                  </View>

                  {/* Embedded Action Result Card */}
                  {msg.actionResult && (
                    <View style={styles.embeddedActionCard}>
                      {/* Booking Card */}
                      {msg.actionTaken === 'book_slot' && msg.actionResult.tokenNumber && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>✅ {language === 'mr' ? 'स्लॉट बुक झाला!' : 'Slot Booked!'}</Text>
                          <Text style={styles.cardTokenText}>{msg.actionResult.tokenNumber}</Text>
                          <View style={styles.cardRow}>
                            <Text style={styles.cardLabel}>Mandi:</Text>
                            <Text style={styles.cardVal}>{msg.actionResult.mandiName}</Text>
                          </View>
                          <View style={styles.cardRow}>
                            <Text style={styles.cardLabel}>Crop & Qty:</Text>
                            <Text style={styles.cardVal}>{msg.actionResult.crop} · {msg.actionResult.quantity} Qtl</Text>
                          </View>
                          <View style={styles.cardRow}>
                            <Text style={styles.cardLabel}>Date & Time:</Text>
                            <Text style={styles.cardVal}>{msg.actionResult.slotDate} ({msg.actionResult.slotTime})</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.cardConfirmBtn}
                            onPress={handleConfirmFinalBooking}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.cardConfirmBtnText}>🎫 {language === 'mr' ? 'टोकन पहा व पुष्टी करा' : 'View & Confirm Token'}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Crop Price Card */}
                      {msg.actionTaken === 'check_crop_price' && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>📊 {msg.actionResult.crop} – {msg.actionResult.mandiName}</Text>
                          <View style={styles.priceRow}>
                            <View style={styles.priceBox}>
                              <Text style={styles.priceBoxLabel}>MSP (हमीभाव)</Text>
                              <Text style={styles.priceBoxVal}>₹{msg.actionResult.statutoryMSP}</Text>
                            </View>
                            <View style={styles.priceBox}>
                              <Text style={styles.priceBoxLabel}>Today (आज)</Text>
                              <Text style={[styles.priceBoxVal, { color: '#eab308' }]}>₹{msg.actionResult.marketPriceToday}</Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Queue Status Card */}
                      {msg.actionTaken === 'check_queue_position' && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>⏳ {language === 'mr' ? 'रांगेतील जागा' : 'Queue Position'}</Text>
                          <Text style={styles.cardBigPosition}>#{msg.actionResult.queuePosition || 1}</Text>
                          <Text style={styles.cardSubText}>Est. Wait: {msg.actionResult.estimatedWaitTime} · {msg.actionResult.currentStage}</Text>
                        </View>
                      )}

                      {/* Token 5-Stage Status Card */}
                      {msg.actionTaken === 'check_token_status' && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>📋 {msg.actionResult.tokenNumber} – {msg.actionResult.currentStageName}</Text>
                          <Text style={styles.cardSubText}>Stage {msg.actionResult.currentStageIndex}/5 ({msg.actionResult.currentStageStatus})</Text>
                        </View>
                      )}

                      {/* Payout Card */}
                      {msg.actionTaken === 'check_payout_status' && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>💰 {language === 'mr' ? 'डीबीटी पेमेंट तपशील' : 'DBT Payout Summary'}</Text>
                          <Text style={styles.cardTokenText}>{msg.actionResult.totalPayoutAmount}</Text>
                          <Text style={styles.cardSubText}>{msg.actionResult.netWeightQuintals} Qtl · {msg.actionResult.crop}</Text>
                        </View>
                      )}

                      {/* Support Card */}
                      {msg.actionTaken === 'get_support_info' && (
                        <View style={styles.cardContent}>
                          <Text style={styles.cardTitle}>📞 KisanQ Support (24x7)</Text>
                          <TouchableOpacity
                            style={styles.callBtn}
                            onPress={() => Linking.openURL(`tel:${msg.actionResult.helplineTollFree}`)}
                          >
                            <Text style={styles.callBtnText}>📞 Call {msg.actionResult.helplineDisplay}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Central Mic & Turn Visualizer */}
            <View style={styles.micArea}>
              {convState === 'ASSISTANT_SPEAKING' && (
                <View style={styles.assistantSpeakingCard}>
                  <Text style={styles.soundWaveIcon}>🔊</Text>
                  <Text style={styles.stateCaption}>
                    {language === 'mr' ? 'AI सहाय्यक बोलत आहे...' : 'AI Assistant is speaking...'}
                  </Text>
                  <TouchableOpacity
                    style={styles.skipToMicBtn}
                    onPress={() => {
                      cleanupAudio();
                      startRecording();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.skipToMicBtnText}>
                      {language === 'mr' ? 'थेट बोला ▶' : 'Skip & Speak ▶'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {convState === 'LISTENING' && (
                <View style={styles.listeningCard}>
                  <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                    <TouchableOpacity
                      style={styles.bigMicButton}
                      onPress={stopRecordingAndSubmit}
                      activeOpacity={0.9}
                    >
                      <Text style={{ fontSize: 36 }}>🎙️</Text>
                    </TouchableOpacity>
                  </Animated.View>
                  <Text style={styles.listeningTitle}>
                    {language === 'mr' ? 'आता बोला... (आम्ही ऐकत आहोत)' : 'Speak naturally now...'}
                  </Text>
                  <TouchableOpacity
                    style={styles.finishSpeakingBtn}
                    onPress={stopRecordingAndSubmit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.finishSpeakingBtnText}>
                      {language === 'mr' ? '✓ बोलणे पूर्ण झाले' : '✓ Done Speaking'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {convState === 'PROCESSING' && (
                <View style={styles.processingCard}>
                  <ActivityIndicator size="large" color="#16a34a" style={{ marginBottom: 10 }} />
                  <Text style={styles.processingTitle}>Groq AI Reasoning & Tool Execution...</Text>
                </View>
              )}

              {convState === 'INITIALIZING' && !permissionExplaining && (
                <View style={styles.idleCard}>
                  <TouchableOpacity
                    style={[styles.restartTurnBtn, { backgroundColor: '#16a34a' }]}
                    onPress={startRecording}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.restartTurnBtnText, { color: '#ffffff' }]}>
                      {language === 'mr' ? '🎙️ आता बोला' : '🎙️ Speak Now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Error message */}
            {errorMessage !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Quick Action Prompt Chips */}
            <View style={styles.suggestionsContainer}>
              <View style={styles.quickHeaderRow}>
                <Text style={styles.suggestionsTitle}>
                  💡 {language === 'mr' ? 'जलद पर्याय (टॅप करू शकता):' : 'Quick Actions (1-Tap):'}
                </Text>
                <TouchableOpacity onPress={() => setShowTypeInput(!showTypeInput)}>
                  <Text style={styles.typeToggleText}>{showTypeInput ? 'Hide Keyboard' : '⌨️ Type instead'}</Text>
                </TouchableOpacity>
              </View>

              {showTypeInput ? (
                <View style={styles.typeInputRow}>
                  <TextInput
                    style={styles.typeTextInput}
                    placeholder={language === 'mr' ? 'उदा. कोपरगावला २५ क्विंटल सोयाबीन बुक करा…' : 'Type e.g. Book 25 Qtl Soybean slot…'}
                    value={manualText}
                    onChangeText={setManualText}
                    placeholderTextColor="#94a3b8"
                  />
                  <TouchableOpacity
                    style={[styles.typeSubmitBtn, !manualText.trim() && styles.typeSubmitBtnDisabled]}
                    onPress={() => submitTextAnswer()}
                    disabled={!manualText.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeSubmitBtnText}>➔</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.suggestionChipsRow}>
                  {ACTION_PROMPTS.map((item) => {
                    const textLabel = item[language] || item.mr || item.en;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.suggestionChip}
                        onPress={() => submitTextAnswer(textLabel)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.suggestionChipText}>{textLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '92%',
    minHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  micBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b'
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b'
  },
  langRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6
  },
  langChip: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  langChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a'
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  langChipTextActive: {
    color: '#15803d',
    fontWeight: '800'
  },
  scrollArea: {
    flexGrow: 1
  },
  messageStream: {
    marginBottom: 12
  },
  messageBubbleWrapper: {
    marginBottom: 10
  },
  userBubbleWrapper: {
    alignItems: 'flex-end'
  },
  assistantBubbleWrapper: {
    alignItems: 'flex-start'
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: '85%'
  },
  userBubble: {
    backgroundColor: '#16a34a',
    borderBottomRightRadius: 2
  },
  assistantBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  messageRoleTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2
  },
  messageText: {
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 18
  },
  userMessageText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  embeddedActionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    width: '90%'
  },
  cardContent: {
    gap: 4
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  cardTokenText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16a34a'
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2
  },
  cardLabel: {
    fontSize: 11,
    color: '#64748b'
  },
  cardVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a'
  },
  cardConfirmBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6
  },
  cardConfirmBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    padding: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  priceBoxLabel: {
    fontSize: 9,
    color: '#64748b'
  },
  priceBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a'
  },
  cardBigPosition: {
    fontSize: 24,
    fontWeight: '900',
    color: '#eab308'
  },
  cardSubText: {
    fontSize: 11,
    color: '#64748b'
  },
  callBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  micArea: {
    marginVertical: 10
  },
  assistantSpeakingCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center'
  },
  soundWaveIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  stateCaption: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600'
  },
  skipToMicBtn: {
    marginTop: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12
  },
  skipToMicBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  listeningCard: {
    alignItems: 'center',
    paddingVertical: 8
  },
  pulseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  bigMicButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center'
  },
  listeningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 6
  },
  finishSpeakingBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16
  },
  finishSpeakingBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  processingCard: {
    alignItems: 'center',
    paddingVertical: 12
  },
  processingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a'
  },
  idleCard: {
    alignItems: 'center'
  },
  restartTurnBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16
  },
  restartTurnBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8
  },
  errorText: {
    color: '#991b1b',
    fontSize: 11
  },
  suggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10
  },
  quickHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  typeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a'
  },
  suggestionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  suggestionChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  suggestionChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600'
  },
  typeInputRow: {
    flexDirection: 'row',
    gap: 6
  },
  typeTextInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a'
  },
  typeSubmitBtn: {
    backgroundColor: '#16a34a',
    width: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  typeSubmitBtnDisabled: {
    opacity: 0.5
  },
  typeSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900'
  },
  permissionCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10
  },
  permissionIcon: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 4
  },
  permissionText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8
  },
  permissionBtnRow: {
    flexDirection: 'row',
    gap: 6
  },
  grantPermBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center'
  },
  grantPermBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  typeInsteadPermBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  typeInsteadPermBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  }
});
