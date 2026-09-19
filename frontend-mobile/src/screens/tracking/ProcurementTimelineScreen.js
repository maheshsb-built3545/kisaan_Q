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
import { getSocket, joinTokenRoom } from '../../api/socket';
import { Storage } from '../../utils/storage';
import OfflineBanner from '../../components/OfflineBanner';
import { COLORS } from '../../utils/constants';

const STAGE_TEMPLATES = [
  {
    stageIndex: 0,
    id: 'GATE_CHECKIN',
    titleMr: '१. गेट १ प्रवेश व QR तपासणी',
    titleEn: '1. Gate Check-In & ANPR Intake',
    officer: 'Security Desk #1 (SEC-D1-KPG)',
    terminal: 'Gate 01 - North Boom Barrier',
    icon: '🚪'
  },
  {
    stageIndex: 1,
    id: 'QUALITY_GRADING',
    titleMr: '२. गुणवत्ता प्रतवारी व आर्द्रता तपासणी',
    titleEn: '2. Assaying Lab & Quality Grading',
    officer: 'S. Patil, Quality Assayer (QA-SP-KPG)',
    terminal: 'Assaying Lab #2 (NIR Moisture)',
    icon: '🔬'
  },
  {
    stageIndex: 2,
    id: 'WEIGHBRIDGE',
    titleMr: '३. डिजिटल वजन मापन (काटा)',
    titleEn: '3. Pitless Electronic Weighbridge',
    officer: 'Suresh Jadhav, Weighmaster (WM-02-KPG)',
    terminal: 'Pitless Weighbridge #1 (60 MT)',
    icon: '⚖️'
  },
  {
    stageIndex: 3,
    id: 'PROCUREMENT',
    titleMr: '४. खरेदी व दर निश्चिती पावती',
    titleEn: '4. Procurement & Price Confirmation',
    officer: 'Secretary Deshmukh (SEC-APMC-KPG)',
    terminal: 'APMC Secretary Procurement Terminal',
    icon: '📋'
  },
  {
    stageIndex: 4,
    id: 'PAYOUT',
    titleMr: '५. DBT बँक खात्यात जमा व अंतिम पावती',
    titleEn: '5. Treasury & DBT Bank Settlement',
    officer: 'Treasurer Deshmukh (TRY-DBT-KPG)',
    terminal: 'Treasury & PFMS Settlement Desk',
    icon: '💳'
  }
];

export default function ProcurementTimelineScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const passedToken = route.params?.token;

  const [token, setToken] = useState(passedToken || null);
  const [stages, setStages] = useState(passedToken?.stages || []);
  const [loading, setLoading] = useState(!passedToken);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchTimelineData = useCallback(async () => {
    try {
      let activeTok = passedToken;

      if (!activeTok) {
        const cached = await Storage.getJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN);
        if (cached) {
          activeTok = cached;
          setToken(cached);
          if (cached.stages) setStages(cached.stages);
        }
      }

      // Fetch fresh token details with stage checkpoints
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
          if (found.stages) setStages(found.stages);
          await Storage.setJson(Storage.ASYNC_KEYS.ACTIVE_TOKEN, found);
        }
      }
    } catch (err) {
      console.warn('[ProcurementTimeline] Fetch error:', err.message);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [passedToken]);

  useEffect(() => {
    fetchTimelineData();
  }, [fetchTimelineData]);

  // Real-Time Socket.IO Stage Updates
  useEffect(() => {
    const socket = getSocket();
    if (socket && token?.tokenNumber) {
      joinTokenRoom(token.tokenNumber);

      const handleStageProgress = (data) => {
        if (data?.tokenNumber === token?.tokenNumber) {
          if (data.token?.stages) {
            setStages(data.token.stages);
            setToken(data.token);
          } else {
            fetchTimelineData();
          }
        }
      };

      socket.on('queue:stage_updated', handleStageProgress);
      socket.on('STAGE_UPDATED', handleStageProgress);
      return () => {
        socket.off('queue:stage_updated', handleStageProgress);
        socket.off('STAGE_UPDATED', handleStageProgress);
      };
    }
  }, [token, fetchTimelineData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTimelineData();
  };

  const getStageStatus = (stageIdx) => {
    const stage = stages[stageIdx];
    if (stage) {
      const s = (stage.status || '').toLowerCase();
      if (s === 'completed') return 'COMPLETED';
      if (s === 'in-progress' || s === 'in_progress') return 'IN_PROGRESS';
    }

    const currentIdx = token?.currentStageIndex !== undefined ? token.currentStageIndex : 0;
    if (stageIdx < currentIdx) return 'COMPLETED';
    if (stageIdx === currentIdx) return 'IN_PROGRESS';
    return 'PENDING';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>५-टप्पे टाइमलाइन लोड होत आहे...</Text>
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
        {isOffline && <OfflineBanner onRetry={fetchTimelineData} />}

        {/* Header Pass Summary */}
        <View style={styles.passHeaderCard}>
          <View style={styles.passHeaderRow}>
            <View>
              <Text style={styles.tokenLabel}>टोकन / Pass #</Text>
              <Text style={styles.tokenVal}>{token?.tokenNumber || token?.id || 'KQ-PASS'}</Text>
            </View>
            <View style={styles.cropBadge}>
              <Text style={styles.cropBadgeText}>
                {token?.crop || 'Produce'} ({token?.quantity || 10} Qtl)
              </Text>
            </View>
          </View>
          <Text style={styles.mandiSubtitle}>
            🏛️ {token?.mandiName || 'APMC Mandi'} · 5-Stage Live Pipeline
          </Text>
        </View>

        {/* 5-Stage Stepper Timeline */}
        <View style={styles.timelineWrapper}>
          {STAGE_TEMPLATES.map((tmpl, idx) => {
            const status = getStageStatus(idx);
            const stageData = stages[idx] || {};
            const isLast = idx === STAGE_TEMPLATES.length - 1;

            const isDone = status === 'COMPLETED';
            const isInProgress = status === 'IN_PROGRESS';

            return (
              <View key={tmpl.id} style={styles.stageItem}>
                {/* Left Indicator & Connecting Line */}
                <View style={styles.indicatorCol}>
                  <View
                    style={[
                      styles.circleIndicator,
                      isDone
                        ? styles.circleDone
                        : isInProgress
                        ? styles.circleProgress
                        : styles.circlePending
                    ]}
                  >
                    <Text style={styles.circleText}>
                      {isDone ? '✓' : tmpl.icon}
                    </Text>
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.connectingLine,
                        isDone ? styles.lineDone : styles.linePending
                      ]}
                    />
                  )}
                </View>

                {/* Right Stage Content Card */}
                <View
                  style={[
                    styles.stageCard,
                    isInProgress && styles.stageCardActive,
                    isDone && styles.stageCardDone
                  ]}
                >
                  <View style={styles.stageCardHeader}>
                    <Text style={styles.stageTitle}>
                      {i18n.language === 'mr' ? tmpl.titleMr : tmpl.titleEn}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        isDone
                          ? styles.statusPillDone
                          : isInProgress
                          ? styles.statusPillProgress
                          : styles.statusPillPending
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isDone
                            ? styles.statusTextDone
                            : isInProgress
                            ? styles.statusTextProgress
                            : styles.statusTextPending
                        ]}
                      >
                        {isDone
                          ? '✓ पूर्ण (Done)'
                          : isInProgress
                          ? '⏳ प्रगतीपथावर'
                          : 'प्रतीक्षेत'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.officerName}>
                    👤 {stageData.officerName || tmpl.officer}
                  </Text>
                  <Text style={styles.terminalName}>
                    📍 {tmpl.terminal}
                  </Text>

                  {/* Stage Details / Readings */}
                  {stageData.completedAt || isDone ? (
                    <View style={styles.readingsBox}>
                      {tmpl.id === 'GATE_CHECKIN' && (
                        <View style={styles.readingGrid}>
                          <Text style={styles.readingTextBold}>
                            ✅ {stageData.details?.gateNumber ? `${stageData.details.gateNumber} Intake Verified` : 'ANPR Gate Intake Verified'}
                          </Text>
                          <Text style={styles.readingSubText}>
                            🚗 Vehicle: {stageData.details?.anprPlate || token?.vehicleNumber || 'MH-17-AB-1234'}
                          </Text>
                        </View>
                      )}
                      {tmpl.id === 'QUALITY_GRADING' && (
                        <View style={styles.readingGrid}>
                          <View style={styles.readingChipRow}>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Grade</Text>
                              <Text style={styles.readingChipVal}>{stageData.grade || stageData.details?.grade || 'Grade A FAQ'}</Text>
                            </View>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Moisture</Text>
                              <Text style={styles.readingChipVal}>{stageData.moisture || stageData.details?.moisture || '10.8'}%</Text>
                            </View>
                          </View>
                        </View>
                      )}
                      {tmpl.id === 'WEIGHBRIDGE' && (
                        <View style={styles.readingGrid}>
                          <View style={styles.readingChipRow}>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Gross</Text>
                              <Text style={styles.readingChipVal}>{stageData.grossWeight || stageData.details?.grossWeight || '12.5'} MT</Text>
                            </View>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Tare</Text>
                              <Text style={styles.readingChipVal}>{stageData.tareWeight || stageData.details?.tareWeight || '2.1'} MT</Text>
                            </View>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Net</Text>
                              <Text style={styles.readingChipVal}>{stageData.weight || stageData.details?.netProduceQtl || token?.quantity || 25} Qtl</Text>
                            </View>
                          </View>
                        </View>
                      )}
                      {tmpl.id === 'PROCUREMENT' && (
                        <View style={styles.readingGrid}>
                          <View style={styles.readingChipRow}>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Rate/Qtl</Text>
                              <Text style={styles.readingChipVal}>₹{(stageData.details?.ratePerQtl || 4892).toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={styles.readingChip}>
                              <Text style={styles.readingChipLabel}>Gross PO</Text>
                              <Text style={styles.readingChipVal}>₹{(stageData.totalAmount || stageData.details?.totalAmount || ((token?.quantity || 25) * 4892)).toLocaleString('en-IN')}</Text>
                            </View>
                          </View>
                        </View>
                      )}
                      {tmpl.id === 'PAYOUT' && (
                        <View style={styles.readingGrid}>
                          <Text style={styles.readingTextBold}>💳 DBT Bank Payout Settled</Text>
                          <Text style={styles.readingSubText}>
                            Ref: {stageData.paymentRef || stageData.details?.paymentRef || 'PFMS-DBT-AUTH'}
                            {stageData.totalAmount || stageData.details?.totalPaid ? ` · ₹${(stageData.totalAmount || stageData.details.totalPaid).toLocaleString('en-IN')}` : ''}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.timestampLine}>
                        🕒 {stageData.completedAt ? new Date(stageData.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Verified by Officer'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Direct Link to DBT Settlement */}
        <TouchableOpacity
          style={styles.payoutButton}
          onPress={() => navigation.navigate('PayoutStatus', { token })}
          activeOpacity={0.8}
        >
          <Text style={styles.payoutButtonText}>
            💳 DBT बँक जमा पावती पहा (View DBT Settlement) →
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
  passHeaderCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    elevation: 2
  },
  passHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  tokenLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  tokenVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark
  },
  cropBadge: {
    backgroundColor: '#dcfce7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  cropBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  mandiSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted
  },
  timelineWrapper: {
    marginBottom: 20
  },
  stageItem: {
    flexDirection: 'row',
    marginBottom: 12
  },
  indicatorCol: {
    alignItems: 'center',
    width: 44,
    marginRight: 10
  },
  circleIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    zIndex: 2
  },
  circleDone: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d'
  },
  circleProgress: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b'
  },
  circlePending: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1'
  },
  circleText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '900'
  },
  connectingLine: {
    width: 2,
    flex: 1,
    marginVertical: 4
  },
  lineDone: {
    backgroundColor: '#16a34a'
  },
  linePending: {
    backgroundColor: '#cbd5e1'
  },
  stageCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  stageCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
    elevation: 3
  },
  stageCardDone: {
    borderColor: '#86efac'
  },
  stageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  stageTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
    minWidth: 140
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  statusPillDone: {
    backgroundColor: '#dcfce7'
  },
  statusPillProgress: {
    backgroundColor: '#fef3c7'
  },
  statusPillPending: {
    backgroundColor: '#f1f5f9'
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusTextDone: {
    color: '#065f46'
  },
  statusTextProgress: {
    color: '#92400e'
  },
  statusTextPending: {
    color: COLORS.textMuted
  },
  officerName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2
  },
  terminalName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 8
  },
  readingsBox: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4
  },
  readingGrid: {
    marginBottom: 4
  },
  readingChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2
  },
  readingChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  readingChipLabel: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  readingChipVal: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text
  },
  readingTextBold: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  readingSubText: {
    fontSize: 11,
    color: COLORS.textMuted
  },
  timestampLine: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2
  },
  payoutButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  payoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  }
});
