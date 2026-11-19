import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

const getHoyStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const HORARIOS_SUGERIDOS = [
  '07:00',
  '08:30',
  '10:00',
  '11:30',
  '16:00',
  '17:30',
  '19:00',
  '20:30',
];

const MOTIVOS_SUSTITUCION = [
  'Inconveniente de salud / descanso médico',
  'Emergencia personal o familiar impostergable',
  'Coordinación interna de turnos y relevos',
  'Trámite documentario o institucional',
  'Otro motivo justificado',
];

export default function TrainerClasesScreen({ navigation }) {
  const [tabActiva, setTabActiva] = useState('clases'); // 'clases' | 'sustituciones'
  const [clases, setClases] = useState([]);
  const [historialSustituciones, setHistorialSustituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroBandeja, setFiltroBandeja] = useState('hoy'); // 'hoy' (por defecto) | 'todas'

  const hoyStr = getHoyStr();

  const clasesFiltradas = useMemo(() => {
    if (filtroBandeja === 'hoy') {
      return clases.filter((c) => {
        const fStr = typeof c.fecha === 'string' ? c.fecha.substring(0, 10) : new Date(c.fecha).toISOString().substring(0, 10);
        return fStr === hoyStr;
      });
    }
    return clases;
  }, [clases, filtroBandeja, hoyStr]);

  const totalClasesHoy = useMemo(() => {
    return clases.filter((c) => {
      const fStr = typeof c.fecha === 'string' ? c.fecha.substring(0, 10) : new Date(c.fecha).toISOString().substring(0, 10);
      return fStr === hoyStr;
    }).length;
  }, [clases, hoyStr]);

  // Estados Modal Reprogramar (Límite 24h)
  const [modalReprogramar, setModalReprogramar] = useState(false);
  const [claseSeleccionada, setClaseSeleccionada] = useState(null);
  const [fechaNueva, setFechaNueva] = useState('');
  const [horaNueva, setHoraNueva] = useState(HORARIOS_SUGERIDOS[0]);
  const [motivoReprogramar, setMotivoReprogramar] = useState('');
  const [guardandoReprogramar, setGuardandoReprogramar] = useState(false);

  // Estados Modal Sustituir (Flexible en cualquier momento)
  const [modalSustituir, setModalSustituir] = useState(false);
  const [entrenadoresDisponibles, setEntrenadoresDisponibles] = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [entrenadorSeleccionadoId, setEntrenadorSeleccionadoId] = useState(null);
  const [motivoSustitucionPreset, setMotivoSustitucionPreset] = useState(MOTIVOS_SUSTITUCION[0]);
  const [motivoSustitucionTexto, setMotivoSustitucionTexto] = useState('');
  const [guardandoSustituir, setGuardandoSustituir] = useState(false);

  // Opciones de fecha próximas (días 2 al 6 para respetar los tiempos)
  const [opcionesFecha, setOpcionesFecha] = useState([]);

  useEffect(() => {
    const fechas = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const label =
        i === 1
          ? 'Mañana'
          : d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
      fechas.push({ iso, label });
    }
    setOpcionesFecha(fechas);
    setFechaNueva(fechas[0].iso);
  }, []);

  const fetchMisClases = async () => {
    try {
      const res = await api.get('/entrenadores/mis-clases');
      if (res.data.ok) {
        setClases(res.data.data.clases || []);
      }
      const resSust = await api.get('/entrenadores/sustituciones');
      if (resSust.data.ok) {
        setHistorialSustituciones(resSust.data.data || []);
      }
    } catch (err) {
      console.warn('Error al cargar clases del entrenador:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMisClases();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMisClases();
  };

  const totalAlumnosInscritos = clases.reduce(
    (acc, curr) => acc + (Number(curr.total_alumnos_inscritos) || 0),
    0
  );

  // Abrir Modal de Reprogramar Clase
  const abrirModalReprogramar = (clase) => {
    setClaseSeleccionada(clase);
    setMotivoReprogramar('');
    setHoraNueva(clase.hora_inicio?.substring(0, 5) || HORARIOS_SUGERIDOS[0]);
    setModalReprogramar(true);
  };

  const ejecutarReprogramacionClase = async () => {
    if (!motivoReprogramar.trim() || motivoReprogramar.trim().length < 5) {
      Alert.alert('Justificación requerida', 'Por favor ingresa un motivo para reprogramar la clase (mínimo 5 caracteres).');
      return;
    }

    try {
      setGuardandoReprogramar(true);
      const res = await api.put(`/entrenadores/clases/${claseSeleccionada.id_horario}/reprogramar`, {
        fecha_nueva: fechaNueva,
        hora_inicio_nueva: horaNueva,
        motivo: motivoReprogramar.trim(),
      });

      if (res.data.ok) {
        setModalReprogramar(false);
        Alert.alert(
          '¡Clase Reprogramada!',
          `${res.data.message}\n\nLos alumnos inscritos han recibido la notificación del nuevo horario en sus teléfonos.`,
          [{ text: 'Entendido', onPress: fetchMisClases }]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'No se pudo reprogramar la clase';
      Alert.alert('No se pudo reprogramar', msg);
    } finally {
      setGuardandoReprogramar(false);
    }
  };

  // Abrir Modal de Sustitución de Entrenador
  const abrirModalSustituir = async (clase) => {
    setClaseSeleccionada(clase);
    setEntrenadorSeleccionadoId(null);
    setMotivoSustitucionPreset(MOTIVOS_SUSTITUCION[0]);
    setMotivoSustitucionTexto('');
    setModalSustituir(true);
    setLoadingCoaches(true);

    try {
      const res = await api.get('/entrenadores/disponibles');
      if (res.data.ok) {
        const coaches = res.data.data.entrenadores || [];
        setEntrenadoresDisponibles(coaches);
        if (coaches.length > 0) {
          setEntrenadorSeleccionadoId(coaches[0].id_entrenador);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar la lista de entrenadores disponibles.');
    } finally {
      setLoadingCoaches(false);
    }
  };

  const ejecutarSustitucion = async () => {
    if (!entrenadorSeleccionadoId) {
      Alert.alert('Selección requerida', 'Debes seleccionar el colega entrenador que cubrirá tu clase.');
      return;
    }

    const motivoFinal = motivoSustitucionTexto.trim()
      ? `${motivoSustitucionPreset}: ${motivoSustitucionTexto.trim()}`
      : motivoSustitucionPreset;

    try {
      setGuardandoSustituir(true);
      const res = await api.put(`/entrenadores/clases/${claseSeleccionada.id_horario}/sustituir`, {
        id_entrenador_nuevo: entrenadorSeleccionadoId,
        motivo: motivoFinal,
      });

      if (res.data.ok) {
        setModalSustituir(false);
        Alert.alert(
          '¡Sustitución Exitosa!',
          `${res.data.message}\n\nEl cambio quedó registrado para auditoría y se notificó a los alumnos y al nuevo instructor.`,
          [{ text: 'Entendido', onPress: fetchMisClases }]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'No se pudo realizar la sustitución';
      Alert.alert('No se pudo sustituir', msg);
    } finally {
      setGuardandoSustituir(false);
    }
  };

  const renderItem = ({ item }) => {
    const fechaObj = new Date(item.fecha);
    const fechaFormateada = fechaObj.toLocaleDateString('es-PE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const inscritos = Number(item.total_alumnos_inscritos) || 0;
    const capacidad = Number(item.capacidad_maxima) || 20;
    const porcentaje = Math.min(100, Math.round((inscritos / capacidad) * 100));

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar" size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.dateText}>{fechaFormateada}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.estado === 'lleno' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.statusText, { color: item.estado === 'lleno' ? colors.danger : colors.secondary }]}>
              {item.estado === 'lleno' ? 'COMPLETO' : 'DISPONIBLE'}
            </Text>
          </View>
        </View>

        <Text style={styles.claseTitulo}>{item.clase_nombre}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.infoText}>
            {item.hora_inicio?.substring(0, 5)} - {item.hora_fin?.substring(0, 5)} ({item.duracion_minutos} min)
          </Text>
        </View>

        {item.turno && (
          <View style={[styles.infoRow, { marginTop: 4 }]}>
            <Ionicons name="sunny-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.infoText}>Turno: {item.turno}</Text>
          </View>
        )}

        {/* Barra de progreso de aforo */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Alumnos inscritos:</Text>
            <Text style={styles.progressValue}>
              {inscritos} / {capacidad} ({porcentaje}%)
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${porcentaje}%`,
                  backgroundColor: porcentaje >= 90 ? colors.accent : colors.secondary,
                },
              ]}
            />
          </View>
        </View>

        {/* Botón principal: Asistencia de Alumnos */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('AlumnosClase', { horario: item })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people" size={17} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Lista de Asistencia ({inscritos})</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        {/* Botones secundarios de gestión de clase por el entrenador */}
        <View style={styles.coachActionsRow}>
          <TouchableOpacity
            style={styles.coachActionBtn}
            onPress={() => abrirModalReprogramar(item)}
          >
            <Ionicons name="time-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.coachActionBtnText, { color: colors.accent }]}>Reprogramar (>24h)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.coachActionBtn, { borderColor: 'rgba(59, 130, 246, 0.4)' }]}
            onPress={() => abrirModalSustituir(item)}
          >
            <Ionicons name="swap-horizontal" size={14} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={[styles.coachActionBtnText, { color: '#60A5FA' }]}>Sustituir Coach</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderItemSustitucion = ({ item }) => {
    const esCubridor = item.rol_en_sustitucion === 'cubridor';
    const fechaHora = `${item.clase_fecha} • ${item.hora_inicio?.substring(0, 5)} - ${item.hora_fin?.substring(0, 5)}`;
    const fechaAuditoria = item.fecha_sustitucion ? new Date(item.fecha_sustitucion).toLocaleString('es-PE') : '';

    return (
      <Card style={styles.sustCard}>
        <View style={styles.sustHeader}>
          <View style={[styles.sustBadge, { backgroundColor: esCubridor ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name={esCubridor ? 'shield-checkmark' : 'arrow-forward-circle'} size={13} color={esCubridor ? colors.secondary : colors.accent} style={{ marginRight: 5 }} />
            <Text style={[styles.sustBadgeText, { color: esCubridor ? colors.secondary : colors.accent }]}>
              {esCubridor ? `Cubriste a ${item.entrenador_anterior_nombre}` : `Transferida a ${item.entrenador_nuevo_nombre}`}
            </Text>
          </View>
          <Text style={styles.sustId}>#SUST-{item.id_sustitucion}</Text>
        </View>

        <Text style={styles.sustClase}>{item.clase_nombre}</Text>

        <View style={styles.sustRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sustRowText}>{fechaHora}</Text>
        </View>

        <View style={styles.sustMotivoBox}>
          <Text style={styles.sustMotivoLabel}>Motivo justificado:</Text>
          <Text style={styles.sustMotivoText}>"{item.motivo}"</Text>
        </View>

        <View style={styles.sustFooter}>
          <Ionicons name="finger-print-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.sustAuditoria}>Registrado el {fechaAuditoria}</Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <Ionicons name="fitness" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>PANEL DE ENTRENADOR</Text>
          </View>
          <Text style={styles.title}>Mis Clases Asignadas</Text>
          <Text style={styles.subtitle}>Supervisa sesiones, toma asistencia o gestiona suplencias</Text>
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          <Text style={styles.kpiValue}>{clases.length}</Text>
          <Text style={styles.kpiLabel}>Sesiones</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="people-outline" size={20} color={colors.secondary} />
          <Text style={styles.kpiValue}>{totalAlumnosInscritos}</Text>
          <Text style={styles.kpiLabel}>Alumnos Totales</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.accent} />
          <Text style={[styles.kpiValue, { color: colors.accent }]}>{historialSustituciones.length}</Text>
          <Text style={styles.kpiLabel}>Suplencias</Text>
        </Card>
      </View>

      {/* SELECTOR DE PESTAÑAS: SESIONES vs AUDITORÍA DE SUPLENCIAS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tabActiva === 'clases' && styles.tabButtonActive]}
          onPress={() => setTabActiva('clases')}
        >
          <Ionicons name="barbell-outline" size={15} color={tabActiva === 'clases' ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.tabButtonText, tabActiva === 'clases' && styles.tabButtonTextActive]}>
            Mis Sesiones ({clases.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, tabActiva === 'sustituciones' && styles.tabButtonActive]}
          onPress={() => setTabActiva('sustituciones')}
        >
          <Ionicons name="swap-horizontal" size={15} color={tabActiva === 'sustituciones' ? colors.primary : colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.tabButtonText, tabActiva === 'sustituciones' && styles.tabButtonTextActive]}>
            Auditoría Suplencias ({historialSustituciones.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido según pestaña activa */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando información del entrenador...</Text>
        </View>
      ) : tabActiva === 'clases' ? (
        <>
          {/* Subfiltro de bandeja: Solo Hoy vs Todas */}
          <View style={styles.subFilterRow}>
            <TouchableOpacity
              style={[styles.subFilterPill, filtroBandeja === 'hoy' && styles.subFilterPillActive]}
              onPress={() => setFiltroBandeja('hoy')}
            >
              <Ionicons
                name="today"
                size={13}
                color={filtroBandeja === 'hoy' ? '#FFF' : colors.primary}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.subFilterPillText,
                  filtroBandeja === 'hoy' && styles.subFilterPillTextActive,
                ]}
              >
                Solo Hoy ({totalClasesHoy})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subFilterPill, filtroBandeja === 'todas' && styles.subFilterPillActive]}
              onPress={() => setFiltroBandeja('todas')}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={filtroBandeja === 'todas' ? '#FFF' : colors.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.subFilterPillText,
                  filtroBandeja === 'todas' && styles.subFilterPillTextActive,
                ]}
              >
                Todas las Fechas ({clases.length})
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={clasesFiltradas}
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
                <Ionicons name="calendar-outline" size={50} color={colors.textMuted} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>
                  {filtroBandeja === 'hoy'
                    ? 'No tienes clases programadas para hoy'
                    : 'No tienes clases asignadas'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {filtroBandeja === 'hoy'
                    ? 'Puedes revisar la pestaña "Todas las Fechas" o programar una nueva sesión.'
                    : 'Usa el botón de abajo o comunícate con administración para programar sesiones.'}
                </Text>
                {filtroBandeja === 'hoy' && clases.length > 0 && (
                  <TouchableOpacity
                    style={[styles.subFilterPill, { marginTop: 12, backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }]}
                    onPress={() => setFiltroBandeja('todas')}
                  >
                    <Ionicons name="calendar" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                      Ver mis {clases.length} clases de otras fechas
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </>
      ) : (
        <FlatList
          data={historialSustituciones}
          keyExtractor={(item) => item.id_sustitucion.toString()}
          renderItem={renderItemSustitucion}
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
              <Ionicons name="shield-checkmark-outline" size={50} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Sin sustituciones registradas</Text>
              <Text style={styles.emptySubtitle}>
                Aquí se auditarán todos los cambios de instructor y suplencias donde participes.
              </Text>
            </View>
          }
        />
      )}

      {/* Botón Flotante para Programar Nueva Sesión */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('CrearHorario')}
      >
        <Ionicons name="add" size={24} color="#FFF" style={{ marginRight: 6 }} />
        <Text style={styles.fabText}>Programar Clase</Text>
      </TouchableOpacity>

      {/* MODAL 1: REPROGRAMAR CLASE (>24H) */}
      <Modal
        visible={modalReprogramar}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalReprogramar(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reprogramar Sesión</Text>
                <Text style={styles.modalSub}>{claseSeleccionada?.clase_nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalReprogramar(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Aviso de Regla de 24h para el entrenador */}
              <View style={styles.ruleNotice}>
                <Ionicons name="time" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleNoticeTitle}>Regla de 24 Horas para Entrenadores</Text>
                  <Text style={styles.ruleNoticeDesc}>
                    Solo se permite cambiar fecha/hora con más de 24h de anticipación. Al confirmar, se notificará automáticamente a todos los alumnos inscritos.
                  </Text>
                </View>
              </View>

              {/* Selector de Fecha */}
              <Text style={styles.modalSectionLabel}>1. Nueva Fecha de la Sesión</Text>
              <View style={styles.chipsRow}>
                {opcionesFecha.map((f) => {
                  const isSel = fechaNueva === f.iso;
                  return (
                    <TouchableOpacity
                      key={f.iso}
                      style={[styles.chip, isSel && styles.chipSelected]}
                      onPress={() => setFechaNueva(f.iso)}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                        {f.label} ({f.iso.substring(5)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selector de Hora */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>2. Nueva Hora de Inicio (06:00 - 23:00)</Text>
              <View style={styles.chipsRow}>
                {HORARIOS_SUGERIDOS.map((h) => {
                  const isSel = horaNueva === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.chip, isSel && styles.chipSelected]}
                      onPress={() => setHoraNueva(h)}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Justificación obligatoria */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>3. Motivo de la reprogramación (Obligatorio)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Mantenimiento preventivo de sala o evento oficial..."
                placeholderTextColor={colors.textMuted}
                value={motivoReprogramar}
                onChangeText={setMotivoReprogramar}
                maxLength={200}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setModalReprogramar(false)}
              >
                <Text style={styles.cancelModalBtnText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmReprogramBtn,
                  guardandoReprogramar && { opacity: 0.5 },
                ]}
                disabled={guardandoReprogramar}
                onPress={ejecutarReprogramacionClase}
              >
                {guardandoReprogramar ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-sharp" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmReprogramBtnText}>Confirmar y Notificar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: SUSTITUIR ENTRENADOR (CUALQUIER MOMENTO CON JUSTIFICANTE) */}
      <Modal
        visible={modalSustituir}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalSustituir(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Sustitución de Entrenador</Text>
                <Text style={styles.modalSub}>{claseSeleccionada?.clase_nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalSustituir(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Aviso de flexibilidad con trazabilidad */}
              <View style={[styles.ruleNotice, { borderColor: 'rgba(59, 130, 246, 0.4)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="information-circle" size={18} color="#60A5FA" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleNoticeTitle, { color: '#60A5FA' }]}>Flexibilidad de Sustitución</Text>
                  <Text style={styles.ruleNoticeDesc}>
                    Puedes transferir la clase a otro colega en cualquier momento. La justificación es obligatoria para auditoría y medición del gimnasio. Los alumnos serán notificados del nuevo coach.
                  </Text>
                </View>
              </View>

              {/* Selector de Colega Entrenador */}
              <Text style={styles.modalSectionLabel}>1. Selecciona el Entrenador Sustituto</Text>
              {loadingCoaches ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
              ) : entrenadoresDisponibles.length === 0 ? (
                <Text style={styles.noDataText}>No hay otros entrenadores registrados para sustitución.</Text>
              ) : (
                entrenadoresDisponibles.map((coach) => {
                  const isSel = entrenadorSeleccionadoId === coach.id_entrenador;
                  return (
                    <TouchableOpacity
                      key={coach.id_entrenador}
                      style={[styles.coachCardOption, isSel && styles.coachCardOptionSelected]}
                      onPress={() => setEntrenadorSeleccionadoId(coach.id_entrenador)}
                    >
                      <View style={styles.avatarCoach}>
                        <Text style={styles.avatarCoachText}>
                          {coach.nombre ? coach.nombre.charAt(0).toUpperCase() : 'C'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.coachOptionName, isSel && { color: colors.primary }]}>
                          {coach.nombre}
                        </Text>
                        <Text style={styles.coachOptionSub}>
                          {coach.especialidad_nombre || 'Instructor General'}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSel ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSel ? colors.primary : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Motivo de sustitución */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>2. Justificación de la suplencia (Medible)</Text>
              <View style={styles.chipsRow}>
                {MOTIVOS_SUSTITUCION.map((mot) => {
                  const isSel = motivoSustitucionPreset === mot;
                  return (
                    <TouchableOpacity
                      key={mot}
                      style={[styles.chip, isSel && styles.chipSelected]}
                      onPress={() => setMotivoSustitucionPreset(mot)}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextSelected]}>
                        {mot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={[styles.modalInput, { marginTop: 10 }]}
                placeholder="Detalle adicional sobre la suplencia..."
                placeholderTextColor={colors.textMuted}
                value={motivoSustitucionTexto}
                onChangeText={setMotivoSustitucionTexto}
                maxLength={200}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setModalSustituir(false)}
              >
                <Text style={styles.cancelModalBtnText}>Volver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmSustituirBtn,
                  (!entrenadorSeleccionadoId || guardandoSustituir) && { opacity: 0.5 },
                ]}
                disabled={!entrenadorSeleccionadoId || guardandoSustituir}
                onPress={ejecutarSustitucion}
              >
                {guardandoSustituir ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="swap-horizontal" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmReprogramBtnText}>Confirmar Suplencia</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  card: {
    marginVertical: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  claseTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  coachActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coachActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 8,
    paddingVertical: 8,
  },
  coachActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
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
    marginTop: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  subFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  subFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subFilterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  subFilterPillTextActive: {
    color: '#FFF',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  fabText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Modales
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
    marginBottom: 12,
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
  ruleNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
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
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.textPrimary,
    padding: 10,
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  coachCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  coachCardOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  avatarCoach: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCoachText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  coachOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  coachOptionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  noDataText: {
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 10,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
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
    fontSize: 13,
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
  confirmSustituirBtn: {
    flex: 2,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmReprogramBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderColor: colors.primary,
  },
  tabButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  sustCard: {
    marginBottom: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  sustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sustBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sustId: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sustClase: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  sustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sustRowText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  sustMotivoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  sustMotivoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  sustMotivoText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  sustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sustAuditoria: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
