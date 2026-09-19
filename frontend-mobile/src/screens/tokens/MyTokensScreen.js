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
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import { COLORS, isTokenActive } from '../../utils/constants';
import OfflineBanner from '../../components/OfflineBanner';

const CROP_ICONS = {
  Soybean: '🌱',
  Cotton: '⚪',
  Wheat: '🌾',
  Onion: '🧅',
  Maize: '🌽',
  Chana: '🟤',
  Gram: '🟤'
};

export default function MyTokensScreen({ navigation }) {
  const { t, i18n } = useTranslation();

  const [activeToken, setActiveToken] = useState(null);
  const [historyTokens, setHistoryTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchTokens = useCallback(async () => {
    let networkFailed = false;

    try {
      const res = await client.get('/tokens/my-tokens').catch((err) => {
        networkFailed = true;
        return null;
      });

      if (res?.data) {
        setIsOffline(false);
        const allTokens = Array.isArray(res.data.tokens) ? res.data.tokens : [];

        // Genuine active token selection reusing standard isTokenActive() helper
        let active = null;
        if (res.data.activeToken && isTokenActive(res.data.activeToken)) {
          active = res.data.activeToken;
        } else {
          active = allTokens.find((tok) => isTokenActive(tok)) || null;
        }

        // History tokens are all completed, cancelled, or inactive tokens
        const past = allTokens.filter((tok) => !isTokenActive(tok));

        setActiveToken(active);
        setHistoryTokens(past);

        // Cache both for offline resilience
        await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, active);
        await Storage.setJson(Storage.ASYNC_KEYS.ALL_TOKENS, allTokens);
      } else {
        // Fallback to offline cached storage
        setIsOffline(true);
        const cachedActive = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
        const cachedAll = await Storage.getJson(Storage.ASYNC_KEYS.ALL_TOKENS);

        if (cachedActive && isTokenActive(cachedActive)) {
          setActiveToken(cachedActive);
        } else {
          setActiveToken(null);
        }

        if (Array.isArray(cachedAll)) {
          setHistoryTokens(cachedAll.filter((tok) => !isTokenActive(tok)));
        } else {
          setHistoryTokens([]);
        }
      }
    } catch (err) {
      console.warn('[MyTokensScreen] Fetch error:', err.message);
      setIsOffline(true);
      const cachedActive = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
      const cachedAll = await Storage.getJson(Storage.ASYNC_KEYS.ALL_TOKENS);

      if (cachedActive && isTokenActive(cachedActive)) {
        setActiveToken(cachedActive);
      } else {
        setActiveToken(null);
      }

      if (Array.isArray(cachedAll)) {
        setHistoryTokens(cachedAll.filter((tok) => !isTokenActive(tok)));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTokens();
  };

  const getStatusBadgeColor = (status) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('GATE_EXIT') || s.includes('COMPLETED')) return '#059669';
    if (s.includes('CANCEL')) return '#dc2626';
    if (s.includes('PROGRESS') || s.includes('WEIGH') || s.includes('INSPECT')) return '#d97706';
    return '#16a34a';
  };

  const getStatusLabel = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'DONE') {
      return i18n.language === 'mr' ? '✓ पूर्ण (Completed)' : i18n.language === 'hi' ? '✓ पूर्ण' : '✓ Completed';
    }
    if (s === 'CANCELLED' || s === 'CANCELED') {
      return i18n.language === 'mr' ? '✕ रद्द (Cancelled)' : i18n.language === 'hi' ? '✕ रद्द' : '✕ Cancelled';
    }
    return status || 'ACTIVE';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {i18n.language === 'mr'
              ? 'टोकन व इतिहास लोड होत आहे...'
              : i18n.language === 'hi'
              ? 'टोकन और इतिहास लोड हो रहा है...'
              : 'Loading tokens & history...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Offline Banner when API unreachable */}
        {isOffline && <OfflineBanner onRetry={fetchTokens} />}

        {/* Screen Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🎟️ {t('tab_my_tokens', 'My Tokens')}</Text>
          <Text style={styles.subtitle}>
            {i18n.language === 'mr'
              ? 'आपले सक्रिय आवक पास व मागील खरेदी इतिहास'
              : i18n.language === 'hi'
              ? 'आपके सक्रिय प्रवेश पास और पुराना खरीद इतिहास'
              : 'Active arrival passes & past procurement history'}
          </Text>
        </View>

        {/* ─── 1. TOP SECTION: ACTIVE TOKEN OR CLEAN EMPTY STATE ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>
            {activeToken
              ? `⚡ ${t('active_booking_title', 'Active Arrival Token Pass')}`
              : `📋 ${t('active_booking_title', 'Active Arrival Token Pass')}`}
          </Text>

          {activeToken ? (
            <View style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <View style={styles.tokenRefCol}>
                  <Text style={styles.activeTokenLabel}>
                    {i18n.language === 'mr' ? 'सक्रिय टोकन क्रमांक' : 'Active Token Number'}
                  </Text>
                  <Text style={styles.activeTokenNumber}>{activeToken.tokenNumber}</Text>
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

              <View style={styles.tokenGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.gridLabel}>{t('centres', 'APMC Mandi')}</Text>
                  <Text style={styles.gridVal} numberOfLines={1}>
                    {activeToken.mandiName || activeToken.mandiId || 'APMC Kopargaon'}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.gridLabel}>{t('crop_label', 'Crop')}</Text>
                  <Text style={styles.gridVal}>
                    {CROP_ICONS[activeToken.crop] || '🌾'} {activeToken.crop} ({activeToken.quantity} Qtl)
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.gridLabel}>{t('slot_label', 'Slot Time')}</Text>
                  <Text style={styles.gridVal}>
                    {activeToken.slotLabel || activeToken.slotTime || '08:00 AM - 10:00 AM'}
                  </Text>
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.gridLabel}>{t('date_label', 'Date')}</Text>
                  <Text style={styles.gridVal}>
                    {activeToken.slotDate || 'Today'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.activeActionsRow}>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => navigation.navigate('TokenDetails', { token: activeToken })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnPrimaryText}>🎟️ {t('view_qr_pass', 'QR Pass')} →</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => navigation.navigate('LiveQueue', { token: activeToken })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnSecondaryText}>🚦 {t('service_queue', 'Queue')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => navigation.navigate('ProcurementTimeline', { token: activeToken })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnSecondaryText}>📊 {t('service_timeline', 'Timeline')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noActiveCard}>
              <View style={styles.noActiveIconCircle}>
                <Text style={styles.noActiveIcon}>🎟️</Text>
              </View>
              <Text style={styles.noActiveTitle}>{t('no_active_booking_title', 'No Active Slot Booking')}</Text>
              <Text style={styles.noActiveSub}>
                {t('no_active_booking_sub', 'Reserve your mandi arrival slot in advance to skip physical queues.')}
              </Text>
              <TouchableOpacity
                style={styles.bookNowBtn}
                onPress={() => navigation.navigate('CentresTab')}
                activeOpacity={0.85}
              >
                <Text style={styles.bookNowBtnText}>📅 {t('book_slot_now', 'Book Slot Now')} →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── 2. BOTTOM SECTION: SCROLLABLE TOKEN HISTORY LIST ─── */}
        <View style={[styles.section, { marginTop: 10 }]}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionHeading}>
              📜 {i18n.language === 'mr' ? 'मागील टोकन व इतिहास' : i18n.language === 'hi' ? 'पिछला टोकन इतिहास' : 'Past Tokens & History'}
            </Text>
            {historyTokens.length > 0 && (
              <Text style={styles.historyCountBadge}>{historyTokens.length}</Text>
            )}
          </View>

          {historyTokens.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryIcon}>📂</Text>
              <Text style={styles.emptyHistoryText}>
                {i18n.language === 'mr'
                  ? 'कोणताही मागील टोकन इतिहास उपलब्ध नाही.'
                  : i18n.language === 'hi'
                  ? 'कोई पुराना टोकन इतिहास उपलब्ध नहीं है।'
                  : 'No past token history found.'}
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {historyTokens.map((item, idx) => {
                const isItemCompleted =
                  item.status === 'Completed' ||
                  item.status === 'COMPLETED' ||
                  item.stages?.[4]?.status?.toLowerCase() === 'completed';
                const isItemCancelled =
                  item.status === 'Cancelled' ||
                  item.status === 'CANCELLED';

                const cropIcon = CROP_ICONS[item.crop] || '🌾';
                const finalAmt =
                  item.stages?.[4]?.totalAmount ||
                  item.stages?.[4]?.details?.totalPaid ||
                  item.stages?.[3]?.totalAmount ||
                  (item.quantity ? item.quantity * 4892 : null);

                return (
                  <TouchableOpacity
                    key={item.tokenNumber || item._id || idx}
                    style={styles.historyCard}
                    onPress={() => {
                      if (isItemCompleted) {
                        navigation.navigate('PayoutStatus', { token: item });
                      } else {
                        navigation.navigate('TokenDetails', { token: item });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyCardTop}>
                      <View style={styles.historyTitleBlock}>
                        <View style={styles.cropIconBadge}>
                          <Text style={styles.historyCropIcon}>{cropIcon}</Text>
                        </View>
                        <View style={styles.historyNameCol}>
                          <Text style={styles.historyCropName}>
                            {item.crop} ({item.quantity} Qtl)
                          </Text>
                          <Text style={styles.historyMandiName}>
                            🏛️ {item.mandiName || item.mandiId || 'APMC Mandi'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.historyStatusPill,
                          isItemCompleted
                            ? styles.pillCompleted
                            : isItemCancelled
                            ? styles.pillCancelled
                            : styles.pillDefault
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyStatusText,
                            isItemCompleted
                              ? styles.textCompleted
                              : isItemCancelled
                              ? styles.textCancelled
                              : styles.textDefault
                          ]}
                        >
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyDivider} />

                    <View style={styles.historyCardBottom}>
                      <Text style={styles.historyDate}>
                        📅 {item.slotDate || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Past Slot')}
                      </Text>

                      {finalAmt && isItemCompleted ? (
                        <Text style={styles.historyAmount}>
                          ₹{Number(finalAmt).toLocaleString('en-IN')}
                        </Text>
                      ) : (
                        <Text style={styles.historyTokenNo}>
                          {item.tokenNumber}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
    paddingBottom: 32
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600'
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
  section: {
    marginBottom: 16
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  activeCard: {
    backgroundColor: COLORS.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14
  },
  tokenRefCol: {
    flex: 1,
    marginRight: 8
  },
  activeTokenLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  activeTokenNumber: {
    fontSize: 18,
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
  tokenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    marginBottom: 16
  },
  gridCol: {
    width: '50%'
  },
  gridLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 2
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  btnPrimary: {
    flex: 1.4,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  btnSecondaryText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700'
  },
  noActiveCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  noActiveIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  noActiveIcon: {
    fontSize: 26
  },
  noActiveTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4
  },
  noActiveSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12
  },
  bookNowBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center'
  },
  bookNowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  historyCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  emptyHistoryCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center'
  },
  emptyHistoryIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyHistoryText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  historyList: {
    gap: 10
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  historyTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  cropIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  historyCropIcon: {
    fontSize: 18
  },
  historyNameCol: {
    flex: 1
  },
  historyCropName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text
  },
  historyMandiName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1
  },
  historyStatusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  pillCompleted: {
    backgroundColor: '#dcfce7'
  },
  pillCancelled: {
    backgroundColor: '#fee2e2'
  },
  pillDefault: {
    backgroundColor: '#f1f5f9'
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '800'
  },
  textCompleted: {
    color: '#15803d'
  },
  textCancelled: {
    color: '#b91c1c'
  },
  textDefault: {
    color: COLORS.textMuted
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 8
  },
  historyCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  historyDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669'
  },
  historyTokenNo: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: 'monospace'
  }
});
