import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';

export default function OfflineBanner({ onRetry, message }) {
  const { t } = useTranslation();

  return (
    <View style={styles.banner}>
      <View style={styles.leftContent}>
        <Text style={styles.icon}>📡</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {t('offline_mode_title', 'ऑफलाईन मोड / Offline Mode')}
          </Text>
          <Text style={styles.subtitle}>
            {message || t('offline_mode_desc', 'स्थानिक सेव्ह केलेली माहिती दर्शवत आहे. थेट सिंक इंटरनेट सुरू झाल्यावर होईल.')}
          </Text>
        </View>
      </View>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
          <Text style={styles.retryText}>{t('retry', 'पुन्हा प्रयत्न करा')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  icon: {
    fontSize: 22,
    marginRight: 10
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 2
  },
  subtitle: {
    fontSize: 11,
    color: '#b45309',
    lineHeight: 15
  },
  retryButton: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e'
  }
});
