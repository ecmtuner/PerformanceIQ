import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import SlopeCorrectorScreen from './src/screens/SlopeCorrectorScreen';
import EthanolCalculatorScreen from './src/screens/EthanolCalculatorScreen';
import E85FinderScreen from './src/screens/E85FinderScreen';

const Tab = createBottomTabNavigator();

const Icon = ({ emoji, focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
);

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
          headerTitleStyle: { color: '#ffffff', fontWeight: '800', fontSize: 18 },
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#e51515', fontWeight: '900', fontSize: 18 }}>Performance</Text>
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 18 }}>IQ</Text>
            </View>
          ),
          tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a', borderTopWidth: 1, height: 70, paddingBottom: 10 },
          tabBarActiveTintColor: '#e51515',
          tabBarInactiveTintColor: '#555',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tab.Screen
          name="Slope"
          component={SlopeCorrectorScreen}
          options={{
            tabBarLabel: 'Slope',
            tabBarIcon: ({ focused }) => <Icon emoji="⏱️" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="E85 Calc"
          component={EthanolCalculatorScreen}
          options={{
            tabBarLabel: 'E85 Calc',
            tabBarIcon: ({ focused }) => <Icon emoji="⛽" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Find E85"
          component={E85FinderScreen}
          options={{
            tabBarLabel: 'Find E85',
            tabBarIcon: ({ focused }) => <Icon emoji="📍" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
