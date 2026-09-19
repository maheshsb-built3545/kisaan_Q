import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initStoredLanguage } from './src/locales/i18n';
import { addNotificationResponseListener } from './src/utils/notifications';

export const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: ['kisanq://', 'https://kisanq.aveniq.in'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          HomeScreen: 'home',
          Centres: 'centres',
          Book: 'book',
          TokenDetails: 'token/:id',
          LiveQueue: 'queue/:centreId/:tokenNumber',
          ProcurementTimeline: 'timeline/:id',
          PayoutStatus: 'payout/:id'
        }
      },
      CentresTab: 'centres-tab',
      MyTokensTab: 'my-tokens',
      SupportTab: 'support'
    }
  }
};

export default function App() {
  useEffect(() => {
    initStoredLanguage();
    const subscription = addNotificationResponseListener(navigationRef);
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
