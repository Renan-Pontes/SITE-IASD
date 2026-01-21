import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Brand, Fonts } from '@/constants/theme';
import { postJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type AuthMode = 'login' | 'register';

export default function AccountScreen() {
  const { token, user, isAuthenticated, login, register, logout } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setStatus(null);
    if (mode === 'register' && !name.trim()) {
      setStatus('Informe seu nome.');
      return;
    }
    if (!email.trim() || !password) {
      setStatus('Informe email e senha.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      setPassword('');
    } catch (err) {
      setStatus('Nao foi possivel completar a solicitacao.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await postJson('/api/auth/logout/', {}, { headers: { Authorization: `Token ${token}` } });
      } catch (err) {
        // Ignore logout errors; local state will be cleared.
      }
    }
    logout();
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Conta</Text>
          <Text style={styles.subtitle}>
            Entre ou crie seu acesso para confirmar presenca nos eventos.
          </Text>
        </View>

        {isAuthenticated && user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sessao ativa</Text>
            <Text style={styles.cardText}>{user.name || 'Membro'} </Text>
            <Text style={styles.cardText}>{user.email}</Text>
            {user.is_staff || user.is_superuser ? (
              <Text style={styles.cardHighlight}>Perfil administrativo ativo.</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleLogout}
            >
              <Text style={styles.primaryButtonText}>Sair</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleButton, mode === 'login' && styles.toggleActive]}
                onPress={() => setMode('login')}
              >
                <Text
                  style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}
                >
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, mode === 'register' && styles.toggleActive]}
                onPress={() => setMode('register')}
              >
                <Text
                  style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}
                >
                  Cadastro
                </Text>
              </Pressable>
            </View>

            {mode === 'register' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome"
                  placeholderTextColor="#6B7A71"
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                placeholderTextColor="#6B7A71"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Sua senha"
                placeholderTextColor="#6B7A71"
                secureTextEntry
              />
            </View>

            {status ? <Text style={styles.errorText}>{status}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Enviando...' : mode === 'register' ? 'Criar conta' : 'Entrar'}
              </Text>
            </Pressable>
          </View>
        )}
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
    maxWidth: 520,
    alignSelf: 'center',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: '#384840',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(20, 34, 27, 0.08)',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  cardText: {
    fontSize: 13,
    fontFamily: Fonts.rounded,
    color: '#45584F',
  },
  cardHighlight: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: Brand.moss,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Brand.rose,
    borderRadius: 999,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Brand.ink,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: Brand.ink,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleTextActive: {
    color: Brand.mist,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: '#45584F',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(20, 34, 27, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: Brand.ink,
    backgroundColor: '#FDFDFB',
  },
  primaryButton: {
    backgroundColor: Brand.clay,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Brand.mist,
    fontSize: 13,
    fontFamily: Fonts.rounded,
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#8B3A2E',
  },
});
