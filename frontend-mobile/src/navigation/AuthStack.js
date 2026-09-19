import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LanguageSelectScreen from '../screens/auth/LanguageSelectScreen';
import OTPLoginScreen from '../screens/auth/OTPLoginScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="LanguageSelect"
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      <Stack.Screen name="OTPLogin" component={OTPLoginScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    </Stack.Navigator>
  );
}
