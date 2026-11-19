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

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const getFechaNormalizada = (f) => {
  if (!f) return '';
  if (typeof f === 'string') return f.substring(0, 10);
  const d = new Date(f);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Verifica si una clase es estrictamente futura respecto a la fecha y hora actual
const esHorarioFuturo = (fechaStr, horaInicioStr) => {
  if (!fechaStr) return false;
  try {
    const fStr = typeof fechaStr === 'string' ? fechaStr.substring(0, 10) : new Date(fechaStr).toISOString().substring(0, 10);
    const hStr = (horaInicioStr || '00:00:00').substring(0, 8);
    const [y, m, d] = fStr.split('-').map(Number);
    const [hh, mm, ss] = hStr.split(':').map(Number);
    const fechaHoraClase = new Date(y, m - 1, d, hh, mm || 0, ss || 0);
    return fechaHoraClase > new Date();
  } catch {
    return false;
  }
};

// Verifica si la fecha está dentro de 1 semana (7 días) posterior al día de hoy
const dentroDeUnaSemana = (fechaStr) => {
  if (!fechaStr) return false;
  try {
    const fStr = typeof fechaStr === 'string' ? fechaStr.substring(0, 10) : new Date(fechaStr).toISOString().substring(0, 10);
    const dLimite = new Date();
    dLimite.setDate(dLimite.getDate() + 7);
    const y = dLimite.getFullYear();
    const m = String(dLimite.getMonth() + 1).padStart(2, '0');
    const d = String(dLimite.getDate()).padStart(2, '0');
    const limiteStr = `${y}-${m}-${d}`;
    return fStr <= limiteStr;
  } catch {
    return false;
  }
};

// Verifica si pertenece exactamente al mismo profesor
const esMismoProfesor = (horario, reserva) => {
  if (!reserva) return true;
  if (reserva.id_entrenador && horario.id_entrenador) {
    return Number(horario.id_entrenador) === Number(reserva.id_entrenador);
  }
  if (reserva.entrenador_nombre && horario.entrenador_nombre) {
    return (
      reserva.entrenador_nombre.trim().toLowerCase() ===
      horario.entrenador_nombre.trim().toLowerCase()
    );
  }
  return false;
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
  const [fechaExacta, setFechaExacta] = useState(null); // 'YYYY-MM-DD' o null
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');

  // Estados para Calendario Interactivo
  const [modalCalendarioVisible, setModalCalendarioVisible] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());

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

  // Verifica si una clase es modificable (no es pasada y faltan >= 1 hora)
  const esClaseModificable = (item) => {
    if (item.estado !== 'confirmada') return false;
    if (!item.fecha) return false;
    try {
      const fStr = typeof item.fecha === 'string'
        ? item.fecha.substring(0, 10)
        : new Date(item.fecha).toISOString().substring(0, 10);
      const hStr = (item.hora_inicio || '00:00:00').substring(0, 8);
      const [y, m, d] = fStr.split('-').map(Number);
      const [hh, mm, ss] = hStr.split(':').map(Number);
      const fechaHoraClase = new Date(y, m - 1, d, hh, mm || 0, ss || 0);
      const ahora = new Date();

      // Regla 1: Si la fecha u hora ya pasaron respecto a la hora actual -> NO PERMITIR
      if (fechaHoraClase <= ahora) {
        return false;
      }

      // Regla 2: Límite de 1 hora de anticipación
      const diffMs = fechaHoraClase.getTime() - ahora.getTime();
      const diffHoras = diffMs / (1000 * 60 * 60);
      return diffHoras >= 1;
    } catch {
      return false;
    }
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

  const abrirModalReprogramar = async (reserva) => {
    setReservaSeleccionada(reserva);
    setNuevoHorarioId(null);
    setMotivoSeleccionado(MOTIVOS_PREDETERMINADOS[0]);
    setMotivoTexto('');
    setModalVisible(true);
    setLoadingHorarios(true);

    try {
      const hoyStr = getFechaNormalizada(new Date());
      const queryParams = new URLSearchParams();
      queryParams.append('fecha_desde', hoyStr);
      if (reserva.id_entrenador) {
        queryParams.append('id_entrenador', reserva.id_entrenador);
      }

      const res = await api.get(`/horarios?${queryParams.toString()}`);
      if (res.data.ok) {
        const todos = res.data.data.horarios || [];
        const disponibles = todos.filter((h) => {
          // 1. Excluir el horario actual de la reserva
          if (h.id_horario === reserva.id_horario) return false;
          // 2. Solo clases con cupos disponibles
          if (h.cupos_disponibles <= 0) return false;
          // 3. Solo del mismo profesor en el que estaba
          if (!esMismoProfesor(h, reserva)) return false;
          // 4. No mostrar clases anteriores (solo clases futuras respecto a fecha y hora actual)
          if (!esHorarioFuturo(h.fecha, h.hora_inicio)) return false;
          // 5. Límite de 1 semana (7 días) posterior al día de hoy
          if (!dentroDeUnaSemana(h.fecha)) return false;
          return true;
        });
        setHorariosDisponibles(disponibles);
      }
    } catch (err) {
      console.warn('Error cargando horarios disponibles:', err.message);
      Alert.alert('Error', 'No se pudieron cargar horarios para reprogramar.');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const ejecutarReprogramacion = async () => {
    if (!nuevoHorarioId) {
      Alert.alert('Selección requerida', 'Por favor selecciona el nuevo horario al que deseas cambiar tu clase.');
      return;
    }

    const motivoFinal = motivoSeleccionado === 'Otro motivo' ? motivoTexto.trim() : motivoSeleccionado;
    if (!motivoFinal) {
      Alert.alert('Motivo requerido', 'Por favor describe brevemente el motivo de la reprogramación.');
      return;
    }

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

  // Base de datos de reservas de la pestaña activa
  const listaBase = activeTab === 'proximas' ? proximas : historial;

  // Fechas que tienen reservas registradas para marcar con puntos en el calendario
  const fechasConReservas = useMemo(() => {
    const set = new Set();
    listaBase.forEach((r) => {
      if (r.fecha) {
        set.add(getFechaNormalizada(r.fecha));
      }
    });
    return set;
  }, [listaBase]);

  // Generador de la cuadrícula mensual del calendario
  const diasCalendario = useMemo(() => {
    const año = mesCalendario.getFullYear();
    const mes = mesCalendario.getMonth();

    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const totalDias = ultimoDia.getDate();

    let primerDiaSemana = primerDia.getDay() - 1; // 0 = Lunes, 6 = Domingo
    if (primerDiaSemana === -1) primerDiaSemana = 6;

    const dias = [];
    for (let i = 0; i < primerDiaSemana; i++) {
      dias.push({ esVacio: true, id: `empty-${i}` });
    }

    for (let d = 1; d <= totalDias; d++) {
      const diaStr = String(d).padStart(2, '0');
      const mesStr = String(mes + 1).padStart(2, '0');
      const fechaISO = `${año}-${mesStr}-${diaStr}`;
      const tieneReserva = fechasConReservas.has(fechaISO);
      dias.push({
        esVacio: false,
        numero: d,
        fechaISO,
        tieneReserva,
        id: fechaISO,
      });
    }

    return dias;
  }, [mesCalendario, fechasConReservas]);

  const cambiarMesCalendario = (offset) => {
    setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const seleccionarFechaCalendario = (fechaISO) => {
    setFechaExacta(fechaISO);
    setFiltroFecha('exacta');
    setModalCalendarioVisible(false);
  };

  const limpiarFiltroFecha = () => {
    setFechaExacta(null);
    setFiltroFecha('todas');
  };

  // Extraer tipos de disciplinas presentes
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

      // 1. Filtro por fecha exacta (Calendario)
      if (fechaExacta) {
        if (f !== fechaExacta) return false;
      } else {
        // Filtros rápidos
        if (filtroFecha === 'hoy' && f !== hoyStr) return false;
        if (filtroFecha === 'semana' && (f < inicioSemana || f > finSemana)) return false;
        if (filtroFecha === 'mes' && !f.startsWith(mesActual)) return false;
      }

      // 2. Filtro por disciplina
      if (filtroDisciplina !== 'todas' && item.clase_nombre !== filtroDisciplina) {
        return false;
      }

      // 3. Buscador
      if (search.trim()) {
        const q = search.toLowerCase();
        const coincideClase = item.clase_nombre?.toLowerCase().includes(q);
        const coincideCoach = item.entrenador_nombre?.toLowerCase().includes(q);
        if (!coincideClase && !coincideCoach) return false;
      }

      return true;
    });
  }, [listaBase, filtroFecha, fechaExacta, filtroDisciplina, search]);

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

  // Render del estado de asistencia: Verde con check "Asistió", Rojo con cruz "No asistió", Azul "Pendiente"
  const renderIndicadorAsistencia = (item) => {
    const fStr = typeof item.fecha === 'string'
      ? item.fecha.substring(0, 10)
      : new Date(item.fecha).toISOString().substring(0, 10);
    const hStr = (item.hora_inicio || '00:00:00').substring(0, 8);
    const [y, m, d] = fStr.split('-').map(Number);
    const [hh, mm] = hStr.split(':').map(Number);
    const fechaHoraClase = new Date(y, m - 1, d, hh, mm || 0);
    const yaOcurrio = fechaHoraClase < new Date();

    // 1. Sí asistió (Verde)
    if (item.asistio === 'si' || item.asistio === true || item.asistio === 1) {
      return (
        <View style={[styles.asistenciaBadge, styles.asistenciaBadgeVerde]}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 5 }} />
          <Text style={styles.asistenciaTextVerde}>Asistió</Text>
        </View>
      );
    }

    // 2. No asistió (Rojo - en clases pasadas no registradas o marcadas como 'no')
    if (item.asistio === 'no' || (yaOcurrio && item.estado !== 'cancelada')) {
      return (
        <View style={[styles.asistenciaBadge, styles.asistenciaBadgeRojo]}>
          <Ionicons name="close-circle" size={14} color="#EF4444" style={{ marginRight: 5 }} />
          <Text style={styles.asistenciaTextRojo}>No asistió</Text>
        </View>
      );
    }

    // 3. Cancelada
    if (item.estado === 'cancelada') {
      return (
        <View style={[styles.asistenciaBadge, styles.asistenciaBadgeGris]}>
          <Ionicons name="ban-outline" size={14} color="#94A3B8" style={{ marginRight: 5 }} />
          <Text style={styles.asistenciaTextGris}>Cancelada</Text>
        </View>
      );
    }

    // 4. Pendiente (Clase futura)
    return (
      <View style={[styles.asistenciaBadge, styles.asistenciaBadgeAzul]}>
        <Ionicons name="hourglass-outline" size={14} color="#38BDF8" style={{ marginRight: 5 }} />
        <Text style={styles.asistenciaTextAzul}>Pendiente de sesión</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const fechaFormateada = formatearFecha(item.fecha);
    const puedeModificar = esClaseModificable(item);

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

          {/* Estado de Asistencia Destacado */}
          <View style={[styles.iconTextRow, { marginTop: 6, alignItems: 'center' }]}>
            <Text style={[styles.detailText, { marginRight: 6, fontWeight: '700' }]}>
              Asistencia:
            </Text>
            {renderIndicadorAsistencia(item)}
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

        {/* Solo mostrar opciones de reprogramar/cancelar si NO es clase pasada y falta al menos 1 hora */}
        {puedeModificar && (
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

  const hoyISO = getFechaNormalizada(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Mis Reservas</Text>
        <Text style={styles.screenSubtitle}>
          Consulta tus citas programadas, filtra por fecha exacta en el calendario y gestiona tus cupos
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
              setFechaExacta(null);
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
              setFechaExacta(null);
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

      {/* FILTROS POR FECHA (CALENDARIO + CHIPS) Y DISCIPLINA */}
      <View style={styles.filtersSection}>
        {/* Barra de Filtro de Fecha con Botón de Calendario */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Text style={styles.filterLabel}>Fecha:</Text>

          {/* Botón interactivo de Calendario */}
          <TouchableOpacity
            style={[styles.calendarFilterBtn, fechaExacta && styles.calendarFilterBtnActive]}
            onPress={() => setModalCalendarioVisible(true)}
          >
            <Ionicons
              name="calendar"
              size={14}
              color={fechaExacta ? '#FFF' : colors.primary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.calendarFilterBtnText, fechaExacta && { color: '#FFF' }]}>
              {fechaExacta ? `Día: ${formatearFecha(fechaExacta)}` : 'Ver Calendario'}
            </Text>
            {fechaExacta && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  limpiarFiltroFecha();
                }}
                style={{ marginLeft: 6 }}
              >
                <Ionicons name="close-circle" size={14} color="#FFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {[
            { id: 'todas', label: 'Todas' },
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Esta semana' },
            { id: 'mes', label: 'Este mes' },
          ].map((f) => {
            const isSel = !fechaExacta && filtroFecha === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isSel && styles.filterChipSelected]}
                onPress={() => {
                  setFechaExacta(null);
                  setFiltroFecha(f.id);
                }}
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
          {fechaExacta ? ` del ${formatearFecha(fechaExacta)}` : ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando reservas...</Text>
        </View>
      ) : (
        <FlatList
          data={reservasFiltradas}
          keyExtractor={(item) => String(item.id_reserva)}
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
              <Ionicons
                name={activeTab === 'proximas' ? 'calendar-outline' : 'time-outline'}
                size={54}
                color={colors.textMuted}
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>
                {search || filtroFecha !== 'todas' || filtroDisciplina !== 'todas' || fechaExacta
                  ? 'No se encontraron reservas con esos filtros'
                  : activeTab === 'proximas'
                  ? 'No tienes reservas próximas activas'
                  : 'Aún no tienes un historial de reservas pasadas'}
              </Text>
              <Text style={styles.emptyText}>
                {search || filtroFecha !== 'todas' || filtroDisciplina !== 'todas' || fechaExacta
                  ? 'Intenta restablecer los filtros de fecha o búsqueda para ver más clases.'
                  : activeTab === 'proximas'
                  ? 'Explora el catálogo de disciplinas y agenda tu próxima sesión.'
                  : 'Las clases completadas o canceladas aparecerán aquí como registro.'}
              </Text>
              {fechaExacta && (
                <TouchableOpacity style={styles.clearFilterBtn} onPress={limpiarFiltroFecha}>
                  <Ionicons name="refresh-outline" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.clearFilterBtnText}>Ver todas las fechas</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* =========================================================================
          MODAL DE CALENDARIO INTERACTIVO (Filtro por Fecha Exacta)
          ========================================================================= */}
      <Modal
        visible={modalCalendarioVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCalendarioVisible(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            {/* Cabecera del Calendario */}
            <View style={styles.calendarHeaderRow}>
              <View>
                <Text style={styles.calendarModalTitle}>Calendario de Clases</Text>
                <Text style={styles.calendarModalSubtitle}>
                  Selecciona una fecha para ver tus reservas exactas
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalCalendarioVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Controles de Navegación de Mes */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => cambiarMesCalendario(-1)}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthNavText}>
                {MESES_NOMBRES[mesCalendario.getMonth()]} {mesCalendario.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => cambiarMesCalendario(1)}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Días de la semana */}
            <View style={styles.weekDaysRow}>
              {DIAS_SEMANA_CORTO.map((dia, idx) => (
                <Text key={idx} style={styles.weekDayHeader}>
                  {dia}
                </Text>
              ))}
            </View>

            {/* Cuadrícula de Días */}
            <View style={styles.calendarGrid}>
              {diasCalendario.map((dia) => {
                if (dia.esVacio) {
                  return <View key={dia.id} style={styles.calendarDayEmpty} />;
                }

                const esSeleccionado = fechaExacta === dia.fechaISO;
                const esHoy = hoyISO === dia.fechaISO;

                return (
                  <TouchableOpacity
                    key={dia.id}
                    style={[
                      styles.calendarDayCell,
                      esHoy && styles.calendarDayCellToday,
                      esSeleccionado && styles.calendarDayCellSelected,
                    ]}
                    onPress={() => seleccionarFechaCalendario(dia.fechaISO)}
                  >
                    <Text
                      style={[
                        styles.calendarDayNumber,
                        esHoy && styles.calendarDayNumberToday,
                        esSeleccionado && styles.calendarDayNumberSelected,
                      ]}
                    >
                      {dia.numero}
                    </Text>

                    {/* Puntito indicador si hay reserva en esta fecha */}
                    {dia.tieneReserva && (
                      <View
                        style={[
                          styles.calendarDot,
                          esSeleccionado && { backgroundColor: '#FFF' },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Leyenda y Acciones Rápidas del Calendario */}
            <View style={styles.calendarFooter}>
              <View style={styles.legendRow}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>Días con clases reservadas</Text>
              </View>

              <View style={styles.calendarActionButtons}>
                <TouchableOpacity
                  style={styles.calQuickBtn}
                  onPress={() => seleccionarFechaCalendario(hoyISO)}
                >
                  <Ionicons name="today-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.calQuickBtnText}>Ir a Hoy</Text>
                </TouchableOpacity>

                {fechaExacta && (
                  <TouchableOpacity
                    style={[styles.calQuickBtn, { borderColor: colors.danger }]}
                    onPress={limpiarFiltroFecha}
                  >
                    <Ionicons name="refresh-outline" size={14} color={colors.danger} style={{ marginRight: 4 }} />
                    <Text style={[styles.calQuickBtnText, { color: colors.danger }]}>Todas</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL DE REPROGRAMACIÓN DE CLASE (Regla de > 1 hora)
          ========================================================================= */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reprogramar Clase</Text>
                <Text style={styles.modalSub}>
                  {reservaSeleccionada?.clase_nombre} • {formatearFecha(reservaSeleccionada?.fecha)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="person" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                    Coach: {reservaSeleccionada?.entrenador_nombre || 'Asignado'} (Próximos 7 días)
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.ruleNotice}>
                <Ionicons name="shield-checkmark" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleNoticeTitle}>Regla de Instructor & Fecha Límite</Text>
                  <Text style={styles.ruleNoticeDesc}>
                    Se muestran únicamente las clases posteriores del mismo profesor ({reservaSeleccionada?.entrenador_nombre || 'asignado'}) dentro de los próximos 7 días a partir de hoy.
                  </Text>
                </View>
              </View>

              <Text style={styles.modalSectionLabel}>1. Selecciona el nuevo horario disponible</Text>
              {loadingHorarios ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 14 }} />
              ) : horariosDisponibles.length === 0 ? (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderRadius: 10, padding: 14, marginVertical: 10 }}>
                  <Text style={[styles.noHorariosText, { color: '#FCA5A5', marginVertical: 0 }]}>
                    No hay otras clases posteriores disponibles con el coach {reservaSeleccionada?.entrenador_nombre || 'asignado'} dentro de los próximos 7 días con cupos libres.
                  </Text>
                </View>
              ) : (
                horariosDisponibles.map((h) => {
                  const isSelected = nuevoHorarioId === h.id_horario;
                  return (
                    <TouchableOpacity
                      key={h.id_horario}
                      style={[
                        styles.scheduleOption,
                        isSelected && styles.scheduleOptionSelected,
                      ]}
                      onPress={() => setNuevoHorarioId(h.id_horario)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optClaseTitle}>{h.clase_nombre}</Text>
                        <Text style={styles.optClaseSub}>
                          {formatearFecha(h.fecha)} • {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
                        </Text>
                        <Text style={styles.optCoach}>
                          Coach: {h.entrenador_nombre || 'Asignado'} • {h.cupos_disponibles} cupos libres
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}

              <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>2. Motivo de la reprogramación</Text>
              <View style={styles.motivosGrid}>
                {MOTIVOS_PREDETERMINADOS.map((motivo) => {
                  const isSel = motivoSeleccionado === motivo;
                  return (
                    <TouchableOpacity
                      key={motivo}
                      style={[styles.motivoChip, isSel && styles.motivoChipSelected]}
                      onPress={() => setMotivoSeleccionado(motivo)}
                    >
                      <Text style={[styles.motivoChipText, isSel && styles.motivoChipTextSelected]}>
                        {motivo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {motivoSeleccionado === 'Otro motivo' && (
                <TextInput
                  style={styles.motivoInput}
                  placeholder="Detalla brevemente tu motivo..."
                  placeholderTextColor={colors.textMuted}
                  value={motivoTexto}
                  onChangeText={setMotivoTexto}
                  multiline
                  numberOfLines={2}
                />
              )}
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
                  (!nuevoHorarioId || guardandoReprogramacion) && { opacity: 0.6 },
                ]}
                disabled={!nuevoHorarioId || guardandoReprogramacion}
                onPress={ejecutarReprogramacion}
              >
                {guardandoReprogramacion ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={16} color="#FFF" style={{ marginRight: 6 }} />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#FFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  filtersSection: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filterScroll: {
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: 2,
    textTransform: 'uppercase',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
  calendarFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calendarFilterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calendarFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
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

  // Badges de Asistencia
  asistenciaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  asistenciaBadgeVerde: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  asistenciaTextVerde: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  asistenciaBadgeRojo: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  asistenciaTextRojo: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  asistenciaBadgeAzul: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  asistenciaTextAzul: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  asistenciaBadgeGris: {
    backgroundColor: 'rgba(100, 116, 139, 0.14)',
  },
  asistenciaTextGris: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
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
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearFilterBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Modal de Reprogramación
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

  // Estilos del Modal de Calendario
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  calendarModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  calendarModalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  monthNavText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayHeader: {
    width: 40,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDayEmpty: {
    width: 40,
    height: 40,
    marginVertical: 2,
  },
  calendarDayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    position: 'relative',
  },
  calendarDayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  calendarDayCellSelected: {
    backgroundColor: colors.primary,
  },
  calendarDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  calendarDayNumberToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  calendarDayNumberSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    position: 'absolute',
    bottom: 4,
  },
  calendarFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  calendarActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  calQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
