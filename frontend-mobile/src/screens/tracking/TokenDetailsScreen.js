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
  Alert,
  Share
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../utils/constants';

export default function TokenDetailsScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const passedToken = route.params?.token;

  const [token, setToken] = useState(passedToken || null);
  const [loading, setLoading] = useState(!passedToken);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchTokenDetails = useCallback(async () => {
    try {
      let activeTok = passedToken;

      if (!activeTok) {
        // Look up cached active token first
        const cached = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
        if (cached) {
          activeTok = cached;
          setToken(cached);
        }
      }

      // Fetch fresh token details from backend
      const res = await client.get('/tokens/my-tokens').catch(() => {
        setIsOffline(true);
        return null;
      });
      if (res?.data) {
        setIsOffline(false);
        const found =
          res.data.activeToken ||
          (res.data.tokens && res.data.tokens.length > 0 ? res.data.tokens[0] : null);

        if (found) {
          activeTok = found;
          setToken(found);
          await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, found);
        }
      }

      // If token exists, fetch cancellation preview policy
      if (activeTok?.tokenNumber) {
        const prevRes = await client
          .get(`/tokens/${activeTok.tokenNumber}/cancellation-preview`)
          .catch(() => null);
        if (prevRes?.data?.penaltyInfo) {
          setCancellationInfo(prevRes.data.penaltyInfo);
        }
      }
    } catch (err) {
      console.warn('[TokenDetails] Fetch error:', err.message);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [passedToken]);

  useEffect(() => {
    fetchTokenDetails();
  }, [fetchTokenDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTokenDetails();
  };

  const getQrPayload = () => {
    if (!token) return 'KISANQ_TOKEN_PASS';
    return JSON.stringify({
      tokenNumber: token.tokenNumber,
      farmerPhone: token.farmerPhone || token.phone,
      farmerName: token.farmerName,
      mandiId: token.mandiId || token.mandiCode,
      crop: token.crop,
      quantity: token.quantity,
      slotDate: token.slotDate,
      slotLabel: token.slotLabel || token.slotTime,
      vehicleNumber: token.vehicleNumber
    });
  };

  const handleShareToken = async () => {
    if (!token) return;
    try {
      await Share.share({
        title: `KisanQ Digital Pass - ${token.tokenNumber}`,
        message: `🌾 KisanQ APMC Slot Pass\nToken: ${token.tokenNumber}\nMandi: ${token.mandiName}\nCrop: ${token.crop} (${token.quantity} Qtl)\nDate: ${token.slotDate} (${token.slotLabel || token.slotTime})\nStatus: ${token.status}`
      });
    } catch (e) {}
  };

  const handleCancelBooking = () => {
    if (!token) return;

    const penaltyFee = cancellationInfo?.penalty ? `₹${cancellationInfo.penalty}` : '₹0 (Free)';
    const reasonText = cancellationInfo?.explanation || 'Standard cancellation policy applies.';

    Alert.alert(
      'स्लॉट रद्द करा (Cancel Booking)',
      `रद्द शुल्क / Cancellation Fee: ${penaltyFee}\n${reasonText}\n\nआपण खरोखर हा स्लॉट रद्द करू इच्छिता?`,
      [
        { text: 'मागे फिरा (Keep Slot)', style: 'cancel' },
        {
          text: 'रद्द करा (Confirm Cancel)',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await client.post(`/tokens/${token.tokenNumber}/cancel`, {
                reason: 'Farmer cancelled via mobile app'
              });
              await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, null);
              Alert.alert('यशस्वी', 'स्लॉट रद्द झाला आहे.', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('HomeScreen')
                }
              ]);
            } catch (err) {
              Alert.alert(
                'त्रुटी',
                err.response?.data?.message || 'Cancellation failed.'
              );
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>डिजिटल पास लोड होत आहे...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.noTokenIcon}>🎟️</Text>
          <Text style={styles.noTokenTitle}>कोणतेही सक्रिय टोकन सापडले नाही</Text>
          <Text style={styles.noTokenSub}>
            आपल्याकडे सध्या कोणतेही चालू बुकिंग नाही. नवीन स्लॉट बुक करा.
          </Text>
          <TouchableOpacity
            style={styles.bookSlotBtn}
            onPress={() => navigation.navigate('Book')}
          >
            <Text style={styles.bookSlotBtnText}>📅 स्लॉट बुक करा →</Text>
          </TouchableOpacity>
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
        {/* Offline Banner when network disconnected */}
        {isOffline && <OfflineBanner onRetry={fetchTokenDetails} />}

        {/* Offline Badge & Share Header */}
        <View style={styles.topActionsRow}>
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>⚡ OFFLINE PASS READY</Text>
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareToken}>
            <Text style={styles.shareBtnText}>📤 शेअर करा (Share)</Text>
          </TouchableOpacity>
        </View>

        {/* Main Digital Ticket Pass Card */}
        <View style={styles.ticketCard}>
          {/* Ticket Header */}
          <View style={styles.ticketHeader}>
            <View style={styles.ticketHeaderLeft}>
              <Text style={styles.apmcTitle}>{token.mandiName || 'APMC Kopargaon'}</Text>
              <Text style={styles.mandiLocation}>
                {token.mandiId || 'KPG-01'} · Maharashtra APMC
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                token.status === 'Completed'
                  ? styles.statusCompleted
                  : token.status === 'Cancelled'
                  ? styles.statusCancelled
                  : styles.statusActive
              ]}
            >
              <Text style={styles.statusText}>{token.status || 'BOOKED'}</Text>
            </View>
          </View>

          {/* Token Number Display */}
          <View style={styles.tokenNumberBox}>
            <Text style={styles.tokenLabel}>डिजिटल टोकन क्रमांक (Token Number)</Text>
            <Text style={styles.tokenValue}>{token.tokenNumber}</Text>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrSection}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={getQrPayload()}
                size={180}
                color="#0f172a"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={styles.qrInstruction}>
              📲 गेट १ सुरक्षा रक्षकास हा QR कोड दाखवा
            </Text>
            <Text style={styles.qrSub}>
              Scan at APMC Security Gate 01 for ANPR intake & check-in
            </Text>
          </View>

          {/* Dotted Tear Line */}
          <View style={styles.dottedLine} />

          {/* Booking Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>शेतकऱ्याचे नाव / Farmer</Text>
              <Text style={styles.detailVal}>{token.farmerName || 'Mahesh Borde'}</Text>
            </View>

            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>पीक व प्रमाण / Crop & Qty</Text>
              <Text style={styles.detailVal}>
                {token.crop} ({token.quantity} Qtl)
              </Text>
            </View>

            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>आवक वेळ / Slot Time</Text>
              <Text style={styles.detailVal}>
                {token.slotLabel || token.slotTime || '08:00 AM - 10:00 AM'}
              </Text>
            </View>

            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>आवक तारीख / Slot Date</Text>
              <Text style={styles.detailVal}>{token.slotDate || 'Today'}</Text>
            </View>

            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>वाहतूक साधन / Vehicle</Text>
              <Text style={styles.detailVal}>
                {token.vehicleType || 'Tractor'} ({token.vehicleNumber || 'MH-17-AB-1234'})
              </Text>
            </View>

            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>मोबाइल / Mobile</Text>
              <Text style={styles.detailVal}>
                +91 {token.farmerPhone || token.phone || '9876543210'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Navigation Cards to Live Queue, Timeline & Payout */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
            onPress={() => navigation.navigate('LiveQueue', { token })}
            activeOpacity={0.8}
          >
            <Text style={styles.navCardIcon}>🚦</Text>
            <Text style={styles.navCardTitle}>
              {i18n.language === 'mr' ? 'थेट रांग' : 'Live Queue'}
            </Text>
            <Text style={styles.navCardSub}>
              {i18n.language === 'mr' ? 'रांग ट्रॅकर →' : 'Live Status →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navCard, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}
            onPress={() => navigation.navigate('ProcurementTimeline', { token })}
            activeOpacity={0.8}
          >
            <Text style={styles.navCardIcon}>📊</Text>
            <Text style={styles.navCardTitle}>
              {i18n.language === 'mr' ? '५-टप्पे टाइमलाइन' : '5-Stage Pipeline'}
            </Text>
            <Text style={styles.navCardSub}>
              {i18n.language === 'mr' ? 'प्रक्रिया पाहा →' : 'Timeline →'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.payoutNavCard}
          onPress={() => navigation.navigate('PayoutStatus', { token })}
          activeOpacity={0.8}
        >
          <View style={styles.payoutNavLeft}>
            <Text style={styles.payoutNavIcon}>💳</Text>
            <View>
              <Text style={styles.payoutNavTitle}>DBT बँक जमा व पावती</Text>
              <Text style={styles.payoutNavSub}>Payout & Settlement Receipt</Text>
            </View>
          </View>
          <Text style={styles.payoutNavArrow}>→</Text>
        </TouchableOpacity>

        {/* Cancellation Section (Pre-Gate Only) */}
        {token.status !== 'Completed' && token.status !== 'Cancelled' && (
          <View style={styles.cancellationBox}>
            <Text style={styles.cancellationHeader}>स्लॉट रद्द धोरण (Cancellation Policy)</Text>
            <Text style={styles.cancellationText}>
              {cancellationInfo?.explanation ||
                'Free cancellation > 2 hours prior to scheduled slot. Nominal convenience fee applies within 2 hours.'}
            </Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelBooking}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#dc2626" size="small" />
              ) : (
                <Text style={styles.cancelBtnText}>✕ स्लॉट रद्द करा (Cancel Slot)</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  centerContainer: {
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
  noTokenIcon: {
    fontSize: 54,
    marginBottom: 12
  },
  noTokenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6
  },
  noTokenSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20
  },
  bookSlotBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10
  },
  bookSlotBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  offlineBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  offlineBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  shareBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  shareBtnText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700'
  },
  ticketCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    overflow: 'hidden'
  },
  ticketHeader: {
    backgroundColor: '#f8fafc',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8
  },
  ticketHeaderLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 6
  },
  apmcTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    flexShrink: 1
  },
  mandiLocation: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexShrink: 0
  },
  statusActive: {
    backgroundColor: '#16a34a'
  },
  statusCompleted: {
    backgroundColor: '#059669'
  },
  statusCancelled: {
    backgroundColor: '#dc2626'
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  tokenNumberBox: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7'
  },
  tokenLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2
  },
  tokenValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 1
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 20
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  },
  qrInstruction: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2
  },
  qrSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  dottedLine: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginHorizontal: 12
  },
  detailsGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10
  },
  detailCol: {
    width: '50%',
    minHeight: 46,
    paddingRight: 6,
    marginBottom: 4
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 2,
    minHeight: 16
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  navCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  navCardIcon: {
    fontSize: 22,
    marginBottom: 4
  },
  navCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2
  },
  navCardSub: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '700'
  },
  payoutNavCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  payoutNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  payoutNavIcon: {
    fontSize: 26
  },
  payoutNavTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text
  },
  payoutNavSub: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  payoutNavArrow: {
    fontSize: 18,
    color: COLORS.primaryDark,
    fontWeight: '800'
  },
  cancellationBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 14,
    borderRadius: 12
  },
  cancellationHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9f1239',
    marginBottom: 4
  },
  cancellationText: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 16,
    marginBottom: 10
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  cancelBtnText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700'
  }
});
