import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const colors = useColors();
  const isDark = useColorScheme() !== 'light';
  const isWeb = Platform.OS === 'web';
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.mutedForeground,
    tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10, marginBottom: 2 },
    tabBarStyle: { position: 'absolute', backgroundColor: isWeb ? colors.background : 'transparent', borderTopWidth: isWeb ? 1 : 0, borderTopColor: colors.border, elevation: 0, height: isWeb ? 84 : 76, paddingTop: 8 },
    tabBarBackground: () => isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} /> : <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
    <Tabs.Screen name="servers" options={{ title: 'Add Server', tabBarIcon: ({ color }) => <Feather name="plus-square" size={20} color={color} /> }} />
    <Tabs.Screen name="tweaks" options={{ title: 'Tweaks', tabBarIcon: ({ color }) => <Feather name="sliders" size={20} color={color} /> }} />
    <Tabs.Screen name="logs" options={{ title: 'Log', tabBarIcon: ({ color }) => <Feather name="list" size={20} color={color} /> }} />
  </Tabs>;
}
