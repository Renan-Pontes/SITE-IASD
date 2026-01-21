import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Igreja',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Eventos',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Conta',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle" color={color} />
          ),
        }}
      />
      {isAdmin ? (
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Controle',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape" color={color} />,
          }}
        />
      ) : null}
    </Tabs>
  );
}
