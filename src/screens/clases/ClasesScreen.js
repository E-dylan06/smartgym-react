import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

const getHoyStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFechaNormalizada = (f) => {
  if (!f) return '';
  if (typeof f === 'string') return f.substring(0, 10);
  const d = new Date(f);
  return d.toISOString().substring(0, 10);
};

// Verifica si una clase es estrictamente futura respecto a la fecha Y hora actual
const esHorarioFuturo = (fecha, horaInicio) => {
  if (!fecha) return false;
  const f = getFechaNormalizada(fecha);
  const hoy = getHoyStr();
  if (f < hoy) return false;
  if (f > hoy) return true;

  // Si la fecha es hoy, comparamos la hora de inicio con la hora actual
  try {
    const hora = (horaInicio || '00:00:00').substring(0, 8);
    const [hh, mm, ss] = hora.split(':').map((n) => parseInt(n, 10) || 0);
    const ahora = new Date();
    const claseDate = new Date();
    claseDate.setHours(hh, mm, ss || 0, 0);
    return claseDate > ahora;
  } catch {
    return true;
  }
};

export default function ClasesScreen({ navigation }) {
  const [horarios, setHorarios] = useState([]);
  const [misReservasIds, setMisReservasIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('todas'); // 'todas' | 'hoy' | 'manana' | 'posteriores'
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');
  const [filtroCoach, setFiltroCoach] = useState('todos');

  const hoyStr = getHoyStr();

  const fetchHorarios = async () => {
    try {
      // Consultar en paralelo los horarios disponibles y las reservas del usuario
      const [resHorarios, resReservas] = await Promise.allSettled([
        api.get(`/horarios?fecha_desde=${hoyStr}`),
        api.get('/reservas/mis-reservas'),
      ]);

      if (resReservas.status === 'fulfilled' && resReservas.value?.data?.ok) {
        const proximas = resReservas.value.data.data?.proximas || [];
        const ids = new Set(
          proximas.filter((r) => r.estado === 'confirmada').map((r) => r.id_horario)
        );
        setMisReservasIds(ids);
      }

      if (resHorarios.status === 'fulfilled' && resHorarios.value?.data?.ok) {
        const todos = resHorarios.value.data.data.horarios || [];
        // Filtro estricto: sólo clases con fecha y hora estrictamente futuras
        const validos = todos.filter((h) => esHorarioFuturo(h.fecha, h.hora_inicio));
        setHorarios(validos);
        setIsOffline(false);
        // Persistir en caché local
        AsyncStorage.setItem(
          '@smartgym_cache_horarios',
          JSON.stringify({ horarios: validos, timestamp: Date.now() })
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('Error al cargar horarios online, leyendo de caché:', err.message);
      try {
        const cached = await AsyncStorage.getItem('@smartgym_cache_horarios');
        if (cached) {
          const parsed = JSON.parse(cached);
          const validos = (parsed.horarios || []).filter((h) =>
            esHorarioFuturo(h.fecha, h.hora_inicio)
          );
          setHorarios(validos);
          setIsOffline(true);
        }
      } catch (cacheErr) {
        console.warn('Error cargando caché de horarios:', cacheErr.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHorarios();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHorarios();
  };

  // Calcular disciplinas y entrenadores únicos para los chips
  const { disciplinasDisponibles, coachesDisponibles } = useMemo(() => {
    const discSet = new Set();
    const coachSet = new Set();

    horarios.forEach((h) => {
      if (h.clase_nombre) discSet.add(h.clase_nombre);
      if (h.entrenador_nombre) coachSet.add(h.entrenador_nombre);
    });

    return {
      disciplinasDisponibles: Array.from(discSet),
      coachesDisponibles: Array.from(coachSet),
    };
  }, [horarios]);

  // Filtrado compuesto
  const horariosFiltrados = useMemo(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().substring(0, 10);

    return horarios.filter((h) => {
      // Regla Mandatoria: Excluir clases cuya fecha y hora de inicio ya hayan pasado
      if (!esHorarioFuturo(h.fecha, h.hora_inicio)) return false;

      const f = getFechaNormalizada(h.fecha);

      // Filtro por Fecha
      if (filtroFecha === 'hoy' && f !== hoyStr) return false;
      if (filtroFecha === 'manana' && f !== mananaStr) return false;
      if (filtroFecha === 'posteriores' && f <= mananaStr) return false;

      // Filtro por Disciplina / Tipo de clase
      if (filtroDisciplina !== 'todas' && h.clase_nombre !== filtroDisciplina) {
        return false;
      }

      // Filtro por Entrenador
      if (filtroCoach !== 'todos' && h.entrenador_nombre !== filtroCoach) {
        return false;
      }

      // Buscador
      if (search.trim()) {
        const q = search.toLowerCase();
        const coincideClase = h.clase_nombre?.toLowerCase().includes(q);
        const coincideCoach = h.entrenador_nombre?.toLowerCase().includes(q);
        const coincideTipo = h.tipo_clase_nombre?.toLowerCase().includes(q);
        if (!coincideClase && !coincideCoach && !coincideTipo) return false;
      }

      return true;
    });
  }, [horarios, filtroFecha, filtroDisciplina, filtroCoach, search, hoyStr]);

  const renderBadgeCupos = (cupos, capacidad, estado) => {
    if (cupos === 0 || estado === 'lleno') {
      return (
        <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <Ionicons name="close-circle" size={11} color={colors.danger} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: colors.danger }]}>AFORO COMPLETO</Text>
        </View>
      );
    }

    if (cupos <= 5) {
      return (
        <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Ionicons name="flame" size={11} color={colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: colors.accent }]}>¡ÚLTIMOS {cupos} CUPOS!</Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
        <Ionicons name="checkmark-circle" size={11} color={colors.secondary} style={{ marginRight: 4 }} />
        <Text style={[styles.badgeText, { color: colors.secondary }]}>{cupos} CUPOS LIBRES</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const fStr = getFechaNormalizada(item.fecha);
    const fObj = new Date(item.fecha);
    const esHoy = fStr === hoyStr;
    const yaInscrito = misReservasIds.has(item.id_horario);

    const fechaFormateada = esHoy
      ? `Hoy, ${fObj.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`
      : fObj.toLocaleDateString('es-PE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('DetalleClase', {
            horario: item,
            yaInscrito,
            onReserved: fetchHorarios,
          })
        }
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.claseTipo}>{item.tipo_clase_nombre || 'FITNESS'}</Text>
              {esHoy && (
                <View style={styles.todayPill}>
                  <Text style={styles.todayPillText}>HOY</Text>
                </View>
              )}
            </View>
            {yaInscrito ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1, borderColor: '#10B981' }]}>
                <Ionicons name="checkmark-circle" size={11} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: '#10B981', fontWeight: '800' }]}>YA INSCRITO</Text>
              </View>
            ) : (
              renderBadgeCupos(item.cupos_disponibles, item.capacidad_maxima, item.estado)
            )}
          </View>

          <Text style={styles.claseTitulo}>{item.clase_nombre}</Text>
          <Text style={styles.claseDesc} numberOfLines={2}>
            {item.clase_descripcion}
          </Text>

          <View style={styles.cardDivider} />

          <View style={styles.cardFooter}>
            <View style={styles.footerInfo}>
              <View style={styles.iconTextRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.footerTextDate}>{fechaFormateada}</Text>
              </View>

              <View style={[styles.iconTextRow, { marginTop: 4 }]}>
                <Ionicons name="time-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.footerText}>
                  {item.hora_inicio?.substring(0, 5)} - {item.hora_fin?.substring(0, 5)} ({item.duracion_minutos} min)
                </Text>
              </View>

              <View style={[styles.iconTextRow, { marginTop: 4 }]}>
                <Ionicons name="fitness-outline" size={14} color={colors.secondary} style={{ marginRight: 6 }} />
                <Text style={styles.trainerText}>
                  Coach: {item.entrenador_nombre} {item.especialidad_nombre ? `• ${item.especialidad_nombre}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.actionArrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <View style={styles.badgeRow}>
          <Ionicons name="barbell" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.badgeHeader}>DISPONIBILIDAD EN TIEMPO REAL</Text>
        </View>
        <Text style={styles.screenTitle}>Clases Disponibles</Text>
        <Text style={styles.screenSubtitle}>
          Sesiones programadas para hoy y próximos días con entrenadores certificados
        </Text>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              Modo Offline: Mostrando catálogo guardado en tu teléfono
            </Text>
          </View>
        )}
      </View>

      {/* Buscador */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar disciplina o entrenador..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* FILTROS HORIZONTALES */}
      <View style={styles.filtersSection}>
        {/* 1. Filtro por Fecha */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Text style={styles.filterGroupLabel}>Fecha:</Text>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'hoy', label: 'Hoy' },
            { id: 'manana', label: 'Mañana' },
            { id: 'posteriores', label: 'Próximos días' },
          ].map((f) => {
            const isSel = filtroFecha === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isSel && styles.filterChipSelected]}
                onPress={() => setFiltroFecha(f.id)}
              >
                <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. Filtro por Disciplina */}
        {disciplinasDisponibles.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { marginTop: 6 }]}>
            <Text style={styles.filterGroupLabel}>Clase:</Text>
            <TouchableOpacity
              style={[styles.filterChip, filtroDisciplina === 'todas' && styles.filterChipSelected]}
              onPress={() => setFiltroDisciplina('todas')}
            >
              <Text style={[styles.filterChipText, filtroDisciplina === 'todas' && styles.filterChipTextSelected]}>
                Todas
              </Text>
            </TouchableOpacity>
            {disciplinasDisponibles.map((disc) => {
              const isSel = filtroDisciplina === disc;
              return (
                <TouchableOpacity
                  key={disc}
                  style={[styles.filterChip, isSel && styles.filterChipSelected]}
                  onPress={() => setFiltroDisciplina(disc)}
                >
                  <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                    {disc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 3. Filtro por Coach */}
        {coachesDisponibles.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { marginTop: 6 }]}>
            <Text style={styles.filterGroupLabel}>Coach:</Text>
            <TouchableOpacity
              style={[styles.filterChip, filtroCoach === 'todos' && styles.filterChipSelected]}
              onPress={() => setFiltroCoach('todos')}
            >
              <Text style={[styles.filterChipText, filtroCoach === 'todos' && styles.filterChipTextSelected]}>
                Todos
              </Text>
            </TouchableOpacity>
            {coachesDisponibles.map((coach) => {
              const isSel = filtroCoach === coach;
              return (
                <TouchableOpacity
                  key={coach}
                  style={[styles.filterChip, isSel && styles.filterChipSelected]}
                  onPress={() => setFiltroCoach(coach)}
                >
                  <Text style={[styles.filterChipText, isSel && styles.filterChipTextSelected]}>
                    {coach}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Contador de resultados */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {horariosFiltrados.length} sesión(es) disponible(s) encontrada(s)
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Cargando horarios...</Text>
        </View>
      ) : (
        <FlatList
          data={horariosFiltrados}
          keyExtractor={(item) => item.id_horario.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={50} color={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No hay clases disponibles</Text>
              <Text style={styles.emptySubtitle}>
                No se encontraron horarios programados para los filtros seleccionados. Recuerda que no se muestran sesiones de días pasados.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  filtersSection: {
    marginBottom: 6,
  },
  filterScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    marginRight: 4,
  },
  filterChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  countRow: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  card: {
    marginVertical: 6,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  claseTipo: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  todayPill: {
    backgroundColor: 'rgba(255, 87, 34, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  todayPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  claseTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  claseDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfo: {
    flex: 1,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerTextDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  trainerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  offlineBannerText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
