import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../api/client';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure system notification channels for Android 8.0+
 */
export async function setupNotificationChannelAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      enableVibrate: true,
    });
  }
}

/**
 * Register for Expo Push Notifications and sync token with KisanQ backend
 */
export async function registerForPushNotificationsAsync() {
  let token = null;

  try {
    // 1. Configure Android Notification Channel first
    await setupNotificationChannelAsync();

    // 2. Check and request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Notification permission not granted (status:', finalStatus, ')');
      return null;
    }

    // 3. Retrieve Expo Push Token with real error propagation
    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '705ed7a7-8aff-4ec4-a23a-838435de51dc'
      });
      token = pushTokenData?.data || null;
    } catch (tokenErr) {
      console.error('[Push] Failed to retrieve Expo Push Token:', tokenErr.message);
      return null;
    }

    if (token) {
      console.log('[Push] Successfully retrieved real push token:', token);
      // 4. Sync with KisanQ backend
      try {
        await api.patch('/farmers/push-token', { pushToken: token });
        console.log('[Push] Synced push token to backend successfully.');
      } catch (syncErr) {
        console.warn('[Push] Backend sync error:', syncErr.message);
      }
    }
  } catch (error) {
    console.error('[Push] Notification setup error:', error.message);
  }

  return token;
}

/**
 * Trigger a real remote test push notification via backend & Expo Push API
 */
export async function triggerTestPushNotification() {
  try {
    console.log('[Push] Dispatching test push request to backend...');
    const response = await api.post('/notifications/test-push');
    console.log('[Push] Backend test-push response:', response.data);
    return {
      success: true,
      data: response.data?.data || response.data
    };
  } catch (error) {
    console.error('[Push] Error dispatching test push notification:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Handle notification tap / deep linking
 */
export function addNotificationResponseListener(navigationRef) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const data = response.notification.request.content.data;
      if (!data) return;

      console.log('[Push] Notification response received with data:', data);

      if (data.tokenNumber && data.centreId) {
        navigationRef.current?.navigate('HomeTab', {
          screen: 'LiveQueue',
          params: { tokenNumber: data.tokenNumber, centreId: data.centreId }
        });
      } else if (data.url) {
        // Parse custom scheme kisanq://...
        const url = data.url;
        if (url.includes('queue')) {
          const parts = url.split('/');
          const centreId = parts[3] || 'KPG-01';
          const tokenNumber = parts[4] || '';
          navigationRef.current?.navigate('HomeTab', {
            screen: 'LiveQueue',
            params: { centreId, tokenNumber }
          });
        } else if (url.includes('token')) {
          navigationRef.current?.navigate('HomeTab', { screen: 'TokenDetails' });
        } else if (url.includes('timeline')) {
          navigationRef.current?.navigate('HomeTab', { screen: 'ProcurementTimeline' });
        } else if (url.includes('payout')) {
          navigationRef.current?.navigate('HomeTab', { screen: 'PayoutStatus' });
        }
      }
    } catch (e) {
      console.error('[Push] Error handling notification tap:', e.message);
    }
  });
}
