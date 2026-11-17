import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

const MOTIVOS_PREDETERMINADOS = [
  'Horario laboral / estudio',
  'Inconveniente de salud',
  'Emergencia personal / familiar',
  'Transporte o tráfico',
  'Otro motivo',
];

const getFechaNormalizada = (f) => {
  if (!f) return '';
  if (typeof f === 'string') return f.substring(0, 10);
  const d = new Date(f);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatearFecha = (f) => {
  if (!f) return '';
  const str = typeof f === 'string' ? f.substring(0, 10) : '';
  if (str) {
    const [y, m, d] = str.split('-').map(Number);
    const fechaObj = new Date(y, m - 1, d, 12, 0, 0);
    return fechaObj.toLocaleDateString('es-PE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
  return new Date(f).toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

export default function MisReservasScreen() {
  const [activeTab, setActiveTab] = useState('proximas'); // 'proximas' | 'historial'
  const [proximas, setProximas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('todas'); // 'todas' | 'hoy' | 'semana' | 'mes'
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');

  // Estados para modal de reprogramación
  const [modalVisible, setModalVisible] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [nuevoHorarioId, setNuevoHorarioId] = useState(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState(MOTIVOS_PREDETERMINADOS[0]);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [guardandoReprogramacion, setGuardandoReprogramacion] = useState(false);

  const fetchReservas = async () => {
    try {
      const res = await api.get('/reservas/mis-reservas');
      if (res.data.ok) {
        const prox = res.data.data.proximas || [];
        const hist = res.data.data.historial || [];
        setProximas(prox);
        setHistorial(hist);
        setIsOffline(false);
        // Persistir en caché local
        AsyncStorage.setItem(
          '@smartgym_cache_reservas',
          JSON.stringify({ proximas: prox, historial: hist, timestamp: Date.now() })
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('Error al cargar reservas online, leyendo de caché:', err.message);
      try {
        const cached = await AsyncStorage.getItem('@smartgym_cache_reservas');
        if (cached) {
          const parsed = JSON.parse(cached);
          setProximas(parsed.proximas || []);
          setHistorial(parsed.historial || []);
          setIsOffline(true);
        }
      } catch (cacheErr) {
        console.warn('Error cargando caché de reservas:', cacheErr.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservas();
  };

  const handleCancelarReserva = (reserva) => {
    Alert.alert(
      'Cancelar Reserva',
      `¿Estás seguro de que deseas cancelar tu clase de "${reserva.clase_nombre}"? El cupo se liberará automáticamente para otro socio.`,
      [
        { text: 'No, mantener mi cupo', style: 'cancel' },
        {
          text: 'Sí, cancelar clase',
          style: 'destructive',
          onPress: () => ejecutarCancelacion(reserva.id_reserva),
        },
      ]
    );
  };

  const ejecutarCancelacion = async (idReserva) => {
    try {
      setCancelingId(idReserva);
      const res = await api.put(`/reservas/${idReserva}/cancelar`);
      if (res.data.ok) {
        Alert.alert('Cancelada', 'Tu reserva ha sido cancelada y el cupo fue devuelto exitosamente.');
        fetchReservas();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al cancelar la reserva';
      Alert.alert('Error', msg);
    } finally {
      setCancelingId(null);
    }
  };

  // Abrir Modal de Reprogramación
  const abrirModalReprogramar = async (reserva) => {
    setReservaSeleccionada(reserva);
    setNuevoHorarioId(null);
    setMotivoSeleccionado(MOTIVOS_PREDETERMINADOS[0]);
    setMotivoTexto('');
    setModalVisible(true);
    setLoadingHorarios(true);

    try {
      // Excluir días anteriores al reprogramar
      const hoy = new Date().toISOString().substring(0, 10);
      const res = await api.get(`/horarios?fecha_desde=${hoy}`);
      if (res.data.ok) {
        const todos = res.data.data.horarios || [];
        const filtrados = todos.filter((h) => {
          if (h.id_horario === reserva.id_horario) return false;
          if (h.cupos_disponibles <= 0) return false;
          const f = getFechaNormalizada(h.fecha);
          return f >= hoy;
        });
        setHorariosDisponibles(filtrados);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los horarios disponibles.');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const confirmarReprogramacion = async () => {
    if (!nuevoHorarioId) {
      Alert.alert('Selección requerida', 'Por favor selecciona el nuevo horario al que deseas cambiarte.');
      return;
    }

    const motivoFinal = motivoTexto.trim()
      ? `${motivoSeleccionado}: ${motivoTexto.trim()}`
      : motivoSeleccionado;

    try {
      setGuardandoReprogramacion(true);
      const res = await api.put(`/reservas/${reservaSeleccionada.id_reserva}/reprogramar`, {
        nuevo_id_horario: nuevoHorarioId,
        motivo: motivoFinal,
      });

      if (res.data.ok) {
        setModalVisible(false);
        Alert.alert(
          '¡Reprogramación Exitosa!',
          'Tu clase ha sido reprogramada. Tu cupo en el horario anterior fue liberado inmediatamente.',
          [{ text: 'Entendido', onPress: fetchReservas }]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'No se pudo reprogramar la reserva';
      Alert.alert('No se pudo reprogramar', msg);
    } finally {
      setGuardandoReprogramacion(false);
    }
  };

  // Extraer tipos de disciplinas presentes
  const listaBase = activeTab === 'proximas' ? proximas : historial;

  const disciplinasPresentes = useMemo(() => {
    const set = new Set();
    listaBase.forEach((r) => {
      if (r.clase_nombre) set.add(r.clase_nombre);
    });
    return Array.from(set);
  }, [listaBase]);

  // Filtrado compuesto
  const reservasFiltradas = useMemo(() => {
    const ahora = new Date();
    const hoyStr = getFechaNormalizada(ahora);

    // Calcular inicio y fin de esta semana sin mutar
    const diaSemana = ahora.getDay();
    const difInicio = ahora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const inicioSemanaObj = new Date(ahora.getFullYear(), ahora.getMonth(), difInicio, 12, 0, 0);
    const inicioSemana = getFechaNormalizada(inicioSemanaObj);
    const finSemanaObj = new Date(inicioSemanaObj);
    finSemanaObj.setDate(finSemanaObj.getDate() + 6);
    const finSemana = getFechaNormalizada(finSemanaObj);

    // Mes actual: YYYY-MM
    const mesActual = hoyStr.substring(0, 7);

    return listaBase.filter((item) => {
      const f = getFechaNormalizada(item.fecha);

      // Filtro por fecha
      if (filtroFecha === 'hoy' && f !== hoyStr) return false;
      if (filtroFecha === 'semana' && (f < inicioSemana || f > finSemana)) return false;
      if (filtroFecha === 'mes' && !f.startsWith(mesActual)) return false;

      // Filtro por disciplina
      if (filtroDisciplina !== 'todas' && item.clase_nombre !== filtroDisciplina) {
        return false;
      }

      // Buscador
      if (search.trim()) {
        const q = search.toLowerCase();
        const coincideClase = item.clase_nombre?.toLowerCase().includes(q);
        const coincideCoach = item.entrenador_nombre?.toLowerCase().includes(q);
        if (!coincideClase && !coincideCoach) return false;
      }

      return true;
    });
  }, [listaBase, filtroFecha, filtroDisciplina, search]);

  const renderBadgeEstado = (estado, tieneReprogramacion) => {
    switch (estado) {
      case 'confirmada':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {tieneReprogramacion && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', marginRight: 6 }]}>
                <Ionicons name="swap-horizontal" size={11} color={colors.accent} style={{ marginRight: 3 }} />
                <Text style={[styles.statusText, { color: colors.accent }]}>REPROGRAMADA</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="checkmark-circle" size={11} color={colors.secondary} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: colors.secondary }]}>CONFIRMADA</Text>
            </View>
          </View>
        );
      case 'cancelada':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="close-circle" size={11} color={colors.danger} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: colors.danger }]}>CANCELADA</Text>
          </View>
        );
      case 'finalizada':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons name="checkmark-done" size={11} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#60A5FA' }]}>FINALIZADA</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderItem = ({ item }) => {
    const fechaFormateada = formatearFecha(item.fecha);

    const esActiva = item.estado === 'confirmada';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconTextRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.claseFecha}>{fechaFormateada}</Text>
          </View>
          {renderBadgeEstado(item.estado, Boolean(item.id_reprogramacion))}
        </View>

        <Text style={styles.claseTitulo}>{item.clase_nombre}</Text>

        <View style={styles.detailsRow}>
          <View style={styles.iconTextRow}>
            <Ionicons name="time-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>
              Horario: {item.hora_inicio?.substring(0, 5)} - {item.hora_fin?.substring(0, 5)}
            </Text>
          </View>

          <View style={[styles.iconTextRow, { marginTop: 4 }]}>
            <Ionicons name="person-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>
              Entrenador: {item.entrenador_nombre}
            </Text>
          </View>

          <View style={[styles.iconTextRow, { marginTop: 4 }]}>
            <Ionicons
              name={item.asistio === 'si' ? 'checkmark-circle' : 'hourglass-outline'}
              size={14}
              color={item.asistio === 'si' ? colors.secondary : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.detailText}>
              Asistencia: {item.asistio === 'si' ? 'Asistió' : 'Pendiente de registro'}
            </Text>
          </View>

          {item.reprogramacion_motivo && (
            <View style={[styles.iconTextRow, { marginTop: 6, backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: 6, borderRadius: 6 }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.detailText, { color: colors.accent, fontSize: 11, flex: 1 }]}>
                Motivo reprogramación: {item.reprogramacion_motivo}
              </Text>
            </View>
          )}
        </View>

        {esActiva && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.reprogramButton}
              onPress={() => abrirModalReprogramar(item)}
            >
              <Ionicons name="repeat" size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.reprogramButtonText}>Reprogramar (>1h)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelLinkButton}
              disabled={cancelingId === item.id_reserva}
              onPress={() => handleCancelarReserva(item)}
            >
              {cancelingId === item.id_reserva ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={15} color={colors.danger} style={{ marginRight: 4 }} />
                  <Text style={styles.cancelLinkText}>Cancelar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Mis Reservas</Text>
        <Text style={styles.screenSubtitle}>
          Consulta tus citas programadas, filtra por fecha o clase, y reprograma cupos
        </Text>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              Modo Offline: Mostrando tus reservas guardadas en el dispositivo
            </Text>
          </View>
        )}

        {/* Selector de pestañas: Actuales vs Anteriores */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'proximas' && styles.activeTab]}
            onPress={() => {
              setActiveTab('proximas');
              setFiltroDisciplina('todas');
              setFiltroFecha('todas');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'proximas' && styles.activeTabText,
              ]}
            >
              Próximas ({proximas.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'historial' && styles.activeTab]}
            onPress={() => {
              setActiveTab('historial');
              setFiltroDisciplina('todas');
              setFiltroFecha('todas');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'historial' && styles.activeTabText,
              ]}
            >
              Anteriores ({historial.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar reserva por clase o instructor..."
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

      {/* FILTROS POR FECHA Y DISCIPLINA */}
      <View style={styles.filtersSection}>
        {/* Filtro por fecha */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Text style={styles.filterLabel}>Fecha:</Text>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Esta semana' },
            { id: 'mes', label: 'Este mes' },
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

        {/* Filtro por tipo de clase */}
        {disciplinasPresentes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { marginTop: 6 }]}>
            <Text style={styles.filterLabel}>Clase:</Text>
            <TouchableOpacity
              style={[styles.filterChip, filtroDisciplina === 'todas' && styles.filterChipSelected]}
              onPress={() => setFiltroDisciplina('todas')}
            >
              <Text style={[styles.filterChipText, filtroDisciplina === 'todas' && styles.filterChipTextSelected]}>
                Todas
              </Text>
            </TouchableOpacity>
            {disciplinasPresentes.map((disc) => {
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
      </View>

      {/* Contador de resultados */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          Mostrando {reservasFiltradas.length} reserva(s) {activeTab === 'proximas' ? 'actuales' : 'anteriores'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Cargando reservas...</Text>
        </View>
      ) : (
        <FlatList
          data={reservasFiltradas}
          keyExtractor={(item) => item.id_reserva.toString()}
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
              <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>
                {search || filtroFecha !== 'todas' || filtroDisciplina !== 'todas'
                  ? 'No se encontraron reservas con los filtros seleccionados'
                  : activeTab === 'proximas'
                  ? 'No tienes clases programadas activas'
                  : 'Aún no cuentas con historial de reservas pasadas'}
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL DE REPROGRAMACIÓN DE RESERVA */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reprogramar Sesión</Text>
                <Text style={styles.modalSub}>
                  {reservaSeleccionada?.clase_nombre} • Actual: {reservaSeleccionada?.hora_inicio?.substring(0, 5)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Alerta de regla de 24 horas */}
              <View style={styles.ruleNotice}>
                <Ionicons name="time" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleNoticeTitle}>Política de 1 Hora SmartGym</Text>
                  <Text style={styles.ruleNoticeDesc}>
                    Las cancelaciones y reprogramaciones aplican hasta con 1 hora de anticipación al inicio de la sesión. El cupo anterior se libera de inmediato.
                  </Text>
                </View>
              </View>

              {/* Paso 1: Seleccionar nuevo horario */}
              <Text style={styles.modalSectionLabel}>1. Elige tu nuevo horario disponible</Text>
              {loadingHorarios ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : horariosDisponibles.length === 0 ? (
                <Text style={styles.noHorariosText}>
                  No hay otros horarios con cupos disponibles para cambiar en este momento.
                </Text>
              ) : (
                horariosDisponibles.map((h) => {
                  const isSelected = nuevoHorarioId === h.id_horario;
                  const fObj = new Date(h.fecha);
                  const fStr = fObj.toLocaleDateString('es-PE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <TouchableOpacity
                      key={h.id_horario}
                      style={[styles.scheduleOption, isSelected && styles.scheduleOptionSelected]}
                      onPress={() => setNuevoHorarioId(h.id_horario)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optClaseTitle, isSelected && { color: colors.primary }]}>
                          {h.clase_nombre}
                        </Text>
                        <Text style={styles.optClaseSub}>
                          📅 {fStr} • ⏰ {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
                        </Text>
                        <Text style={styles.optCoach}>
                          Instructor: {h.entrenador_nombre} • {h.cupos_disponibles} cupos libres
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Paso 2: Motivo de la reprogramación */}
              <Text style={[styles.modalSectionLabel, { marginTop: 18 }]}>2. Motivo del cambio (Opcional)</Text>
              <View style={styles.motivosGrid}>
                {MOTIVOS_PREDETERMINADOS.map((mot) => {
                  const isMotivoSelected = motivoSeleccionado === mot;
                  return (
                    <TouchableOpacity
                      key={mot}
                      style={[styles.motivoChip, isMotivoSelected && styles.motivoChipSelected]}
                      onPress={() => setMotivoSeleccionado(mot)}
                    >
                      <Text
                        style={[
                          styles.motivoChipText,
                          isMotivoSelected && styles.motivoChipTextSelected,
                        ]}
                      >
                        {mot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.motivoInput}
                placeholder="Detalle adicional (ej: Tengo guardia en el trabajo)..."
                placeholderTextColor={colors.textMuted}
                value={motivoTexto}
                onChangeText={setMotivoTexto}
                maxLength={150}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmReprogramBtn,
                  (!nuevoHorarioId || guardandoReprogramacion) && { opacity: 0.5 },
                ]}
                disabled={!nuevoHorarioId || guardandoReprogramacion}
                onPress={confirmarReprogramacion}
              >
                {guardandoReprogramacion ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmReprogramBtnText}>Confirmar Cambio</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    padding: 20,
    paddingBottom: 8,
    paddingTop: 45,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  filtersSection: {
    marginBottom: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  filterLabel: {
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  claseFecha: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  claseTitulo: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailsRow: {
    marginBottom: 8,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  reprogramButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
  },
  reprogramButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelLinkButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelLinkText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  ruleNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ruleNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 2,
  },
  ruleNoticeDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noHorariosText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 14,
  },
  scheduleOption: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  optClaseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optClaseSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  optCoach: {
    fontSize: 11,
    color: colors.textMuted,
  },
  motivosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  motivoChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  motivoChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  motivoChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  motivoChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  motivoInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.textPrimary,
    padding: 12,
    fontSize: 12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  confirmReprogramBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmReprogramBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
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
