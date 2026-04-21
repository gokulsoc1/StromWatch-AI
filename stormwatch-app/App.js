import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{
          headerStyle: { backgroundColor: '#020617' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '800', fontSize: 18 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'STORMWATCH AI' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Live Dashboard' }} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Pro Analysis' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
