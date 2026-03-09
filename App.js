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
import PowerWeightScreen from './src/screens/PowerWeightScreen';
import SpeedoCorrectionScreen from './src/screens/SpeedoCorrectionScreen';
import TireSpeedScreen from './src/screens/TireSpeedScreen';
import ReactionTimerScreen from './src/screens/ReactionTimerScreen';
import RunLogbookScreen from './src/screens/RunLogbookScreen';
import TuneNotesScreen from './src/screens/TuneNotesScreen';
import CarProfileScreen from './src/screens/CarProfileScreen';
import EthanolCalculatorScreen from './src/screens/EthanolCalculatorScreen';
import OBD2Screen from './src/screens/OBD2Screen';
import DragyGPSScreen from './src/screens/DragyGPSScreen';
import E85FinderScreen from './src/screens/E85FinderScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const hdrOpts = {
  headerStyle: { backgroundColor: '#0a0a0a' },
  headerTitleStyle: { color: '#ffffff', fontWeight: '800' },
  headerTintColor: '#e51515',
  contentStyle: { backgroundColor: '#0a0a0a' },
};

function ToolsStack() {
  return (
    <Stack.Navigator screenOptions={hdrOpts}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SlopeCorrector"   component={SlopeCorrectorScreen}   options={{ title: 'Roll Race Slope' }} />
      <Stack.Screen name="StandingStart"    component={StandingStartScreen}    options={{ title: '0-60 / 0-100 Slope' }} />
      <Stack.Screen name="TrapSpeed"        component={TrapSpeedScreen}        options={{ title: 'Trap Speed Corrector' }} />
      <Stack.Screen name="DensityAltitude"  component={DensityAltitudeScreen}  options={{ title: 'Density Altitude' }} />
      <Stack.Screen name="WeatherCorrection"component={WeatherCorrectionScreen}options={{ title: 'SAE Weather Correction' }} />
      <Stack.Screen name="PowerWeight"      component={PowerWeightScreen}      options={{ title: 'Power-to-Weight' }} />
      <Stack.Screen name="SpeedoCorrection" component={SpeedoCorrectionScreen} options={{ title: 'Speedo Correction' }} />
      <Stack.Screen name="TireSpeed"        component={TireSpeedScreen}        options={{ title: 'Tire Speed Calculator' }} />
      <Stack.Screen name="ReactionTimer"    component={ReactionTimerScreen}    options={{ title: 'Reaction Timer', headerShown: false }} />
      <Stack.Screen name="RunLogbook"       component={RunLogbookScreen}       options={{ title: 'Run Logbook' }} />
      <Stack.Screen name="TuneNotes"        component={TuneNotesScreen}        options={{ title: 'Tune Notes' }} />
      <Stack.Screen name="CarProfile"       component={CarProfileScreen}       options={{ title: 'Car Profile' }} />
      <Stack.Screen name="OBD2"            component={OBD2Screen}           options={{ title: 'OBD2 Scanner' }} />
      <Stack.Screen name="DragyGPS"         component={DragyGPSScreen}       options={{ title: 'Dragy GPS Meter' }} />
      <Stack.Screen name="EthanolCalc"      component={EthanolCalculatorScreen}options={{ title: 'Ethanol Mix Calculator' }} />
      <Stack.Screen name="FindE85"          component={E85FinderScreen}        options={{ title: 'Find E85' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a', borderTopWidth: 1, height: 70, paddingBottom: 10 },
        tabBarActiveTintColor: '#e51515',
        tabBarInactiveTintColor: '#444',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
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
