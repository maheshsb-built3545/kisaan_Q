import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../../locales/i18n';
import { COLORS } from '../../utils/constants';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  {
    id: '1',
    qMr: '🌾 स्लॉट बुकिंग कसे करावे?',
    qEn: '🌾 How to book an arrival slot?',
    qHi: '🌾 स्लॉट बुकिंग कैसे करें?',
    aMr: 'मुख्यपृष्ठावरील "स्लॉट बुकिंग" किंवा बाजार समिती सूचीमधून आपली हवी ती बाजार समिती निवडा. पीक, अंदाजे प्रमाण (क्विंटल), वाहन प्रकार व तारीख निवडून वेळ निश्चित करा.',
    aEn: 'Select your preferred Mandi from the Centres tab or Home screen. Choose your crop, quantity in quintals, vehicle type, arrival date, and preferred time slot.',
    aHi: 'होम या मंडी सूची से पसंदीदा मंडी चुनें। फसल, मात्रा (क्विंटल), वाहन और आगमन समय स्लॉट चुनकर पुष्टि करें।'
  },
  {
    id: '2',
    qMr: '🎟️ डिजिटल पास आणि QR कोड कसा वापरावा?',
    qEn: '🎟️ How to use the Digital QR Pass?',
    qHi: '🎟️ डिजिटल पास और क्यूआर कोड का उपयोग कैसे करें?',
    aMr: 'बुकिंग झाल्यानंतर मिळणारा QR पास आपल्या फोनमध्ये ऑफलाइन सुरक्षित राहतो. बाजार समितीच्या गेट १ वर सुरक्षा रक्षकास हा QR कोड दाखवून थेट प्रवेश मिळवा.',
    aEn: 'After booking, your digital QR pass is cached offline. Simply present the QR code at APMC Security Gate 01 for instant ANPR intake and entry.',
    aHi: 'बुकिंग के बाद क्यूआर पास फोन में ऑफलाइन सुरक्षित रहता है। मंडी गेट 1 पर सुरक्षा अधिकारी को यह क्यूआर कोड दिखाकर प्रवेश लें।'
  },
  {
    id: '3',
    qMr: '🚗 शेतातून कधी निघावे (Leave-by Recommendation)?',
    qEn: '🚗 When should I depart from my farm (Leave-By)?',
    qHi: '🚗 खेत से कब निकलना चाहिए (Leave-By)?',
    aMr: 'थेट रांग (Live Queue) स्क्रीनवर आपल्या स्लॉट वेळेनुसार शेतातून निघण्याची वेळ (उदा. ४५ मिनिटे आधी) दर्शवली जाते, जेणेकरून वेळेवर पोहोचता येईल.',
    aEn: 'The Live Queue screen dynamically calculates the ideal departure time from your farm (typically 45 minutes prior) to arrive comfortably on schedule.',
    aHi: 'लाइव कतार स्क्रीन पर आपके स्लॉट समय के अनुसार प्रस्थान का सही समय दिखाया जाता है ताकि आप समय पर मंडी पहुंच सकें।'
  },
  {
    id: '4',
    qMr: '⚖️ गुणवत्ता प्रतवारी व वजन तपासणी कशी होते?',
    qEn: '⚖️ How are quality grading and weighment handled?',
    qHi: '⚖️ गुणवत्ता ग्रेडिंग और वजन कैसे होता है?',
    aMr: 'गेट प्रवेशानंतर लॅबमध्ये NIR उपकरणाद्वारे आर्द्रता (Moisture) तपासली जाते. त्यानंतर ६० टन क्षमतेच्या इलेक्ट्रॉनिक वजन काट्यावर अचूक वजन नोंदवले जाते.',
    aEn: 'After gate check-in, the Assaying Lab tests moisture via NIR NIR sensors, followed by gross and tare weighing on 60 MT pitless electronic weighbridges.',
    aHi: 'गेट प्रवेश के बाद लैब में नमी की जांच की जाती है, और फिर इलेक्ट्रॉनिक धर्मकांटे पर सही वजन दर्ज होता है।'
  },
  {
    id: '5',
    qMr: '💳 DBT खात्यात पैसे कधी जमा होतात?',
    qEn: '💳 When is DBT payment credited to bank?',
    qHi: '💳 डीबीटी भुगतान बैंक खाते में कब जमा होता है?',
    aMr: 'खरेदी पावती मान्य झाल्यावर बाजार समिती कोषागाराद्वारे PFMS प्रणालीने थेट रक्कम खात्यात जमा केली जाते. "DBT पावती" स्क्रीनवर स्थिती तपासता येते.',
    aEn: 'Once the Secretary confirms the purchase, the Mandi Treasury dispatches the payment directly via PFMS Direct Bank Transfer (DBT).',
    aHi: 'खरीद पुष्टि के बाद मंडी कोषागार द्वारा पीएफएमएस के जरिए सीधे डीबीटी से भुगतान भेजा जाता है।'
  },
  {
    id: '6',
    qMr: '❌ स्लॉट रद्द करण्याचे धोरण काय आहे?',
    qEn: '❌ What is the cancellation policy?',
    qHi: '❌ स्लॉट रद्द करने की नीति क्या है?',
    aMr: 'स्लॉट वेळेच्या २ तास आधी रद्द करणे पूर्णपणे मोफत आहे. ३० मिनिटे ते २ तास दरम्यान नाममात्र ₹५० शुल्क, तर वेळेनंतर ₹१५० शुल्क पुढील व्यवहारातून वजा होते.',
    aEn: 'Cancellations > 2 hours prior are 100% free. Between 30m and 2h, a nominal ₹50 fee applies; under 30m or no-shows incur ₹150 auto-deducted from next payout.',
    aHi: '2 घंटे पहले स्लॉट रद्द करना मुफ्त है। 30 मिनट से 2 घंटे के बीच ₹50 शुल्क, और अंतिम समय में रद्द करने पर ₹150 शुल्क लगता है।'
  }
];

export default function HelpSupportScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleCallHelpline = () => {
    Linking.openURL('tel:18002330244').catch(() => {});
  };

  const handleCallControlRoom = () => {
    Linking.openURL('tel:+912423222345').catch(() => {});
  };

  const handleWhatsAppSupport = () => {
    const text = encodeURIComponent(
      i18n.language === 'mr'
        ? 'नमस्कार, मला किसान क्यू स्लॉट बुकिंगबाबत मदत हवी आहे.'
        : 'Hello, I need assistance regarding KisanQ APMC slot booking.'
    );
    const url = `whatsapp://send?phone=+919876543210&text=${text}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(`https://wa.me/919876543210?text=${text}`);
        }
      })
      .catch(() => {
        Linking.openURL(`https://wa.me/919876543210?text=${text}`);
      });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📞 {t('support')}</Text>
          <Text style={styles.subtitle}>
            शेतकरी मदत केंद्र, नियंत्रण कक्ष संपर्क व वारंवार विचारले जाणारे प्रश्न
          </Text>
        </View>

        {/* Toll-Free Direct Calling Card */}
        <View style={styles.helplineCard}>
          <View style={styles.helplineTop}>
            <View style={styles.phoneIconCircle}>
              <Text style={styles.phoneIcon}>📞</Text>
            </View>
            <View style={styles.helplineTextCol}>
              <Text style={styles.helplineBadge}>२४×७ टोल-फ्री शेतकरी हेल्पलाइन</Text>
              <Text style={styles.helplineNumber}>1800-233-0244</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.callNowButton}
            onPress={handleCallHelpline}
            activeOpacity={0.8}
          >
            <Text style={styles.callNowButtonText}>
              📞 थेट कॉल करा (Call Toll-Free Now)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Contact Options (Control Room & WhatsApp) */}
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
            onPress={handleWhatsAppSupport}
            activeOpacity={0.8}
          >
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactTitle}>
              {i18n.language === 'mr' ? 'WhatsApp मदत' : 'WhatsApp Support'}
            </Text>
            <Text style={styles.contactSub}>
              {i18n.language === 'mr' ? 'थेट संदेश →' : 'Chat Direct →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}
            onPress={handleCallControlRoom}
            activeOpacity={0.8}
          >
            <Text style={styles.contactIcon}>🏛️</Text>
            <Text style={styles.contactTitle}>
              {i18n.language === 'mr' ? 'नियंत्रण कक्ष' : 'Control Room'}
            </Text>
            <Text style={styles.contactSub}>
              {i18n.language === 'mr' ? 'कॉल करा →' : 'Call Room →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* In-App Language Quick Switcher */}
        <View style={styles.langSwitchCard}>
          <Text style={styles.langSwitchTitle}>🌐 भाषा बदला / Change Language</Text>
          <View style={styles.langButtonsRow}>
            {[
              { code: 'mr', label: 'मराठी' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'en', label: 'English' }
            ].map((lang) => {
              const isActive = (i18n.language || 'mr') === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langPill,
                    isActive && styles.langPillActive
                  ]}
                  onPress={() => setAppLanguage(lang.code)}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      isActive && styles.langPillTextActive
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* FAQ Accordion Section */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionHeader}>
            ❓ वारंवार विचारले जाणारे प्रश्न (FAQs)
          </Text>

          <View style={styles.faqList}>
            {FAQS.map((faq) => {
              const isExpanded = expandedFaq === faq.id;
              const qText =
                i18n.language === 'mr'
                  ? faq.qMr
                  : i18n.language === 'hi'
                  ? faq.qHi
                  : faq.qEn;
              const aText =
                i18n.language === 'mr'
                  ? faq.aMr
                  : i18n.language === 'hi'
                  ? faq.aHi
                  : faq.aEn;

              return (
                <View key={faq.id} style={styles.faqCard}>
                  <TouchableOpacity
                    style={styles.faqHeader}
                    onPress={() => toggleFaq(faq.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.faqQuestion}>{qText}</Text>
                    <Text style={styles.faqArrow}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.faqBody}>
                      <Text style={styles.faqAnswer}>{aText}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Offline & Hardware Resilience Badge */}
        <View style={styles.offlineStatusCard}>
          <Text style={styles.offlineStatusTitle}>
            🛡️ ऑफलाईन व सुरक्षा हमी (Offline & Data Guarantee)
          </Text>
          <Text style={styles.offlineStatusText}>
            • डिजिटल पास व QR कोड फोन मेमरीमध्ये सुरक्षित राहतो.{'\n'}
            • मंडी गेटवर इंटरनेट नसतानाही QR कोड स्कॅन होतो.{'\n'}
            • गोपनीयता धोरण: आधार किंवा संवेदनशील बँक डेटा संकलित केला जात नाही.
          </Text>
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
    padding: 16,
    paddingBottom: 36
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted
  },
  helplineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 14
  },
  helplineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  phoneIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86efac'
  },
  phoneIcon: {
    fontSize: 24
  },
  helplineTextCol: {
    flex: 1
  },
  helplineBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase'
  },
  helplineNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.5
  },
  callNowButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  callNowButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  contactCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  contactIcon: {
    fontSize: 22,
    marginBottom: 4
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2
  },
  contactSub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  langSwitchCard: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16
  },
  langSwitchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10
  },
  langButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  langPill: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  langPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  langPillTextActive: {
    color: '#ffffff'
  },
  faqSection: {
    marginBottom: 16
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10
  },
  faqList: {
    gap: 8
  },
  faqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden'
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 8
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    minWidth: 0,
    marginRight: 6
  },
  faqArrow: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
    flexShrink: 0
  },
  faqBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    backgroundColor: '#f8fafc'
  },
  faqAnswer: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18
  },
  offlineStatusCard: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  offlineStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 6
  },
  offlineStatusText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16
  }
});
