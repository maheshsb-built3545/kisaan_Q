import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { COLORS } from '../../utils/constants';

export default function OTPLoginScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phone, setPhone] = useState('9876543210');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  const cleanPhone = (val) => val.replace(/\D/g, '').slice(0, 10);

  const validateInputs = () => {
    setErrorMessage('');
    setShowRegisterPrompt(false);

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setErrorMessage(t('phone_invalid_error'));
      return false;
    }

    if (mode === 'register' && (!name || name.trim().length < 2)) {
      setErrorMessage(t('name_invalid_error'));
      return false;
    }

    return true;
  };

  const handleRequestOtp = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setErrorMessage('');
    setShowRegisterPrompt(false);

    try {
      const payload = {
        phone: phone.trim(),
        mode,
        preferredLanguage: i18n.language || 'mr'
      };

      if (mode === 'register' && name.trim()) {
        payload.name = name.trim();
      }

      const response = await client.post('/auth/farmer/request-otp', payload);
      const data = response.data?.data || {};

      navigation.navigate('OTPVerify', {
        phone: phone.trim(),
        mode,
        name: data.farmerName || name.trim() || 'शेतकरी',
        devOtp: data.devOtp || '123456',
        preferredLanguage: i18n.language || 'mr'
      });
    } catch (error) {
      console.warn('[OTPLogin] Request error:', error?.response?.data || error.message);
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        'Unable to connect to server';

      if (
        mode === 'login' &&
        (error.response?.status === 404 ||
          errorMsg.toLowerCase().includes('not registered'))
      ) {
        setShowRegisterPrompt(true);
        setErrorMessage(t('number_not_registered'));
      } else if (
        mode === 'register' &&
        (error.response?.status === 400 ||
          errorMsg.toLowerCase().includes('already registered'))
      ) {
        setErrorMessage(t('already_registered'));
        setTimeout(() => {
          setMode('login');
          setErrorMessage('');
        }, 1500);
      } else {
        setErrorMessage(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setPhone('9876543210');
    if (mode === 'register') {
      setName('महेश बोर्डे (Demo Farmer)');
    }
    setErrorMessage('');
    setShowRegisterPrompt(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Back / Language */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('LanguageSelect')}
            >
              <Text style={styles.backButtonText}>← {t('select_language')}</Text>
            </TouchableOpacity>
            <View style={styles.langPill}>
              <Text style={styles.langPillText}>
                {i18n.language === 'mr'
                  ? 'मराठी'
                  : i18n.language === 'hi'
                  ? 'हिंदी'
                  : 'EN'}
              </Text>
            </View>
          </View>

          {/* Header Card */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>🌾</Text>
            </View>
            <Text style={styles.appTitle}>{t('app_title')}</Text>
            <Text style={styles.headerSubtitle}>
              {mode === 'login' ? t('login_subtitle') : t('register_subtitle')}
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'login' && styles.modeTabActive
              ]}
              onPress={() => {
                setMode('login');
                setErrorMessage('');
                setShowRegisterPrompt(false);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'login' && styles.modeTabTextActive
                ]}
              >
                {t('tab_login')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'register' && styles.modeTabActive
              ]}
              onPress={() => {
                setMode('register');
                setErrorMessage('');
                setShowRegisterPrompt(false);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === 'register' && styles.modeTabTextActive
                ]}
              >
                {t('tab_register')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Full Name Input (Register mode only) */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('farmer_name')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('name_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Mobile Number Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('enter_phone')}</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(val) => setPhone(cleanPhone(val))}
                  placeholder="9876543210"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>

            {/* Quick Demo Fill Helper */}
            <TouchableOpacity
              style={styles.demoChip}
              onPress={handleQuickDemoFill}
              activeOpacity={0.7}
            >
              <Text style={styles.demoChipText}>{t('demo_farmer_chip')}</Text>
            </TouchableOpacity>

            {/* Error / Feedback Message */}
            {errorMessage ? (
              <View
                style={[
                  styles.errorBox,
                  showRegisterPrompt && styles.promptBox
                ]}
              >
                <Text style={styles.errorText}>{errorMessage}</Text>
                {showRegisterPrompt && (
                  <TouchableOpacity
                    style={styles.switchModeButton}
                    onPress={() => {
                      setMode('register');
                      setErrorMessage('');
                      setShowRegisterPrompt(false);
                    }}
                  >
                    <Text style={styles.switchModeButtonText}>
                      + {t('switch_to_register')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled
              ]}
              onPress={handleRequestOtp}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitButtonText}>
                    {' '}{t('sending_otp')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? t('send_otp') : t('register_send_otp')} →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  flex: {
    flex: 1
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'center'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  langPill: {
    backgroundColor: '#dcfce7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac'
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#86efac'
  },
  logoIcon: {
    fontSize: 28
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  modeTabActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  modeTabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800'
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  countryCode: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text
  },
  input: {
    backgroundColor: '#f8fafc',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  phoneInput: {
    flex: 1,
    letterSpacing: 1.5
  },
  demoChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16
  },
  promptBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe'
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center'
  },
  switchModeButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center'
  },
  switchModeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
