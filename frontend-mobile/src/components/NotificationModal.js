import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { triggerTestPushNotification } from '../utils/notifications';
import { COLORS } from '../utils/constants';

export default function NotificationModal({
  visible,
  onClose,
  notifications = [],
  onNotificationPress,
  onClearAll
}) {
  const { t, i18n } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);

  const handleTriggerTestNotification = async () => {
    if (isTesting) return;
    setIsTesting(true);
    const result = await triggerTestPushNotification();
    setIsTesting(false);

    if (result.success) {
      const status = result.data?.expoResponse?.data?.status || 'ok';
      if (status === 'ok') {
        Alert.alert(
          '✅ चाचणी सूचना पाठवली (Push Sent)',
          'Expo पुश सर्व्हरने सूचना यशस्वीरीत्या पाठवली आहे.\n\nStatus: OK',
          [{ text: 'OK' }]
        );
      } else {
        const errorMsg = result.data?.expoResponse?.data?.message || 'Push delivery issue';
        Alert.alert(
          '⚠️ पुश अलर्ट चेतावणी (Push Warning)',
          `Expo सर्व्हर प्रतिसाद:\n${errorMsg}`,
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        '❌ त्रुटी (Error)',
        result.error || 'पुश सूचना पाठवता आली नाही. कृपया डिव्हाइस टोकन तपासा.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🔔</Text>
              <Text style={styles.headerTitle}>
                {t('notifications', 'सूचना केंद्र / Notifications')}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.testAlertBtn, isTesting && { opacity: 0.6 }]}
              onPress={handleTriggerTestNotification}
              disabled={isTesting}
              activeOpacity={0.7}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <Text style={styles.testAlertBtnText}>
                  🔔 चाचणी अलर्ट पाठवा (Test Push)
                </Text>
              )}
            </TouchableOpacity>

            {notifications.length > 0 && (
              <TouchableOpacity onPress={onClearAll}>
                <Text style={styles.clearAllText}>
                  {t('clear_all', 'सर्व पुसा / Clear All')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={styles.listContainer}>
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>
                  {t('no_notifications', 'कोणतीही नवीन सूचना नाही')}
                </Text>
                <Text style={styles.emptySub}>
                  {t('no_notifications_sub', 'आपल्या बुकिंग आणि रांगेच्या ताज्या सूचना येथे दिसतील.')}
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      item.unread && styles.notificationUnread
                    ]}
                    onPress={() => onNotificationPress && onNotificationPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.notifTopRow}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.notifIcon}>{item.icon || '📌'}</Text>
                        <Text style={styles.notifTitle}>{item.title}</Text>
                      </View>
                      <Text style={styles.notifTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    {item.actionText && (
                      <View style={styles.actionLinkRow}>
                        <Text style={styles.actionLink}>{item.actionText} →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIcon: {
    fontSize: 20
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  testAlertBtn: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  testAlertBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534'
  },
  notificationCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error
  },
  listContainer: {
    padding: 16,
    gap: 10
  },
  notificationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  notificationUnread: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4'
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  notifIcon: {
    fontSize: 16
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 8
  },
  notifBody: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: 6
  },
  actionLinkRow: {
    alignItems: 'flex-end'
  },
  actionLink: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18
  }
});
