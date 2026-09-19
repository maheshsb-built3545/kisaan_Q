import React, { useState, useEffect, useRef } from 'react';
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
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { COLORS } from '../../utils/constants';

const RESEND_COOLDOWN_SECONDS = 30;

export default function OTPVerifyScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();

  const phone = route.params?.phone || '9876543210';
  const mode = route.params?.mode || 'login';
  const name = route.params?.name || '';
  const devOtp = route.params?.devOtp || '123456';

  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  const inputRef = useRef(null);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const handleOtpChange = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    setErrorMessage('');
    setSuccessInfo('');

    // Auto-verify once 6 digits are typed
    if (cleaned.length === 6) {
      performVerification(cleaned);
    }
  };

  const handleAutoFill = () => {
    const code = devOtp || '123456';
    setOtp(code);
    setErrorMessage('');
    setSuccessInfo('');
    performVerification(code);
  };

  const performVerification = async (codeToVerify) => {
    const finalOtp = codeToVerify || otp;
    if (!finalOtp || finalOtp.length !== 6) {
      setErrorMessage(t('invalid_otp'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessInfo('');

    try {
      const payload = {
        phone: phone.trim(),
        otp: finalOtp.trim(),
        preferredLanguage: i18n.language || 'mr',
        mode
      };

      if (name) {
        payload.name = name;
      }

      const response = await client.post('/auth/farmer/verify-otp', payload);
      const data = response.data?.data || {};

      if (data.token && data.user) {
        setSuccessInfo(t('auth_success'));
        await login(data.token, data.user);
        // Note: RootNavigator automatically handles transition to MainTabs on auth state change
      } else {
        throw new Error('Authentication response did not contain a valid session token');
      }
    } catch (error) {
      console.warn('[OTPVerify] Verification failed:', error?.response?.data || error.message);
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        t('invalid_otp');
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setErrorMessage('');
    setSuccessInfo('');

    try {
      await client.post('/auth/farmer/request-otp', {
        phone: phone.trim(),
        mode,
        preferredLanguage: i18n.language || 'mr',
        ...(name ? { name } : {})
      });

      setTimer(RESEND_COOLDOWN_SECONDS);
      setCanResend(false);
      setSuccessInfo(t('resend_success'));
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        'Unable to resend OTP';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
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
          {/* Top Back & Edit Phone Row */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← {t('back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.changePhoneButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.changePhoneText}>{t('change_phone')}</Text>
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.lockBadge}>
              <Text style={styles.lockIcon}>🔐</Text>
            </View>
            <Text style={styles.title}>{t('verify_title')}</Text>
            <Text style={styles.subtitle}>
              {t('verify_subtitle')}{' '}
              <Text style={styles.phoneHighlight}>+91 {phone}</Text>
            </Text>
          </View>

          {/* Dev Mode Banner & Autofill Helper */}
          <View style={styles.demoBanner}>
            <View style={styles.demoBannerRow}>
              <Text style={styles.demoBannerTitle}>{t('demo_otp_hint')}</Text>
              <TouchableOpacity
                style={styles.autofillButton}
                onPress={handleAutoFill}
                activeOpacity={0.7}
              >
                <Text style={styles.autofillButtonText}>
                  ⚡ {t('autofill_btn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Card */}
          <View style={styles.card}>
            <Text style={styles.pinPrompt}>
              {i18n.language === 'mr'
                ? '६-अंकी पडताळणी कोड टाका'
                : i18n.language === 'hi'
                ? '6-अंकों का सत्यापन कोड दर्ज करें'
                : 'Enter 6-Digit PIN'}
            </Text>

            {/* 6 Digit Display Boxes */}
            <TouchableOpacity
              style={styles.pinBoxesContainer}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
            >
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const digit = otp[index] || '';
                const isFocused = otp.length === index;
                return (
                  <View
                    key={index}
                    style={[
                      styles.pinBox,
                      digit ? styles.pinBoxFilled : null,
                      isFocused ? styles.pinBoxFocused : null
                    ]}
                  >
                    <Text style={styles.pinDigit}>{digit}</Text>
                  </View>
                );
              })}
            </TouchableOpacity>

            {/* Hidden Input Layer */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={handleOtpChange}
              autoFocus
            />

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Success Info Message */}
            {successInfo ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successInfo}</Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (isLoading || otp.length < 6) && styles.submitButtonDisabled
              ]}
              onPress={() => performVerification(otp)}
              disabled={isLoading || otp.length < 6}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitButtonText}>
                    {' '}{t('verifying')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {t('verify_btn')} ✓
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend OTP Timer Section */}
            <View style={styles.resendSection}>
              {canResend ? (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={isLoading}
                  style={styles.resendAction}
                >
                  <Text style={styles.resendActionText}>
                    🔄 {t('resend_otp')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.resendTimerText}>
                  ⏱ {t('resend_in')}{' '}
                  <Text style={styles.timerNumber}>
                    00:{timer < 10 ? `0${timer}` : timer}
                  </Text>
                </Text>
              )}
            </View>
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
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  changePhoneButton: {
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  changePhoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textDecorationLine: 'underline'
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#93c5fd'
  },
  lockIcon: {
    fontSize: 26
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  phoneHighlight: {
    color: COLORS.text,
    fontWeight: '800'
  },
  demoBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 16
  },
  demoBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  demoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    flex: 1
  },
  autofillButton: {
    backgroundColor: '#b45309',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  autofillButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  pinPrompt: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16
  },
  pinBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 20
  },
  pinBox: {
    width: 38,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pinBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4'
  },
  pinBoxFocused: {
    borderColor: COLORS.primaryDark,
    borderWidth: 2,
    backgroundColor: '#ffffff'
  },
  pinDigit: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16
  },
  errorText: {
    fontSize: 13,
    color: '#b91c1c',
    fontWeight: '600',
    textAlign: 'center'
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16
  },
  successText: {
    fontSize: 13,
    color: COLORS.primaryDark,
    fontWeight: '700',
    textAlign: 'center'
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
    opacity: 0.6
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
  },
  resendSection: {
    marginTop: 18,
    alignItems: 'center'
  },
  resendAction: {
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  resendActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  resendTimerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  timerNumber: {
    fontWeight: '700',
    color: COLORS.text
  }
});
