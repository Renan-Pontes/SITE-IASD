import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function DashboardScreen() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_staff || user?.is_superuser);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Painel de Controle</Text>
          <Text style={styles.subtitle}>Gerencie eventos, equipes e comunicados.</Text>
        </View>
        <View style={styles.card}>
          {isAdmin ? (
            <>
              <Text style={styles.cardTitle}>Acesso liberado</Text>
              <Text style={styles.cardText}>
                Use o admin do Django para ajustes completos e cadastros.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Acesso restrito</Text>
              <Text style={styles.cardText}>
                Esta area e exclusiva para contas administrativas.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  content: {
    padding: 24,
    paddingBottom: 56,
    gap: 18,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.rounded,
    color: '#3C4B42',
  },
  card: {
    backgroundColor: Brand.mist,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    color: Brand.ink,
    marginBottom: 6,
  },
  cardText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
});
