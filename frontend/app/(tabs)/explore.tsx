import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { Brand, Fonts } from '@/constants/theme';
import { ApiResult, fetchJson, postJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

type UpdateItem = {
  id: number;
  title: string;
  content: string;
  event_title: string;
  created_at: string;
};

type ParticipationItem = {
  id: number;
  event_id: number;
  event_title: string;
  event_location: string;
  starts_at: string;
  ends_at: string;
  confirmed_at: string | null;
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

export default function EventsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const { token, isAuthenticated } = useAuth();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [confirmed, setConfirmed] = useState<ParticipationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const loadParticipations = async () => {
    if (!token) {
      setConfirmed([]);
      return;
    }
    const payload = await fetchJson<ApiResult<ParticipationItem>>('/api/participations/', {
      headers: { Authorization: `Token ${token}` },
    });
    setConfirmed(payload.results);
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [eventsData, updatesData] = await Promise.all([
          fetchJson<ApiResult<EventItem>>('/api/events/'),
          fetchJson<ApiResult<UpdateItem>>('/api/event-updates/?limit=6'),
        ]);
        if (!isMounted) return;
        setEvents(eventsData.results);
        setUpdates(updatesData.results);
        await loadParticipations();
      } catch (err) {
        if (!isMounted) return;
        setError('Nao foi possivel carregar os eventos.');
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!eventId || selectedEvent) {
      return;
    }
    const numericId = Number(Array.isArray(eventId) ? eventId[0] : eventId);
    if (!numericId) {
      return;
    }
    const match = events.find((eventItem) => eventItem.id === numericId);
    if (match) {
      setSelectedEvent(match);
    }
  }, [eventId, events, selectedEvent]);

  const handleConfirm = async (eventId: number) => {
    if (!token) {
      setError('Faca login para confirmar presenca.');
      return;
    }
    setConfirming(eventId);
    setError(null);
    try {
      await postJson(
        `/api/events/${eventId}/confirm/`,
        { status: 'CONFIRMED' },
        { headers: { Authorization: `Token ${token}` } }
      );
      await loadParticipations();
      setSelectedEvent(null);
    } catch (err) {
      setError('Nao foi possivel confirmar o evento.');
    } finally {
      setConfirming(null);
    }
  };

  const actionLabel =
    selectedEvent?.attendance_mode === 'PARTICIPATE' ? 'Participar' : 'Confirmar presenca';

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Eventos</Text>
          <Text style={styles.headerSubtitle}>
            Toque em uma programacao para ver detalhes e confirmar sua presenca.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proximos eventos</Text>
          {events.length === 0 ? (
            <Text style={styles.mutedText}>Sem eventos publicados.</Text>
          ) : (
            <View style={[styles.eventGrid, isWide && styles.eventGridWide]}>
              {events.map((event) => (
                <Pressable
                  key={event.id}
                  style={[styles.eventCard, isWide && styles.eventCardWide]}
                  onPress={() => setSelectedEvent(event)}
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
                    <Text style={styles.eventLocation}>
                      {event.location || 'Local a definir'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmados</Text>
          <View style={styles.card}>
            {!isAuthenticated ? (
              <Text style={styles.mutedText}>Entre para ver seus eventos confirmados.</Text>
            ) : confirmed.length === 0 ? (
              <Text style={styles.mutedText}>Nenhum evento confirmado.</Text>
            ) : (
              confirmed.map((item) => (
                <View key={item.id} style={styles.confirmedRow}>
                  <View>
                    <Text style={styles.confirmedTitle}>{item.event_title}</Text>
                    <Text style={styles.confirmedDetail}>
                      {formatShortDate(item.starts_at)} -{' '}
                      {formatTimeRange(item.starts_at, item.ends_at)} - {item.event_location}
                    </Text>
                  </View>
                  <Text style={styles.confirmedStatus}>ativo</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Novidades</Text>
          <View style={styles.card}>
            {updates.length === 0 ? (
              <Text style={styles.mutedText}>Sem novidades publicadas.</Text>
            ) : (
              updates.map((update) => (
                <View key={update.id} style={styles.updateRow}>
                  <Text style={styles.updateTitle}>{update.title}</Text>
                  <Text style={styles.updateDetail}>{update.content}</Text>
                  <Text style={styles.updateTag}>{update.event_title}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {selectedEvent ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedEvent(null)} />
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
                Modo: {selectedEvent.attendance_mode === 'PARTICIPATE' ? 'Participar' : 'Confirmar'}
              </Text>
              <Text style={styles.modalDescription}>
                {selectedEvent.description || 'Sem descricao para este evento.'}
              </Text>
              {!isAuthenticated ? (
                <Text style={styles.mutedText}>Entre para confirmar sua presenca.</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.pressed,
                  (!isAuthenticated || confirming === selectedEvent.id) && styles.buttonDisabled,
                ]}
                onPress={() => handleConfirm(selectedEvent.id)}
                disabled={!isAuthenticated || confirming === selectedEvent.id}
              >
                <Text style={styles.modalButtonText}>
                  {confirming === selectedEvent.id ? 'Enviando...' : actionLabel}
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
  header: {
    backgroundColor: Brand.mist,
    borderRadius: 20,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.rounded,
    color: '#3C4B42',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#8B3A2E',
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.serif,
    color: Brand.ink,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 42, 29, 0.08)',
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmedTitle: {
    fontSize: 13,
    fontFamily: Fonts.serif,
    color: Brand.ink,
  },
  confirmedDetail: {
    fontSize: 12,
    fontFamily: Fonts.rounded,
    color: '#4B5B52',
  },
  confirmedStatus: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    color: Brand.moss,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  updateDetail: {
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
  buttonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
});
