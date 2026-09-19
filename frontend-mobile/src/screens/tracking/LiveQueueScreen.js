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
import { getSocket, joinMandiRoom, joinTokenRoom } from '../../api/socket';
import { Storage } from '../../utils/storage';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS, formatQueueRange, formatVehiclesAheadRange } from '../../utils/constants';

export default function LiveQueueScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const passedToken = route.params?.token;

  const [token, setToken] = useState(passedToken || null);
  const [queuePosition, setQueuePosition] = useState(passedToken?.queuePosition || 1);
  const [vehiclesAhead, setVehiclesAhead] = useState(Math.max(0, (passedToken?.queuePosition || 1) - 1));
  const [estimatedWaitMins, setEstimatedWaitMins] = useState(15);
  const [isSocketLive, setIsSocketLive] = useState(false);
  const [loading, setLoading] = useState(!passedToken);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchQueueData = useCallback(async () => {
    try {
      let activeTok = passedToken;

      if (!activeTok) {
        const cached = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
        if (cached) {
          activeTok = cached;
          setToken(cached);
        }
      }

      // 1. Fetch latest token info
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

      // 2. Fetch mandi queue list to compute real-time position
      if (activeTok?.mandiId) {
        const mandiRes = await client
          .get(`/tokens/mandi/${activeTok.mandiId}`)
          .catch(() => null);
        if (mandiRes?.data?.tokens) {
          const list = mandiRes.data.tokens;
          const myIdx = list.findIndex(
            (t) =>
              t.tokenNumber === activeTok.tokenNumber ||
              t.id === activeTok.tokenNumber
          );
          if (myIdx !== -1) {
            const pos = myIdx + 1;
            setQueuePosition(pos);
            setVehiclesAhead(myIdx);
            setEstimatedWaitMins(Math.max(5, myIdx * 8));
          }
        }
      }
    } catch (err) {
      console.warn('[LiveQueue] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [passedToken]);

  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  // Real-Time Socket.IO Subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      setIsSocketLive(socket.connected);

      if (token?.mandiId) joinMandiRoom(token.mandiId);
      if (token?.tokenNumber) joinTokenRoom(token.tokenNumber);

      const handleConnect = () => setIsSocketLive(true);
      const handleDisconnect = () => setIsSocketLive(false);

      const handleQueueUpdate = (data) => {
        if (data?.tokenNumber === token?.tokenNumber && data.queuePosition) {
          setQueuePosition(data.queuePosition);
          setVehiclesAhead(Math.max(0, data.queuePosition - 1));
          setEstimatedWaitMins(Math.max(5, (data.queuePosition - 1) * 8));
        } else {
          fetchQueueData();
        }
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('queue:position_updated', handleQueueUpdate);
      socket.on('queue:stage_updated', handleQueueUpdate);
      socket.on('STAGE_UPDATED', handleQueueUpdate);
      socket.on('queue:slot_freed', fetchQueueData);
      socket.on('QUEUE_SLOT_FREED', fetchQueueData);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('queue:position_updated', handleQueueUpdate);
        socket.off('queue:stage_updated', handleQueueUpdate);
        socket.off('STAGE_UPDATED', handleQueueUpdate);
        socket.off('queue:slot_freed', fetchQueueData);
        socket.off('QUEUE_SLOT_FREED', fetchQueueData);
      };
    }
  }, [token, fetchQueueData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQueueData();
  };

  const getLeaveByRecommendation = () => {
    const slotLabel = token?.slotLabel || token?.slotTime || '08:00 AM - 10:00 AM';
    const match = slotLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

    let targetHour = 8;
    let targetMin = 0;

    if (match) {
      targetHour = parseInt(match[1], 10);
      targetMin = parseInt(match[2], 10);
      const isPM = match[3]?.toUpperCase() === 'PM' && targetHour < 12;
      if (isPM) targetHour += 12;
    }

    const slotDate = new Date();
    slotDate.setHours(targetHour, targetMin, 0, 0);

    // Recommend departure 35 mins prior
    const leaveDate = new Date(slotDate.getTime() - 35 * 60 * 1000);
    const leaveHours = leaveDate.getHours() % 12 || 12;
    const leaveMins = String(leaveDate.getMinutes()).padStart(2, '0');
    const ampm = leaveDate.getHours() >= 12 ? 'PM' : 'AM';

    return `${String(leaveHours).padStart(2, '0')}:${leaveMins} ${ampm}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>थेट रांग स्थिती जोडली जात आहे...</Text>
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
        {isOffline && <OfflineBanner onRetry={fetchQueueData} />}

        {/* Socket Status Indicator Header */}
        <View style={styles.socketStatusRow}>
          <View style={styles.liveIndicatorPill}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: isSocketLive ? '#10b981' : '#f59e0b' }
              ]}
            />
            <Text style={styles.liveIndicatorText}>
              {isSocketLive ? '● LIVE YARD SYNC' : '● CONNECTING...'}
            </Text>
          </View>

          <Text style={styles.tokenRefText}>
            टोकन: {token?.tokenNumber || 'KQ-ACTIVE'}
          </Text>
        </View>

        {/* Hero Live Queue Position Card */}
        <View style={styles.queueHeroCard}>
          <Text style={styles.queueCardSubtitle}>
            {i18n.language === 'mr'
              ? 'आपले थेट रांगेतील स्थान'
              : 'Your Real-Time Queue Position'}
          </Text>

          <View style={styles.positionNumberRow}>
            <Text style={styles.positionNumber}>
              {formatQueueRange(queuePosition, i18n.language)}
            </Text>
          </View>

          <View style={styles.positionBadge}>
            <Text style={styles.positionBadgeText}>
              {queuePosition === 1
                ? '🟢 YOUR TURN NEXT / आता प्रवेश करा'
                : queuePosition <= 3
                ? '🟡 APPROACHING GATE / तयार राहा'
                : '🟢 IN QUEUE / रांगेत समाविष्ट'}
            </Text>
          </View>

          <View style={styles.queueMetricsGrid}>
            <View style={styles.queueMetricCol}>
              <Text style={styles.metricVal}>
                {formatVehiclesAheadRange(vehiclesAhead, i18n.language)}
              </Text>
              <Text style={styles.metricLabel}>
                {i18n.language === 'mr' ? 'रांगेतील अंतर' : 'Queue Distance'}
              </Text>
            </View>

            <View style={styles.queueMetricDivider} />

            <View style={styles.queueMetricCol}>
              <Text style={styles.metricVal}>
                {vehiclesAhead <= 0 ? '0 Min' : `~${Math.max(5, vehiclesAhead * 8)} Min`}
              </Text>
              <Text style={styles.metricLabel}>
                {i18n.language === 'mr' ? 'अंदाजे प्रतीक्षा वेळ' : 'Est. Waiting Time'}
              </Text>
            </View>
          </View>
        </View>

        {/* Smart Leave-By Departure Recommendation Card */}
        <View style={styles.leaveByCard}>
          <View style={styles.leaveByHeader}>
            <Text style={styles.leaveByIcon}>🚗</Text>
            <View style={styles.leaveByTitleCol}>
              <Text style={styles.leaveByTitle}>
                {i18n.language === 'mr'
                  ? 'शेतातून निघण्याची शिफारस वेळ (Leave-By)'
                  : 'Recommended Departure Time (Leave-By)'}
              </Text>
              <Text style={styles.leaveByTime}>{getLeaveByRecommendation()}</Text>
            </View>
          </View>

          <Text style={styles.leaveByNote}>
            {i18n.language === 'mr'
              ? `आपल्या ${token?.slotLabel || '08:00 AM'} स्लॉटसाठी वेळेवर पोहोचण्यासाठी शेतातून ${getLeaveByRecommendation()} वाजता निघा.`
              : `To comfortably reach for your ${token?.slotLabel || '08:00 AM'} slot, depart from farm by ${getLeaveByRecommendation()}.`}
          </Text>
        </View>

        {/* APMC Mandi Real-Time Yard Status */}
        <View style={styles.yardStatusCard}>
          <Text style={styles.yardStatusTitle}>
            🏛️ {token?.mandiName || 'APMC Mandi'} — {i18n.language === 'mr' ? 'थेट यार्ड स्थिती' : 'Live Yard Telemetry'}
          </Text>

          <View style={styles.laneStatusRow}>
            <View style={styles.laneItem}>
              <Text style={styles.laneName}>Gate 01 Intake</Text>
              <Text style={styles.laneBadgeGreen}>{isSocketLive ? '🟢 Active / चालू' : '🟡 Standby'}</Text>
            </View>

            <View style={styles.laneItem}>
              <Text style={styles.laneName}>Quality NIR Lab</Text>
              <Text style={styles.laneBadgeGreen}>{isSocketLive ? '🟢 Calibrated' : '🟡 Offline Sync'}</Text>
            </View>

            <View style={styles.laneItem}>
              <Text style={styles.laneName}>Electronic Scale</Text>
              <Text style={styles.laneBadgeGreen}>🟢 60MT Pitless Active</Text>
            </View>
          </View>
        </View>

        {/* Direct Action to 5-Stage Timeline */}
        <TouchableOpacity
          style={styles.timelineCTAButton}
          onPress={() => navigation.navigate('ProcurementTimeline', { token })}
          activeOpacity={0.8}
        >
          <Text style={styles.timelineCTAText}>
            📊 ५-टप्पे खरेदी टाइमलाइन पहा (View 5-Stage Timeline) →
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
  socketStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  liveIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    flexShrink: 0
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46'
  },
  tokenRefText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    flexShrink: 1
  },
  queueHeroCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#86efac',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14
  },
  queueCardSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  positionNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8
  },
  hashSymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary
  },
  positionNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.primaryDark,
    lineHeight: 70
  },
  positionBadge: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  queueMetricsGrid: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  queueMetricCol: {
    flex: 1,
    alignItems: 'center'
  },
  queueMetricDivider: {
    width: 1,
    backgroundColor: COLORS.border
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 2
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  leaveByCard: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14
  },
  leaveByHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  },
  leaveByIcon: {
    fontSize: 28
  },
  leaveByTitleCol: {
    flex: 1
  },
  leaveByTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af'
  },
  leaveByTime: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1d4ed8'
  },
  leaveByNote: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4
  },
  yardStatusCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16
  },
  yardStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12
  },
  laneStatusRow: {
    gap: 8
  },
  laneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8
  },
  laneName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text
  },
  laneBadgeGreen: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669'
  },
  laneBadgeYellow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706'
  },
  timelineCTAButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  timelineCTAText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  }
});
