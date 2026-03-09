import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import SlopeCorrectorScreen from './src/screens/SlopeCorrectorScreen';
import StandingStartScreen from './src/screens/StandingStartScreen';
import TrapSpeedScreen from './src/screens/TrapSpeedScreen';
import DensityAltitudeScreen from './src/screens/DensityAltitudeScreen';
import WeatherCorrectionScreen from './src/screens/WeatherCorrectionScreen';
import EthanolCalculatorScreen from './src/screens/EthanolCalculatorScreen';
import E85FinderScreen from './src/screens/E85FinderScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#0a0a0a' },
  headerTitleStyle: { color: '#ffffff', fontWeight: '800' },
  headerTintColor: '#e51515',
  contentStyle: { backgroundColor: '#0a0a0a' },
};

function ToolsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SlopeCorrector" component={SlopeCorrectorScreen} options={{ title: 'Roll Race Slope' }} />
      <Stack.Screen name="StandingStart" component={StandingStartScreen} options={{ title: '0-60 / 0-100 Slope' }} />
      <Stack.Screen name="TrapSpeed" component={TrapSpeedScreen} options={{ title: 'Trap Speed Corrector' }} />
      <Stack.Screen name="DensityAltitude" component={DensityAltitudeScreen} options={{ title: 'Density Altitude' }} />
      <Stack.Screen name="WeatherCorrection" component={WeatherCorrectionScreen} options={{ title: 'SAE Weather Correction' }} />
      <Stack.Screen name="EthanolCalc" component={EthanolCalculatorScreen} options={{ title: 'Ethanol Mix Calculator' }} />
      <Stack.Screen name="FindE85" component={E85FinderScreen} options={{ title: 'Find E85' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a', borderTopWidth: 1, height: 70, paddingBottom: 10 },
          tabBarActiveTintColor: '#e51515',
          tabBarInactiveTintColor: '#444',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tab.Screen name="Tools" component={ToolsStack}
          options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>🏎️</Text> }} />
        <Tab.Screen name="E85 Calc" component={EthanolCalculatorScreen}
          options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>⛽</Text>,
            headerShown: true, headerStyle: { backgroundColor: '#0a0a0a' }, headerTitleStyle: { color: '#fff' } }} />
        <Tab.Screen name="Find E85" component={E85FinderScreen}
          options={{ tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>📍</Text>,
            headerShown: true, headerStyle: { backgroundColor: '#0a0a0a' }, headerTitleStyle: { color: '#fff' } }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
