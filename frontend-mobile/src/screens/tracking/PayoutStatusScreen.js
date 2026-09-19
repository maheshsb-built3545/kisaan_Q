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
  Share
} from 'react-native';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { Storage } from '../../utils/storage';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../utils/constants';

export default function PayoutStatusScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const passedToken = route.params?.token;

  const [token, setToken] = useState(passedToken || null);
  const [loading, setLoading] = useState(!passedToken);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchPayoutDetails = useCallback(async () => {
    try {
      let activeTok = passedToken;

      if (!activeTok) {
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
    } catch (err) {
      console.warn('[PayoutStatus] Fetch error:', err.message);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [passedToken]);

  useEffect(() => {
    fetchPayoutDetails();
  }, [fetchPayoutDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayoutDetails();
  };

  const qty = parseFloat(token?.stages?.[2]?.weight || token?.stages?.[2]?.details?.netProduceQtl || token?.quantity) || 25;
  const ratePerQtl = Number(token?.stages?.[3]?.details?.ratePerQtl) || 4892;
  const grossAmount = token?.stages?.[3]?.totalAmount || token?.stages?.[3]?.details?.totalAmount || (qty * ratePerQtl);
  const cess = token?.stages?.[3]?.details?.cess || 0;
  const duesDeducted = token?.stages?.[4]?.details?.duesDeducted || 0;
  const netAmount = token?.stages?.[4]?.totalAmount || token?.stages?.[4]?.details?.totalPaid || Math.max(0, grossAmount - cess - duesDeducted);

  const isCompleted =
    token?.status === 'Completed' ||
    token?.stages?.[4]?.status?.toLowerCase() === 'completed';

  const isAuthorized =
    token?.status === 'PROCUREMENT' ||
    token?.currentStageIndex >= 4;

  const getPaymentStatusInfo = () => {
    if (isCompleted) {
      return {
        statusKey: 'payment_confirmed',
        title: i18n.language === 'mr' ? 'DBT भरणा पूर्ण (Payment Confirmed)' : 'Payment Confirmed',
        sub: i18n.language === 'mr' ? 'रक्कम DBT द्वारे जमा झाली आहे.' : 'Payment has been settled via DBT.',
        badgeColor: '#059669',
        badgeBg: '#dcfce7',
        icon: '✅'
      };
    }
    if (isAuthorized) {
      return {
        statusKey: 'payment_initiated',
        title: i18n.language === 'mr' ? 'DBT प्रक्रिया सुरू (Payment Initiated)' : 'Payment Initiated (DBT)',
        sub: i18n.language === 'mr' ? 'खरेदी पावती मान्य झाली असून DBT प्रक्रिया सुरू आहे.' : 'Procurement approved. Treasury DBT clearance in progress.',
        badgeColor: '#d97706',
        badgeBg: '#fef3c7',
        icon: '⏳'
      };
    }
    return {
      statusKey: 'procurement_approved',
      title: i18n.language === 'mr' ? 'खरेदी प्रक्रिया सुरू (In Progress)' : 'Procurement Intake In Progress',
      sub: i18n.language === 'mr' ? 'वजन व दर निश्चितीनंतर अंतिम DBT रक्कम जमा होईल.' : 'Net DBT amount will settle upon weighment and price confirmation.',
      badgeColor: '#2563eb',
      badgeBg: '#eff6ff',
      icon: 'ℹ️'
    };
  };

  const statusInfo = getPaymentStatusInfo();
  const paymentTimestamp =
    token?.stages?.[4]?.completedAt ||
    token?.stages?.[4]?.timestamp ||
    token?.updatedAt ||
    null;

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        title: `KisanQ DBT Settlement Receipt - ${token?.tokenNumber || 'KQ-PASS'}`,
        message: `🌾 KisanQ APMC Settlement Receipt\nToken: ${token?.tokenNumber}\nMandi: ${token?.mandiName}\nCrop: ${token?.crop} (${qty} Qtl @ ₹${ratePerQtl}/Qtl)\nGross Amount: ₹${grossAmount.toLocaleString('en-IN')}\nMarket Cess: -₹${cess}\nNet DBT Payout: ₹${netAmount.toLocaleString('en-IN')}\nPayment Channel: Direct Bank Transfer (DBT)\nStatus: ${statusInfo.title}`
      });
    } catch (e) {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>पेमेंट पावती लोड होत आहे...</Text>
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
        {/* Offline Banner */}
        {isOffline && <OfflineBanner onRetry={fetchPayoutDetails} />}

        {/* Settlement Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: statusInfo.badgeBg, borderColor: statusInfo.badgeColor }
          ]}
        >
          <Text style={styles.statusBannerIcon}>{statusInfo.icon}</Text>
          <View style={styles.statusBannerTextCol}>
            <Text style={[styles.statusBannerTitle, { color: statusInfo.badgeColor }]}>
              {statusInfo.title}
            </Text>
            <Text style={styles.statusBannerSub}>{statusInfo.sub}</Text>
          </View>
        </View>

        {/* Financial Settlement Breakdown Card */}
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptTitle}>
              🧾 {i18n.language === 'mr' ? 'अंतिम ई-खरेदी पावती' : 'Final Procurement E-Receipt'}
            </Text>
            <Text style={styles.tokenRef}>
              {token?.tokenNumber || 'KQ-KPG-2026-5809'}
            </Text>
          </View>

          {/* Amount Line Items */}
          <View style={styles.lineItemsContainer}>
            <View style={styles.lineItemRow}>
              <View style={styles.lineItemLeft}>
                <Text style={styles.lineItemTitle}>
                  {token?.crop || 'Soybean'} ({qty} Qtl @ ₹{ratePerQtl}/Qtl)
                </Text>
                <Text style={styles.lineItemSub}>हमीभाव / Confirmed Rate</Text>
              </View>
              <Text style={styles.lineItemAmount}>
                ₹{grossAmount.toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.lineItemRow}>
              <View style={styles.lineItemLeft}>
                <Text style={styles.lineItemTitle}>बाजार उपकर / APMC Cess</Text>
                <Text style={styles.lineItemSub}>Statutory Handling</Text>
              </View>
              <Text style={styles.lineItemDeduct}>
                -₹{cess.toLocaleString('en-IN')}
              </Text>
            </View>

            {duesDeducted > 0 && (
              <View style={styles.lineItemRow}>
                <View style={styles.lineItemLeft}>
                  <Text style={styles.lineItemTitle}>रद्द शुल्क / Dues Deducted</Text>
                  <Text style={styles.lineItemSub}>Previous Cancellation Fee</Text>
                </View>
                <Text style={styles.lineItemDeduct}>
                  -₹{duesDeducted.toLocaleString('en-IN')}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Total Net Payable */}
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>एकूण जमा रक्कम (Net Payout)</Text>
                <Text style={styles.totalSub}>Direct DBT Transfer</Text>
              </View>
              <Text style={styles.totalAmount}>
                ₹{netAmount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy-Compliant DBT Payment Lifecycle Info */}
        <View style={styles.dbtChannelCard}>
          <Text style={styles.dbtSectionTitle}>
            💳 {i18n.language === 'mr' ? 'डीबीटी भरणा तपशील' : 'Payment Status & Channel'}
          </Text>

          <View style={styles.dbtDetailsGrid}>
            <View style={styles.dbtDetailCol}>
              <Text style={styles.dbtLabel}>भरणा प्रकार / Channel</Text>
              <Text style={styles.dbtVal}>Direct Bank Transfer (DBT)</Text>
            </View>

            <View style={styles.dbtDetailCol}>
              <Text style={styles.dbtLabel}>स्थिती / Payment Status</Text>
              <Text style={[styles.dbtVal, { color: statusInfo.badgeColor }]}>
                {statusInfo.statusKey}
              </Text>
            </View>

            <View style={styles.dbtDetailCol}>
              <Text style={styles.dbtLabel}>वितरण स्रोत / Source</Text>
              <Text style={styles.dbtVal}>APMC Mandi Treasury / PFMS</Text>
            </View>

            <View style={styles.dbtDetailCol}>
              <Text style={styles.dbtLabel}>तारीख व वेळ / Timestamp</Text>
              <Text style={styles.dbtVal}>
                {paymentTimestamp
                  ? new Date(paymentTimestamp).toLocaleString()
                  : 'Pending Settlement'}
              </Text>
            </View>
          </View>
        </View>

        {/* Share Receipt Action */}
        <TouchableOpacity
          style={styles.shareReceiptBtn}
          onPress={handleShareReceipt}
          activeOpacity={0.8}
        >
          <Text style={styles.shareReceiptBtnText}>
            📄 ई-पावती शेअर करा (Share Official E-Receipt)
          </Text>
        </TouchableOpacity>
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
    gap: 12
  },
  statusBannerIcon: {
    fontSize: 28
  },
  statusBannerTextCol: {
    flex: 1
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2
  },
  statusBannerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16
  },
  receiptCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14
  },
  receiptTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text
  },
  tokenRef: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  lineItemsContainer: {
    gap: 12
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  lineItemLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 8
  },
  lineItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1
  },
  lineItemSub: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  lineItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    flexShrink: 0
  },
  lineItemDeduct: {
    fontSize: 14,
    fontWeight: '800',
    color: '#dc2626',
    flexShrink: 0
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  totalSub: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark
  },
  dbtChannelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16
  },
  dbtSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12
  },
  dbtDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12
  },
  dbtDetailCol: {
    width: '50%',
    minHeight: 52,
    paddingRight: 6,
    marginBottom: 4
  },
  dbtLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 2,
    minHeight: 16
  },
  dbtVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text
  },
  shareReceiptBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  shareReceiptBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  }
});
