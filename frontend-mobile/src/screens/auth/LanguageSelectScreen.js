import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../locales/i18n';
import { COLORS } from '../../utils/constants';

const LANGUAGES = [
  {
    code: 'mr',
    name: 'मराठी',
    englishName: 'Marathi',
    subtitle: 'महाराष्ट्रातील बाजार समित्या',
    badge: 'महाराष्ट्र APMC'
  },
  {
    code: 'hi',
    name: 'हिंदी',
    englishName: 'Hindi',
    subtitle: 'राष्ट्रीय कृषि मंडियां',
    badge: 'राष्ट्रीय'
  },
  {
    code: 'en',
    name: 'English',
    englishName: 'English',
    subtitle: 'National APMC Mandi Portal',
    badge: 'National'
  }
];

export default function LanguageSelectScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'mr');

  useEffect(() => {
    if (i18n.language) {
      setSelectedLang(i18n.language);
    }
  }, [i18n.language]);

  const handleSelectLanguage = async (code) => {
    setSelectedLang(code);
    await setAppLanguage(code);
  };

  const handleContinue = async () => {
    await setAppLanguage(selectedLang);
    navigation.navigate('OTPLogin');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} bounces={false}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🌾</Text>
          </View>
          <Text style={styles.appTitle}>{t('app_title')}</Text>
          <Text style={styles.tagline}>{t('app_tagline')}</Text>
        </View>

        {/* Language Selection Card Section */}
        <View style={styles.selectionSection}>
          <Text style={styles.sectionTitle}>{t('select_language')}</Text>
          <Text style={styles.sectionSubtitle}>{t('choose_language_sub')}</Text>

          <View style={styles.cardsContainer}>
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected
                  ]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardLeft}>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.textContainer}>
                      <View style={styles.langNameRow}>
                        <Text
                          style={[
                            styles.langNativeName,
                            isSelected && styles.langNativeNameSelected
                          ]}
                        >
                          {lang.name}
                        </Text>
                        <Text style={styles.langEnglishName}>
                          ({lang.englishName})
                        </Text>
                      </View>
                      <Text style={styles.langSubtitle}>{lang.subtitle}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.badgeContainer,
                      isSelected && styles.badgeContainerSelected
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        isSelected && styles.badgeTextSelected
                      ]}
                    >
                      {lang.badge}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>
              {t('continue_btn')} →
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between'
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16
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
    letterSpacing: 0.5,
    marginBottom: 2
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  selectionSection: {
    flex: 1,
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 14
  },
  cardsContainer: {
    gap: 10
  },
  langCard: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  langCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fdf4',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  radioOuterSelected: {
    borderColor: COLORS.primary
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary
  },
  textContainer: {
    flex: 1
  },
  langNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2
  },
  langNativeName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text
  },
  langNativeNameSelected: {
    color: COLORS.primaryDark
  },
  langEnglishName: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  langSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  badgeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9'
  },
  badgeContainerSelected: {
    backgroundColor: '#bbf7d0'
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  badgeTextSelected: {
    color: COLORS.primaryDark
  },
  footer: {
    marginTop: 16,
    marginBottom: 6
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
