import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { Brand, Fonts } from '@/constants/theme';
import { ApiResult, fetchJson, postJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type OperatingHour = {
  id: number;
  day_label: string;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  notes: string;
};

type OperatingException = {
  id: number;
  date: string | null;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  reason: string;
};

type Church = {
  id: number;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  operating_hours: OperatingHour[];
  operating_exceptions: OperatingException[];
};

type EventItem = {
  id: number;
  title: string;
  description: string;
  speaker_name: string;
  location: string;
  starts_at: string;
  ends_at: string;
  image_url: string;
  attendance_mode: 'CONFIRM' | 'PARTICIPATE';
};

type TeamItem = {
  id: number;
  name: string;
  description: string;
};

type UpdateItem = {
  id: number;
  title: string;
  content: string;
  event_title: string;
  created_at: string;
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const formatShortDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()] ?? '--';
  return `${day} ${month}`;
};

const formatTimeValue = (value?: string | null) => {
  if (!value) return '';
  if (value.includes('T')) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return value.slice(0, 5);
};

const formatTimeRange = (start?: string | null, end?: string | null) => {
  const startLabel = formatTimeValue(start);
  const endLabel = formatTimeValue(end);
  if (!startLabel && !endLabel) return '';
  if (startLabel && endLabel) return `${startLabel}-${endLabel}`;
  return startLabel || endLabel;
};

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  const { token, user, isAuthenticated, login, register, logout } = useAuth();
  const [church, setChurch] = useState<Church | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [churchData, eventsData, teamsData, updatesData] = await Promise.all([
          fetchJson<Church>('/api/church/'),
          fetchJson<ApiResult<EventItem>>('/api/events/?limit=4'),
          fetchJson<ApiResult<TeamItem>>('/api/teams/?limit=6'),
          fetchJson<ApiResult<UpdateItem>>('/api/event-updates/?limit=3'),
        ]);
        if (!isMounted) return;
        setChurch(churchData);
        setEvents(eventsData.results);
        setTeams(teamsData.results);
        setUpdates(updatesData.results);
      } catch (err) {
        if (!isMounted) return;
        setError('Nao foi possivel carregar os dados.');
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const operatingHours = church?.operating_hours ?? [];
  const operatingExceptions = church?.operating_exceptions ?? [];
  const nextEvent = events[0];

  const handleAuthSubmit = async () => {
    setAuthStatus(null);
    if (authMode === 'register' && !authName.trim()) {
      setAuthStatus('Informe seu nome.');
      return;
    }
    if (!authEmail.trim() || !authPassword) {
      setAuthStatus('Informe email e senha.');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        await register(authName.trim(), authEmail.trim(), authPassword);
      } else {
        await login(authEmail.trim(), authPassword);
      }
      setAuthPassword('');
      setAuthStatus(null);
    } catch (err) {
      setAuthStatus('Nao foi possivel completar o acesso.');
    } finally {
      setAuthLoading(false);
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

  const handleConfirm = async (eventId: number) => {
    if (!token) {
      setModalError('Faca login para confirmar presenca.');
      return;
    }
    setConfirming(eventId);
    setModalError(null);
    try {
      await postJson(
        `/api/events/${eventId}/confirm/`,
        { status: 'CONFIRMED' },
        { headers: { Authorization: `Token ${token}` } }
      );
      setSelectedEvent(null);
    } catch (err) {
      setModalError('Nao foi possivel confirmar o evento.');
    } finally {
      setConfirming(null);
    }
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, isWide && styles.heroWide]}>
          <View style={styles.heroMain}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Igreja Adventista do Setimo Dia</Text>
            </View>
            <Text style={styles.heroTitle}>{church?.name ?? 'Igreja Central'}</Text>
            <Text style={styles.heroSubtitle}>
              {church?.description ||
                'Um espaco para adorar, servir e acompanhar as programacoes da igreja.'}
            </Text>
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>{church?.address || 'Endereco a definir'}</Text>
              <Text style={styles.heroMetaText}>
                {church?.phone || '(11) 0000-0000'} - {church?.email || 'contato@igreja.org'}
              </Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
          <View style={styles.heroPanel}>
            <Text style={styles.heroPanelTitle}>Proxima programacao</Text>
            {nextEvent ? (
              <Pressable
                style={({ pressed }) => [
                  styles.heroEvent,
                  pressed && styles.heroEventPressed,
                ]}
                onPress={() => {
                  setModalError(null);
                  setSelectedEvent(nextEvent);
                }}
              >
                {nextEvent.image_url ? (
                  <Image
                    source={{ uri: nextEvent.image_url }}
                    style={styles.heroEventImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.heroEventImagePlaceholder} />
                )}
                <View style={styles.heroEventInfo}>
                  <Text style={styles.heroEventTitle}>{nextEvent.title}</Text>
                  <Text style={styles.heroEventMeta}>
                    {formatShortDate(nextEvent.starts_at)} -{' '}
                    {formatTimeRange(nextEvent.starts_at, nextEvent.ends_at)}
                  </Text>
                  {nextEvent.speaker_name ? (
                    <Text style={styles.heroEventMeta}>
                      Palestrante: {nextEvent.speaker_name}
                    </Text>
                  ) : null}
                  <Text style={styles.heroEventMeta}>
                    {nextEvent.location || 'Local a definir'}
                  </Text>
                  <Text style={styles.heroEventTag}>
                    {nextEvent.attendance_mode === 'PARTICIPATE'
                      ? 'Participacao'
                      : 'Confirmacao'}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.mutedText}>Sem eventos publicados.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Programacao</Text>
            <Text style={styles.sectionHint}>Eventos confirmados e palestrantes.</Text>
          </View>
          {events.length === 0 ? (
            <Text style={styles.mutedText}>Sem eventos publicados.</Text>
          ) : (
            <View style={[styles.eventGrid, isWide && styles.eventGridWide]}>
              {events.map((event) => (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [
                    styles.eventCard,
                    isWide && styles.eventCardWide,
                    pressed && styles.eventCardPressed,
                  ]}
                  onPress={() => {
                    setModalError(null);
                    setSelectedEvent(event);
                  }}
                >
                  {event.image_url ? (
                    <Image
                      source={{ uri: event.image_url }}
                      style={styles.eventImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.eventImagePlaceholder} />
                  )}
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {formatShortDate(event.starts_at)} -{' '}
                      {formatTimeRange(event.starts_at, event.ends_at)}
                    </Text>
                    {event.speaker_name ? (
                      <Text style={styles.eventMeta}>Palestrante: {event.speaker_name}</Text>
                    ) : null}
                    <Text style={styles.eventLocation}>
                      {event.location || 'Local a definir'}
                    </Text>
                    <Text style={styles.eventTag}>
                      {event.attendance_mode === 'PARTICIPATE'
                        ? 'Participacao'
                        : 'Confirmacao'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Horarios</Text>
            <Text style={styles.sectionHint}>Atendimento e excecoes.</Text>
          </View>
          <View style={[styles.columns, isWide && styles.columnsWide]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Funcionamento</Text>
              {operatingHours.length === 0 ? (
                <Text style={styles.mutedText}>Sem horarios cadastrados.</Text>
              ) : (
                operatingHours.map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <Text style={styles.listLabel}>{item.day_label}</Text>
                    <Text style={styles.listValue}>
                      {item.is_closed
                        ? 'Fechado'
                        : formatTimeRange(item.opens_at, item.closes_at)}
                    </Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Excecoes</Text>
              {operatingExceptions.length === 0 ? (
                <Text style={styles.mutedText}>Sem excecoes cadastradas.</Text>
              ) : (
                operatingExceptions.map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <Text style={styles.listLabel}>{formatShortDate(item.date)}</Text>
                    <Text style={styles.listValue}>
                      {item.is_closed
                        ? 'Fechado'
                        : formatTimeRange(item.opens_at, item.closes_at)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Equipes</Text>
            <Text style={styles.sectionHint}>Grupos ativos e organizacao.</Text>
          </View>
          {teams.length === 0 ? (
            <Text style={styles.mutedText}>Sem equipes cadastradas.</Text>
          ) : (
            <View style={[styles.teamGrid, isWide && styles.teamGridWide]}>
              {teams.map((team) => (
                <View key={team.id} style={[styles.teamCard, isWide && styles.teamCardWide]}>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamDescription}>
                    {team.description || 'Equipe ativa.'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Novidades</Text>
            <Text style={styles.sectionHint}>Avisos recentes dos eventos.</Text>
          </View>
          <View style={styles.card}>
            {updates.length === 0 ? (
              <Text style={styles.mutedText}>Sem novidades publicadas.</Text>
            ) : (
              updates.map((update) => (
                <View key={update.id} style={styles.updateRow}>
                  <Text style={styles.updateTitle}>{update.title}</Text>
                  <Text style={styles.updateText}>{update.content}</Text>
                  <Text style={styles.updateTag}>{update.event_title}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Acesso</Text>
            <Text style={styles.sectionHint}>Login e cadastro de membros.</Text>
          </View>
          <View style={styles.authCard}>
            {isAuthenticated && user ? (
              <>
                <Text style={styles.authTitle}>Sessao ativa</Text>
                <Text style={styles.authText}>{user.name || 'Membro'}</Text>
                <Text style={styles.authText}>{user.email}</Text>
                <Text style={styles.authStatus}>
                  {user.is_staff || user.is_superuser
                    ? 'Perfil administrativo ativo.'
                    : 'Perfil de membro ativo.'}
                </Text>
                <View style={styles.authButtonRow}>
                  <Text style={styles.authHint}>Use a aba Conta para ajustes.</Text>
                  <Pressable style={styles.authButton} onPress={handleLogout}>
                    <Text style={styles.authButtonText}>Sair</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.authToggleRow}>
                  <Pressable onPress={() => setAuthMode('login')}>
                    <Text
                      style={[
                        styles.authToggle,
                        authMode === 'login' && styles.authToggleActive,
                      ]}
                    >
                      Login
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setAuthMode('register')}>
                    <Text
                      style={[
                        styles.authToggle,
                        authMode === 'register' && styles.authToggleActive,
                      ]}
                    >
                      Cadastro
                    </Text>
                  </Pressable>
                </View>
                {authMode === 'register' ? (
                  <View style={styles.authField}>
                    <Text style={styles.authLabel}>Nome</Text>
                    <TextInput
                      style={styles.authInput}
                      value={authName}
                      onChangeText={setAuthName}
                      placeholder="Seu nome"
                      placeholderTextColor="#6B7A71"
                    />
                  </View>
                ) : null}
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>Email</Text>
                  <TextInput
                    style={styles.authInput}
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    placeholder="voce@email.com"
                    placeholderTextColor="#6B7A71"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.authField}>
                  <Text style={styles.authLabel}>Senha</Text>
                  <TextInput
                    style={styles.authInput}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder="Sua senha"
                    placeholderTextColor="#6B7A71"
                    secureTextEntry
                  />
                </View>
                {authStatus ? <Text style={styles.authError}>{authStatus}</Text> : null}
                <Pressable
                  style={[styles.authButton, authLoading && styles.authButtonDisabled]}
                  onPress={authLoading ? undefined : handleAuthSubmit}
                >
                  <Text style={styles.authButtonText}>
                    {authLoading
                      ? 'Enviando...'
                      : authMode === 'register'
                      ? 'Criar conta'
                      : 'Entrar'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {selectedEvent ? (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setModalError(null);
              setSelectedEvent(null);
            }}
          />
          <View style={styles.modalCard}>
            {selectedEvent.image_url ? (
              <Image
                source={{ uri: selectedEvent.image_url }}
                style={styles.modalImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.modalImagePlaceholder} />
            )}
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
              <Text style={styles.modalMeta}>
                {formatShortDate(selectedEvent.starts_at)} -{' '}
                {formatTimeRange(selectedEvent.starts_at, selectedEvent.ends_at)}
              </Text>
              {selectedEvent.speaker_name ? (
                <Text style={styles.modalMeta}>Palestrante: {selectedEvent.speaker_name}</Text>
              ) : null}
              <Text style={styles.modalMeta}>
                {selectedEvent.location || 'Local a definir'}
              </Text>
              <Text style={styles.modalMode}>
                Modo:{' '}
                {selectedEvent.attendance_mode === 'PARTICIPATE' ? 'Participar' : 'Confirmar'}
              </Text>
              <Text style={styles.modalDescription}>
                {selectedEvent.description || 'Sem descricao para este evento.'}
              </Text>
              {modalError ? <Text style={styles.modalError}>{modalError}</Text> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.modalButtonPressed,
                  confirming === selectedEvent.id && styles.modalButtonDisabled,
                ]}
                onPress={() => handleConfirm(selectedEvent.id)}
                disabled={confirming === selectedEvent.id}
              >
                <Text style={styles.modalButtonText}>
                  {confirming === selectedEvent.id
                    ? 'Enviando...'
                    : selectedEvent.attendance_mode === 'PARTICIPATE'
                    ? 'Participar'
                    : 'Confirmar presenca'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
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
    gap: 32,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  hero: {
    backgroundColor: Brand.mist,
    borderRadius: 20,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  heroWide: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  heroMain: {
    flex: 1,
    gap: 12,
  },
  heroPanel: {
    flex: 1,
    backgroundColor: Brand.rose,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  heroPanelTitle: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.rose,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 30,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: Fonts.rounded,
    color: '#3C4B42',
    lineHeight: 22,
  },
  heroMeta: {
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#58675E',
  },
  heroEvent: {
    backgroundColor: Brand.mist,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  heroEventPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  heroEventImage: {
    width: '100%',
    height: 140,
  },
  heroEventImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#DDE6DE',
  },
  heroEventInfo: {
    padding: 14,
    gap: 6,
  },
  heroEventTitle: {
    fontSize: 15,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  heroEventMeta: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  heroEventTag: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#8B3A2E',
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#58675E',
  },
  eventGrid: {
    gap: 16,
  },
  eventGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
    overflow: 'hidden',
  },
  eventCardPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  eventCardWide: {
    flexBasis: '48%',
  },
  eventImage: {
    width: '100%',
    height: 150,
  },
  eventImagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#E2EADF',
  },
  eventBody: {
    padding: 16,
    gap: 6,
  },
  eventTitle: {
    fontSize: 16,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  eventMeta: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  eventLocation: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  eventTag: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  columns: {
    gap: 16,
  },
  columnsWide: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  listLabel: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#3C4B42',
  },
  listValue: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: Brand.moss,
  },
  teamGrid: {
    gap: 12,
  },
  teamGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  teamCard: {
    backgroundColor: Brand.mist,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  teamCardWide: {
    flexBasis: '30%',
  },
  teamName: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  teamDescription: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  updateRow: {
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 42, 29, 0.08)',
  },
  updateTitle: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  updateText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  updateTag: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mutedText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#6C7A71',
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  authTitle: {
    fontSize: 14,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  authText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  authStatus: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: Brand.moss,
  },
  authButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  authHint: {
    fontSize: 11,
    fontFamily: Fonts.rounded,
    color: '#6C7A71',
  },
  authToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  authToggle: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    color: '#6C7A71',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  authToggleActive: {
    color: Brand.moss,
  },
  authField: {
    gap: 6,
  },
  authLabel: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: '#6C7A71',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  authInput: {
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Fonts.rounded,
    color: Brand.ink,
    backgroundColor: '#FAFBF8',
  },
  authError: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#8B3A2E',
  },
  authButton: {
    backgroundColor: Brand.clay,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: Brand.mist,
    letterSpacing: 0.3,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 16, 12, 0.35)',
  },
  modalCard: {
    width: '92%',
    maxWidth: 520,
    backgroundColor: Brand.mist,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.12)',
  },
  modalImage: {
    width: '100%',
    height: 180,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#E2EADF',
  },
  modalBody: {
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  modalMeta: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  modalMode: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalDescription: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#3C4B42',
    lineHeight: 18,
  },
  modalError: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#8B3A2E',
  },
  modalButton: {
    marginTop: 6,
    backgroundColor: Brand.clay,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: Brand.mist,
    letterSpacing: 0.3,
  },
  modalButtonPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});
