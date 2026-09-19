import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import HomeScreen from '../screens/home/HomeScreen';
import CentresScreen from '../screens/centres/CentresScreen';
import MyTokensScreen from '../screens/tokens/MyTokensScreen';
import BookingScreen from '../screens/booking/BookingScreen';
import HelpSupportScreen from '../screens/support/HelpSupportScreen';
import TokenDetailsScreen from '../screens/tracking/TokenDetailsScreen';
import LiveQueueScreen from '../screens/tracking/LiveQueueScreen';
import ProcurementTimelineScreen from '../screens/tracking/ProcurementTimelineScreen';
import PayoutStatusScreen from '../screens/tracking/PayoutStatusScreen';
import { COLORS } from '../utils/constants';

const Tab = createBottomTabNavigator();
const HomeStackNav = createNativeStackNavigator();

function HomeStack() {
  return (
    <HomeStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.primaryDark,
        headerTitleStyle: { fontWeight: '700' }
      }}
    >
      <HomeStackNav.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStackNav.Screen
        name="Centres"
        component={CentresScreen}
        options={{ title: 'APMC Mandi Centres' }}
      />
      <HomeStackNav.Screen
        name="MyTokens"
        component={MyTokensScreen}
        options={{ title: 'My Tokens' }}
      />
      <HomeStackNav.Screen
        name="Book"
        component={BookingScreen}
        options={{ title: 'Reserve Arrival Slot' }}
      />
      <HomeStackNav.Screen
        name="TokenDetails"
        component={TokenDetailsScreen}
        options={{ title: 'Digital Token & QR' }}
      />
      <HomeStackNav.Screen
        name="LiveQueue"
        component={LiveQueueScreen}
        options={{ title: 'Live Queue Status' }}
      />
      <HomeStackNav.Screen
        name="ProcurementTimeline"
        component={ProcurementTimelineScreen}
        options={{ title: 'Procurement Timeline' }}
      />
      <HomeStackNav.Screen
        name="PayoutStatus"
        component={PayoutStatusScreen}
        options={{ title: 'DBT Payout Receipt' }}
      />
    </HomeStackNav.Navigator>
  );
}

export default function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6
        },
        tabBarItemStyle: {
          paddingHorizontal: 4
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: -0.2,
          marginTop: -2
        }
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: t('tab_home', 'Home'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🌾</Text>
        }}
      />
      <Tab.Screen
        name="CentresTab"
        component={CentresScreen}
        options={{
          tabBarLabel: t('tab_centres', 'Centres'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📍</Text>
        }}
      />
      <Tab.Screen
        name="MyTokensTab"
        component={MyTokensScreen}
        options={{
          tabBarLabel: t('tab_my_tokens', 'My Tokens'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🎟️</Text>
        }}
      />
      <Tab.Screen
        name="SupportTab"
        component={HelpSupportScreen}
        options={{
          tabBarLabel: t('tab_support', 'Support'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📞</Text>
        }}
      />
    </Tab.Navigator>
  );
}
