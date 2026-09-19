import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import { setAppLanguage } from '../../locales/i18n';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import OfflineBanner from '../../components/OfflineBanner';
import NotificationModal from '../../components/NotificationModal';
import { COLORS, isTokenActive } from '../../utils/constants';

const CROP_ICONS = {
  Soybean: '🌱',
  Cotton: '⚪',
  Wheat: '🌾',
  Onion: '🧅',
  Maize: '🌽',
  Chana: '🟤',
  Gram: '🟤'
};

const DEFAULT_PRICES = [
  {
    crop: 'Soybean',
    mspPrice: 4892,
    marketPriceToday: 4950,
    marketPriceYesterday: 4880,
    mandiId: 'KPG-01'
  },
  {
    crop: 'Cotton',
    mspPrice: 7121,
    marketPriceToday: 7350,
    marketPriceYesterday: 7280,
    mandiId: 'KPG-01'
  },
  {
    crop: 'Wheat',
    mspPrice: 2275,
    marketPriceToday: 2420,
    marketPriceYesterday: 2400,
    mandiId: 'KPG-01'
  },
  {
    crop: 'Onion',
    mspPrice: 1800,
    marketPriceToday: 2150,
    marketPriceYesterday: 2100,
    mandiId: 'RHT-01'
  }
];

export default function HomeScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  const [activeToken, setActiveToken] = useState(null);
  const [cropPrices, setCropPrices] = useState(DEFAULT_PRICES);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Generate dynamic in-app alerts based on current token & mandi state
  const buildNotifications = useCallback((token) => {
    const list = [
      {
        id: 'help-line-alert',
        title: '📞 ' + (i18n.language === 'mr' ? '२४×७ शेतकरी हेल्पलाइन' : '24x7 Farmer Helpline'),
        body: i18n.language === 'mr'
          ? 'टोल-फ्री १८००-२३३-०२४४ वर संपर्क साधा किंवा WhatsApp द्वारे थेट मदत मिळवा.'
          : 'Toll-free 1800-233-0244 is active for APMC assistance & slot support.',
        time: i18n.language === 'mr' ? 'सक्रिय' : 'Active',
        icon: '📞',
        unread: false,
        actionText: i18n.language === 'mr' ? 'मदत केंद्र पहा' : 'View Support',
        screen: 'SupportTab'
      }
    ];

    if (token) {
      list.unshift({
        id: 'token-active-' + token.tokenNumber,
        title: '🌾 ' + (i18n.language === 'mr' ? 'स्लॉट टोकन सक्रिय' : 'Slot Booking Confirmed'),
        body: (token.mandiName || 'APMC Mandi') + ' · ' + token.crop + ' (' + token.quantity + ' Qtl) · ' + (token.slotLabel || token.slotTime || '08:00 AM'),
        time: token.slotDate || 'Today',
        icon: '🎟️',
        unread: true,
        actionText: i18n.language === 'mr' ? 'पास पहा' : 'View Pass',
        screen: 'TokenDetails',
        params: { token }
      });

      if (token.agriPoolMatch) {
        list.splice(1, 0, {
          id: 'agripool-match-alert',
          title: '🤝 ' + (i18n.language === 'mr' ? 'ॲग्रीपूल शेतकरी जोडणी' : 'AgriPool Freight Match'),
          body: i18n.language === 'mr'
            ? `${token.agriPoolMatch.farmerName} (५०० मी अंतरावर) यांच्यासोबत वाहतूक खर्च बचत संधी.`
            : `Proximity match with ${token.agriPoolMatch.farmerName} within 500m for shared tractor transport.`,
          time: '500m',
          icon: '🤝',
          unread: true
        });
      }
    }

    setNotifications(list);
  }, [i18n.language]);

  const fetchDashboardData = useCallback(async () => {
    let hadNetworkError = false;

    try {
      // 1. Fetch active token for farmer
      const tokenRes = await client.get('/tokens/my-tokens').catch((err) => {
        hadNetworkError = true;
        return null;
      });

      if (tokenRes?.data) {
        let found = null;
        if (tokenRes.data.activeToken && isTokenActive(tokenRes.data.activeToken)) {
          found = tokenRes.data.activeToken;
        } else if (Array.isArray(tokenRes.data.tokens)) {
          found = tokenRes.data.tokens.find((t) => isTokenActive(t)) || null;
        }

        setActiveToken(found);
        buildNotifications(found);
        await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, found);
      } else {
        // Fallback to local offline cache
        const cached = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
        if (cached && isTokenActive(cached)) {
          setActiveToken(cached);
          buildNotifications(cached);
        } else {
          setActiveToken(null);
          buildNotifications(null);
        }
      }

      // 2. Fetch live crop prices
      const priceRes = await client.get('/crop-prices').catch((err) => {
        hadNetworkError = true;
        return null;
      });

      if (priceRes?.data?.data && priceRes.data.data.length > 0) {
        setCropPrices(priceRes.data.data);
        await Storage.setJson(Storage.ASYNC_KEYS.CROP_PRICES, priceRes.data.data);
      } else {
        const cachedPrices = await Storage.getJson(Storage.ASYNC_KEYS.CROP_PRICES);
        if (cachedPrices && cachedPrices.length > 0) {
          setCropPrices(cachedPrices);
        }
      }

      setIsOffline(hadNetworkError);
    } catch (err) {
      console.warn('[HomeScreen] Data fetch error:', err.message);
      setIsOffline(true);
      const cached = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
      if (cached && isTokenActive(cached)) {
        setActiveToken(cached);
        buildNotifications(cached);
      } else {
        setActiveToken(null);
        buildNotifications(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildNotifications]);

  useEffect(() => {
    fetchDashboardData();
    // Register Expo Push Token on launch
    registerForPushNotificationsAsync();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLanguageCycle = async () => {
    const current = i18n.language || 'mr';
    const next = current === 'mr' ? 'hi' : current === 'hi' ? 'en' : 'mr';
    await setAppLanguage(next);
  };

  const getStatusBadgeColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('GATE_EXIT') || s.includes('COMPLETED')) return '#059669';
    if (s.includes('PROGRESS') || s.includes('WEIGH') || s.includes('INSPECT')) return '#d97706';
    return '#16a34a';
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleNotificationPress = (item) => {
    setShowNotificationModal(false);
    if (item.screen) {
      if (item.screen === 'SupportTab') {
        navigation.navigate('SupportTab');
      } else {
        navigation.navigate(item.screen, item.params || {});
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header Bar */}
        <View style={styles.header}>
          {/* Top Utility Row: Branding & Actions */}
          <View style={styles.headerUtilityRow}>
            <View style={styles.headerBrandBadge}>
              <Text style={styles.headerBrandText}>🌾 {t('app_title', 'KisanQ')}</Text>
            </View>

            <View style={styles.headerActions}>
              {/* Notification Bell */}
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => setShowNotificationModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Language Switcher */}
              <TouchableOpacity
                style={styles.langButton}
                onPress={handleLanguageCycle}
                activeOpacity={0.7}
              >
                <Text style={styles.langButtonText}>
                  🌐 {i18n.language === 'mr' ? 'मराठी' : i18n.language === 'hi' ? 'हिंदी' : 'EN'}
                </Text>
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={() => {
                  Alert.alert(t('logout'), 'Are you sure you want to log out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: t('logout'), style: 'destructive', onPress: logout }
                  ]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutText}>🚪</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Row: Full-Width Farmer Info & Welcome Greeting */}
          <View style={styles.farmerProfileRow}>
            <Text style={styles.greeting}>{t('welcome')}</Text>
            <Text style={styles.farmerName} numberOfLines={1}>
              {user?.name || 'शेतकरी मित्र'}
            </Text>
            <View style={styles.phoneBadge}>
              <Text style={styles.farmerPhone}>+91 {user?.phone || '9876543210'}</Text>
              <Text style={styles.verifiedCheck}>✓ Verified</Text>
            </View>
          </View>
        </View>

        {/* Offline Banner Notification */}
        {isOffline && (
          <View style={styles.offlineBannerWrapper}>
            <OfflineBanner onRetry={fetchDashboardData} />
          </View>
        )}

        {/* Hero Card: Active Token or Booking CTA */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} size="small" />
          </View>
        ) : activeToken ? (
          <View style={styles.activeTokenCard}>
            <View style={styles.tokenCardHeader}>
              <View>
                <Text style={styles.activeLabel}>{t('active_booking_title')}</Text>
                <Text style={styles.tokenNumber}>{activeToken.tokenNumber}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: getStatusBadgeColor(activeToken.status) }
                ]}
              >
                <Text style={styles.statusPillText}>
                  {activeToken.status || 'BOOKED'}
                </Text>
              </View>
            </View>

            <View style={styles.tokenDetailsGrid}>
              <View style={styles.tokenDetailCol}>
                <Text style={styles.tokenDetailLabel}>{t('centres')}</Text>
                <Text style={styles.tokenDetailValue}>
                  {activeToken.mandiName || 'APMC Kopargaon'}
                </Text>
              </View>
              <View style={styles.tokenDetailCol}>
                <Text style={styles.tokenDetailLabel}>{t('crop_label', 'पीक / Crop')}</Text>
                <Text style={styles.tokenDetailValue}>
                  {activeToken.crop} ({activeToken.quantity} Qtl)
                </Text>
              </View>
              <View style={styles.tokenDetailCol}>
                <Text style={styles.tokenDetailLabel}>{t('slot_label', 'वेळ / Slot')}</Text>
                <Text style={styles.tokenDetailValue}>
                  {activeToken.slotLabel || activeToken.slotTime || '08:00 AM - 10:00 AM'}
                </Text>
              </View>
              <View style={styles.tokenDetailCol}>
                <Text style={styles.tokenDetailLabel}>{t('date_label', 'तारीख / Date')}</Text>
                <Text style={styles.tokenDetailValue}>
                  {activeToken.slotDate || 'Today'}
                </Text>
              </View>
            </View>

            <View style={styles.tokenCardActions}>
              <TouchableOpacity
                style={styles.primaryPassButton}
                onPress={() =>
                  navigation.navigate('TokenDetails', { token: activeToken })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.primaryPassButtonText}>
                  🎟️ {t('view_qr_pass')} →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryQueueButton}
                onPress={() =>
                  navigation.navigate('LiveQueue', { token: activeToken })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryQueueButtonText}>
                  🚦 {t('live_queue_btn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noTokenCard}>
            <View style={styles.noTokenLeft}>
              <Text style={styles.noTokenTitle}>
                {t('no_active_booking_title')}
              </Text>
              <Text style={styles.noTokenSub}>
                {t('no_active_booking_sub')}
              </Text>
              <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => navigation.navigate('Book')}
                activeOpacity={0.8}
              >
                <Text style={styles.bookNowButtonText}>
                  📅 {t('book_slot_now')} →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live Mandi MSP & Commodity Rates Ticker */}
        <View style={styles.pricesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📈 {t('live_prices_title')}</Text>
            <Text style={styles.liveIndicator}>● LIVE APMC</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pricesScroll}
          >
            {cropPrices.map((item, idx) => {
              const diff = (item.marketPriceToday || 0) - (item.marketPriceYesterday || item.mspPrice || 0);
              const isUp = diff >= 0;
              const icon = CROP_ICONS[item.crop] || '🌾';
              return (
                <View key={idx} style={styles.priceCard}>
                  <View style={styles.priceCardHeader}>
                    <Text style={styles.cropIcon}>{icon}</Text>
                    <Text style={styles.cropName}>{item.crop}</Text>
                  </View>

                  <View style={styles.priceMain}>
                    <Text style={styles.todayPrice}>₹{item.marketPriceToday || item.mspPrice}</Text>
                    <Text style={styles.priceUnit}>/ Qtl</Text>
                  </View>

                  <View style={styles.priceSubRow}>
                    <Text style={styles.mspLabel}>MSP: ₹{item.mspPrice}</Text>
                    <Text style={[styles.trendBadge, isUp ? styles.trendUp : styles.trendDown]}>
                      {isUp ? `+₹${diff}` : `-₹${Math.abs(diff)}`} {isUp ? '▲' : '▼'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Quick Mandi Services Grid */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>⚡ {t('quick_services')}</Text>
          <View style={styles.gridContainer}>
            <TouchableOpacity
              style={styles.gridTile}
              onPress={() => navigation.navigate('Centres')}
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#dbeafe' }]}>
                <Text style={styles.gridIcon}>📍</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_centres')}</Text>
              <Text style={styles.gridSub}>{t('service_centres_sub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridTile}
              onPress={() => navigation.navigate('Book')}
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.gridIcon}>📅</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_book')}</Text>
              <Text style={styles.gridSub}>{t('service_book_sub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridTile}
              onPress={() =>
                navigation.navigate('TokenDetails', { token: activeToken })
              }
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#fef3c7' }]}>
                <Text style={styles.gridIcon}>🎟️</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_token')}</Text>
              <Text style={styles.gridSub}>{t('service_token_sub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridTile}
              onPress={() =>
                navigation.navigate('LiveQueue', { token: activeToken })
              }
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#fee2e2' }]}>
                <Text style={styles.gridIcon}>🚦</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_queue')}</Text>
              <Text style={styles.gridSub}>{t('service_queue_sub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridTile}
              onPress={() => navigation.navigate('ProcurementTimeline')}
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#e0e7ff' }]}>
                <Text style={styles.gridIcon}>📊</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_timeline')}</Text>
              <Text style={styles.gridSub}>{t('service_timeline_sub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridTile}
              onPress={() => navigation.navigate('PayoutStatus')}
              activeOpacity={0.7}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: '#fae8ff' }]}>
                <Text style={styles.gridIcon}>💳</Text>
              </View>
              <Text style={styles.gridTitle}>{t('service_payout')}</Text>
              <Text style={styles.gridSub}>{t('service_payout_sub')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Notification Center Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        notifications={notifications}
        onNotificationPress={handleNotificationPress}
        onClearAll={() => setNotifications([])}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primaryDark
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    paddingBottom: 24
  },
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24
  },
  headerUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerBrandBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  headerBrandText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  },
  bellButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  bellIcon: {
    fontSize: 16
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800'
  },
  langButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  langButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10
  },
  logoutText: {
    fontSize: 13
  },
  farmerProfileRow: {
    marginTop: 2
  },
  greeting: {
    fontSize: 13,
    color: '#bbf7d0',
    fontWeight: '600',
    marginBottom: 2
  },
  farmerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  farmerPhone: {
    fontSize: 13,
    color: '#dcfce7',
    fontWeight: '500'
  },
  verifiedCheck: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86efac',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  offlineBannerWrapper: {
    paddingHorizontal: 16,
    marginTop: -10,
    marginBottom: 4
  },
  loadingCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: -16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 3
  },
  activeTokenCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: -16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4
  },
  tokenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10
  },
  activeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  tokenNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.5
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  tokenDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    marginBottom: 16
  },
  tokenDetailCol: {
    width: '50%'
  },
  tokenDetailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 2
  },
  tokenDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  tokenCardActions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryPassButton: {
    flex: 1.2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryPassButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  secondaryQueueButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  secondaryQueueButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700'
  },
  noTokenCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: -16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3
  },
  noTokenLeft: {
    alignItems: 'flex-start'
  },
  noTokenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4
  },
  noTokenSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 14
  },
  bookNowButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10
  },
  bookNowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  pricesSection: {
    marginTop: 22,
    paddingHorizontal: 16
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text
  },
  liveIndicator: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  pricesScroll: {
    gap: 12,
    paddingRight: 16
  },
  priceCard: {
    backgroundColor: COLORS.surface,
    width: 150,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  priceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  cropIcon: {
    fontSize: 18
  },
  cropName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  priceMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6
  },
  todayPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark
  },
  priceUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 2
  },
  priceSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mspLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  trendBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4
  },
  trendUp: {
    color: '#059669',
    backgroundColor: '#dcfce7'
  },
  trendDown: {
    color: '#dc2626',
    backgroundColor: '#fee2e2'
  },
  servicesSection: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 12
  },
  gridTile: {
    backgroundColor: COLORS.surface,
    width: '48%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  gridIcon: {
    fontSize: 20
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2
  },
  gridSub: {
    fontSize: 11,
    color: COLORS.textMuted
  }
});
