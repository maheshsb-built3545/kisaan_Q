import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';

export default function AgriPoolMatchModal({
  visible,
  matchData,
  onClose,
  onViewToken
}) {
  const { t, i18n } = useTranslation();

  if (!matchData) return null;

  const peer = matchData.farmer2 || {};
  const distance = matchData.distanceMeters || 450;
  const savings = matchData.estimatedSavings || '₹750 – ₹1,200';
  const mandi = matchData.mandiName || 'APMC Mandi';

  const handleCallPeer = () => {
    if (peer.phone) {
      const url = `tel:${peer.phone}`;
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) Linking.openURL(url);
        })
        .catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🤝 AGRIPOOL 500M MATCH</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {i18n.language === 'mr'
              ? 'शेअर वाहतूक संधी उपलब्ध!'
              : i18n.language === 'hi'
              ? 'साझा परिवहन का अवसर उपलब्ध!'
              : 'Shared Freight Opportunity!'}
          </Text>

          <Text style={styles.subtitle}>
            {i18n.language === 'mr'
              ? `आपल्या ५०० मीटर अंतरावरील शेतकरी मित्र आज याच बाजार समितीकडे निघाले आहेत.`
              : i18n.language === 'hi'
              ? `आपके 500 मीटर के भीतर के किसान मित्र आज इसी मंडी जा रहे हैं।`
              : `Another farmer within 500m is heading to ${mandi} on the same slot date.`}
          </Text>

          {/* Peer Farmer Details Card */}
          <View style={styles.peerCard}>
            <View style={styles.peerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>🧑‍🌾</Text>
              </View>
              <View style={styles.peerInfo}>
                <Text style={styles.peerName}>
                  {peer.name || 'शेतकरी मित्र (Farmer)'}
                </Text>
                <Text style={styles.peerDist}>
                  📍 ~{distance}m {i18n.language === 'mr' ? 'आपल्या शेताजवळ' : 'away from your farm'}
                </Text>
              </View>
            </View>

            <View style={styles.peerStats}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>पीक / Crop</Text>
                <Text style={styles.statVal}>
                  {peer.crop || 'Soybean'} ({peer.quantity || 30} Qtl)
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>गंतव्य / Mandi</Text>
                <Text style={styles.statVal}>{mandi}</Text>
              </View>
            </View>
          </View>

          {/* Savings Callout */}
          <View style={styles.savingsBox}>
            <Text style={styles.savingsIcon}>💰</Text>
            <View style={styles.savingsTextCol}>
              <Text style={styles.savingsTitle}>
                {i18n.language === 'mr'
                  ? 'अंदाजे वाहतूक खर्च बचत'
                  : 'Estimated Freight Savings'}
              </Text>
              <Text style={styles.savingsAmount}>{savings}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionCol}>
            {peer.phone && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCallPeer}
                activeOpacity={0.8}
              >
                <Text style={styles.callButtonText}>
                  📞 {i18n.language === 'mr' ? 'शेतकऱ्याशी संपर्क करा' : 'Connect & Call Peer'} (+91 {peer.phone})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.viewPassBtn}
              onPress={onViewToken}
              activeOpacity={0.8}
            >
              <Text style={styles.viewPassText}>
                🎟️ {t('view_booked_token')} →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  badge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  badgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  closeButton: {
    padding: 6
  },
  closeText: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontWeight: '700'
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16
  },
  peerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14
  },
  peerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  avatarText: {
    fontSize: 22
  },
  peerInfo: {
    flex: 1
  },
  peerName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text
  },
  peerDist: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600'
  },
  peerStats: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  statCol: {
    flex: 1
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16
  },
  savingsIcon: {
    fontSize: 24
  },
  savingsTextCol: {
    flex: 1
  },
  savingsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e'
  },
  savingsAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#78350f'
  },
  actionCol: {
    gap: 10
  },
  callButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  viewPassBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  viewPassText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700'
  }
});
