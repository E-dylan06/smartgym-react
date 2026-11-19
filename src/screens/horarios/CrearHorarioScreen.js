import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Franja horaria de atención del gimnasio: 06:00 a 22:00 para inicio
const TODAS_HORAS_INICIO = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00',
];

const getHoyStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const convertirMinutos = (horaStr) => {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

const minutosAHoraStr = (minutos) => {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
};

export default function CrearHorarioScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'administrador' || user?.rol_nombre === 'administrador';

  const [clases, setClases] = useState([]);
  const [entrenadores, setEntrenadores] = useState([]);
  const [bloqueosGimnasio, setBloqueosGimnasio] = useState({});
  const [loadingData, setLoadingData] = useState(true);

  // Form states
  const [selectedClaseId, setSelectedClaseId] = useState(null);
  const [selectedEntrenadorId, setSelectedEntrenadorId] = useState(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getHoyStr());
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('09:00');
  const [capacidad, setCapacidad] = useState('20');
  const [guardando, setGuardando] = useState(false);

  // Modal Calendario
  const [modalCalendarioVisible, setModalCalendarioVisible] = useState(false);
  const [mesCalendario, setMesCalendario] = useState(new Date());

  // Modal Selector de Hora Inicio y Fin
  const [modalPickerTipo, setModalPickerTipo] = useState(null); // 'inicio' | 'fin' | null

  const hoyStr = getHoyStr();

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      setLoadingData(true);

      // Consultar en paralelo: clases, bloqueos de días festivos/mantenimiento, y entrenadores (si es admin)
      const requests = [
        api.get('/clases'),
        api.get('/horarios/bloqueos').catch(() => ({ data: { data: { bloqueos: [] } } })),
      ];

      if (isAdmin) {
        requests.push(api.get('/admin/entrenadores'));
      }

      const responses = await Promise.all(requests);
      const resClases = responses[0];
      const resBloqueos = responses[1];
      const resTrainers = responses[2];

      // 1. Clases
      if (resClases.data?.ok) {
        const listaClases = resClases.data.data?.clases || [];
        setClases(listaClases);
        if (listaClases.length > 0) {
          setSelectedClaseId(listaClases[0].id_clase);
          // Ajustar hora fin con la duración por defecto
          const duracion = listaClases[0].duracion_minutos || 60;
          const finMin = convertirMinutos('08:00') + duracion;
          setHoraFin(minutosAHoraStr(Math.min(finMin, 23 * 60)));
        }
      }

      // 2. Días bloqueados / feriados
      if (resBloqueos.data?.ok) {
        const bloqueosList = resBloqueos.data.data?.bloqueos || [];
        const map = {};
        bloqueosList.forEach((b) => {
          map[b.fecha] = b;
        });
        setBloqueosGimnasio(map);
      }

      // 3. Entrenadores (Admin)
      if (isAdmin && resTrainers?.data?.ok) {
        const listaTrainers = resTrainers.data.data?.entrenadores || [];
        setEntrenadores(listaTrainers);
        if (listaTrainers.length > 0) {
          setSelectedEntrenadorId(listaTrainers[0].id_entrenador);
        }
      }
    } catch (err) {
      console.warn('Error al cargar datos de programación:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Cuando cambia la clase seleccionada, actualizar la sugerencia de horaFin
  const handleSelectClase = (clase) => {
    setSelectedClaseId(clase.id_clase);
    const duracion = clase.duracion_minutos || 60;
    const inicioMin = convertirMinutos(horaInicio);
    const finCalculado = Math.min(inicioMin + duracion, 23 * 60);
    setHoraFin(minutosAHoraStr(finCalculado));
  };

  // Cuando cambia la horaInicio, recalcular horaFin
  const handleSelectHoraInicio = (hInicio) => {
    setHoraInicio(hInicio);
    const claseActual = clases.find((c) => c.id_clase === selectedClaseId);
    const duracion = claseActual?.duracion_minutos || 60;
    const inicioMin = convertirMinutos(hInicio);
    const finCalculado = Math.min(inicioMin + duracion, 23 * 60);
    setHoraFin(minutosAHoraStr(finCalculado));
    setModalPickerTipo(null);
  };

  // Opciones válidas de Hora de Cierre (estrictamente mayores a horaInicio y hasta las 23:00)
  const opcionesHoraFin = useMemo(() => {
    const inicioMin = convertirMinutos(horaInicio);
    const opciones = [];
    // Generar opciones desde inicioMin + 30 hasta 23:00 (1380 min) con rango maximo de 180 min
    const maxFin = Math.min(23 * 60, inicioMin + 180);
    for (let m = inicioMin + 30; m <= maxFin; m += 30) {
      const horaStr = minutosAHoraStr(m);
      const duracionMin = m - inicioMin;
      opciones.push({
        hora: horaStr,
        duracion: duracionMin,
        label: `${horaStr} (${duracionMin} min)`,
      });
    }
    return opciones;
  }, [horaInicio]);

  // Días para el carrusel de accesos directos (próximos 7 días)
  const chipsFechasProximas = useMemo(() => {
    const lista = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${dia}`;

      const bloqueo = bloqueosGimnasio[iso];
      const esHoy = i === 0;
      const esManana = i === 1;
      const diaSemana = d.toLocaleDateString('es-PE', { weekday: 'short' });

      lista.push({
        iso,
        label: esHoy ? 'Hoy' : esManana ? 'Mañana' : `${diaSemana} ${dia}`,
        bloqueado: Boolean(bloqueo),
        motivoBloqueo: bloqueo?.motivo,
      });
    }
    return lista;
  }, [bloqueosGimnasio]);

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
      const esPasado = fechaISO < hoyStr;
      const bloqueo = bloqueosGimnasio[fechaISO];

      dias.push({
        esVacio: false,
        numero: d,
        fechaISO,
        esPasado,
        estaBloqueado: Boolean(bloqueo),
        motivoBloqueo: bloqueo?.motivo,
        tipoBloqueo: bloqueo?.tipo,
        id: fechaISO,
      });
    }

    return dias;
  }, [mesCalendario, bloqueosGimnasio, hoyStr]);

  const cambiarMesCalendario = (offset) => {
    const nuevo = new Date(mesCalendario);
    nuevo.setMonth(nuevo.getMonth() + offset);
    setMesCalendario(nuevo);
  };

  const seleccionarFecha = (diaItem) => {
    if (diaItem.esPasado) {
      Alert.alert('Fecha inválida', 'No puedes programar sesiones en fechas anteriores a hoy.');
      return;
    }
    if (diaItem.estaBloqueado) {
      Alert.alert(
        'Gimnasio Cerrado',
        `El gimnasio no prestará atención el ${diaItem.fechaISO} debido a:\n\n"${diaItem.motivoBloqueo || 'Día no laborable'}" (${diaItem.tipoBloqueo || 'Cierre General'}).\n\nPor favor selecciona otra fecha disponible.`
      );
      return;
    }
    setFechaSeleccionada(diaItem.fechaISO);
    setModalCalendarioVisible(false);
  };

  const handleCrearHorario = async () => {
    if (!selectedClaseId) {
      Alert.alert('Faltan datos', 'Debes seleccionar una disciplina / clase.');
      return;
    }

    if (isAdmin && !selectedEntrenadorId) {
      Alert.alert('Faltan datos', 'Debes seleccionar un entrenador para esta clase.');
      return;
    }

    // Validar si la fecha está bloqueada
    if (bloqueosGimnasio[fechaSeleccionada]) {
      const blq = bloqueosGimnasio[fechaSeleccionada];
      Alert.alert(
        'Fecha no disponible',
        `El gimnasio se encuentra cerrado el ${fechaSeleccionada} por motivo de: "${blq.motivo}". Selecciona una fecha hábil.`
      );
      return;
    }

    // Validar hora_inicio < hora_fin
    const minInicio = convertirMinutos(horaInicio);
    const minFin = convertirMinutos(horaFin);
    if (minInicio >= minFin) {
      Alert.alert('Horario Inválido', 'La hora de inicio debe ser anterior a la hora de cierre.');
      return;
    }

    // Validar que si es hoy, la hora no haya pasado ya
    if (fechaSeleccionada === hoyStr) {
      const ahora = new Date();
      const [hI, mI] = horaInicio.split(':').map(Number);
      const claseDate = new Date();
      claseDate.setHours(hI, mI, 0, 0);
      if (claseDate <= ahora) {
        Alert.alert(
          'Hora transcurrida',
          'La hora de inicio seleccionada ya pasó el día de hoy. Elige un horario posterior.'
        );
        return;
      }
    }

    try {
      setGuardando(true);
      const payload = {
        id_clase: selectedClaseId,
        fecha: fechaSeleccionada,
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
        capacidad_maxima: parseInt(capacidad, 10) || 20,
      };

      if (isAdmin) {
        payload.id_entrenador = selectedEntrenadorId;
      }

      const res = await api.post('/horarios', payload);

      if (res.data.ok) {
        Alert.alert(
          '¡Horario Programado Exitosamente!',
          `La sesión fue programada para el ${fechaSeleccionada} de ${horaInicio} a ${horaFin}.\nLos cupos ya se encuentran disponibles en la bandeja del gimnasio.`,
          [
            {
              text: 'Aceptar',
              onPress: () => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al programar horario';
      Alert.alert('No se pudo programar', msg);
    } finally {
      setGuardando(false);
    }
  };

  const duracionTotalCalculada = Math.max(0, convertirMinutos(horaFin) - convertirMinutos(horaInicio));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tagRow}>
          <Ionicons name="time" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.tagText}>GESTIÓN DE HORARIOS • SMARTGYM</Text>
        </View>
        <Text style={styles.title}>Programar Nueva Sesión</Text>
        <Text style={styles.subtitle}>
          Habilita nuevos horarios en la franja de atención (06:00 a 23:00)
        </Text>
      </View>

      {loadingData ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 30 }} />
      ) : (
        <>
          {/* PASO 1: Disciplina / Clase */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Selecciona la Clase</Text>
            <View style={styles.chipsContainer}>
              {clases.map((c) => {
                const isSelected = selectedClaseId === c.id_clase;
                return (
                  <TouchableOpacity
                    key={c.id_clase}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => handleSelectClase(c)}
                  >
                    <Ionicons
                      name="barbell"
                      size={14}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {c.nombre} ({c.duracion_minutos || 60}m)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* PASO 2: Entrenador asignado */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Entrenador Asignado</Text>
            {isAdmin ? (
              <View style={styles.chipsContainer}>
                {entrenadores.map((e) => {
                  const isSelected = selectedEntrenadorId === e.id_entrenador;
                  return (
                    <TouchableOpacity
                      key={e.id_entrenador}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedEntrenadorId(e.id_entrenador)}
                    >
                      <Ionicons
                        name="person"
                        size={14}
                        color={isSelected ? '#FFF' : colors.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {e.nombre} ({e.especialidad_nombre || 'Instructor'})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.trainerSelfRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.secondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trainerSelfText}>
                    Instructor Asignado: <Text style={{ fontWeight: '800' }}>{user?.nombre}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Se registrará automáticamente bajo tu rol y tu especialidad técnica.
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {/* PASO 3: Fecha de la sesión con Calendario Interactivo */}
          <Card style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>3. Fecha de la Sesión</Text>
              <TouchableOpacity
                style={styles.openCalendarBtn}
                onPress={() => setModalCalendarioVisible(true)}
              >
                <Ionicons name="calendar" size={14} color={colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.openCalendarBtnText}>Ver Calendario</Text>
              </TouchableOpacity>
            </View>

            {/* Fecha seleccionada actual */}
            <View style={styles.selectedDateBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={styles.selectedDateBannerText}>
                Fecha elegida: <Text style={{ fontWeight: '800', color: '#FFF' }}>{fechaSeleccionada}</Text>
              </Text>
            </View>

            {/* Chips de acceso directo (próximos 7 días) */}
            <Text style={[styles.fieldSubLabel, { marginTop: 10 }]}>Días próximos disponibles:</Text>
            <View style={styles.chipsContainer}>
              {chipsFechasProximas.map((f) => {
                const isSelected = fechaSeleccionada === f.iso;
                if (f.bloqueado) {
                  return (
                    <TouchableOpacity
                      key={f.iso}
                      style={[styles.chip, styles.chipDisabledBlocked]}
                      onPress={() =>
                        Alert.alert(
                          'Gimnasio Cerrado',
                          `El gimnasio no labora el ${f.iso}: "${f.motivoBloqueo}".`
                        )
                      }
                    >
                      <Ionicons name="lock-closed" size={12} color="#EF4444" style={{ marginRight: 4 }} />
                      <Text style={[styles.chipText, { color: '#F87171' }]}>
                        {f.label} (Cerrado)
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={f.iso}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setFechaSeleccionada(f.iso)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {f.label} ({f.iso.substring(5)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* PASO 4: Selectores de Hora de Inicio y Hora de Cierre */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Horario de la Sesión (Inicio y Cierre)</Text>
            <Text style={styles.fieldSubLabel}>
              Define el inicio exacto y el cierre deseado dentro del rango operativo (06:00 - 23:00):
            </Text>

            <View style={styles.timeSelectRow}>
              {/* Selector Hora Inicio */}
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerLabel}>Hora de Inicio:</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setModalPickerTipo('inicio')}
                >
                  <Ionicons name="time-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.timePickerValue}>{horaInicio}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>

              <View style={{ width: 12 }} />

              {/* Selector Hora Cierre */}
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerLabel}>Hora de Cierre:</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setModalPickerTipo('fin')}
                >
                  <Ionicons name="time" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.timePickerValue}>{horaFin}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Resumen de duración calculada */}
            <View style={styles.durationSummaryBox}>
              <Ionicons name="hourglass-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.durationSummaryText}>
                Duración total de la rutina: <Text style={{ fontWeight: '800', color: colors.primary }}>{duracionTotalCalculada} minutos</Text> ({horaInicio} a {horaFin})
              </Text>
            </View>
          </Card>

          {/* PASO 5: Capacidad Máxima */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>5. Aforo Máximo de Cupos</Text>
            <Text style={styles.fieldSubLabel}>Capacidad máxima de socios en sala para esta sesión:</Text>
            <TextInput
              style={styles.input}
              placeholder="Capacidad de alumnos (ej: 20)"
              placeholderTextColor={colors.textMuted}
              value={capacidad}
              onChangeText={setCapacidad}
              keyboardType="number-pad"
              maxLength={3}
            />
          </Card>

          {/* Botón de Publicación */}
          <View style={{ marginTop: 12, marginBottom: 35 }}>
            <CustomButton
              title="Publicar Sesión de Clase"
              loading={guardando}
              onPress={handleCrearHorario}
              icon="add-circle"
            />
          </View>
        </>
      )}

      {/* =========================================================================
          MODAL DE CALENDARIO CON VALIDACIÓN DE DIAS CERRADOS
          ========================================================================= */}
      <Modal
        visible={modalCalendarioVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCalendarioVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContainer}>
            <View style={styles.calendarHeaderRow}>
              <View>
                <Text style={styles.modalCalTitle}>Calendario de Programación</Text>
                <Text style={styles.modalCalSub}>Selecciona una fecha disponible para la clase</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalCalendarioVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Controles de navegación de mes */}
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

            {/* Encabezados de días de la semana */}
            <View style={styles.weekDaysRow}>
              {DIAS_SEMANA_CORTO.map((dia, idx) => (
                <Text key={idx} style={styles.weekDayHeader}>
                  {dia}
                </Text>
              ))}
            </View>

            {/* Cuadrícula de días */}
            <View style={styles.calendarGrid}>
              {diasCalendario.map((dia) => {
                if (dia.esVacio) {
                  return <View key={dia.id} style={styles.calendarDayEmpty} />;
                }

                const isSelected = fechaSeleccionada === dia.fechaISO;
                const isHoy = hoyStr === dia.fechaISO;

                return (
                  <TouchableOpacity
                    key={dia.id}
                    disabled={dia.esPasado}
                    style={[
                      styles.calendarDayCell,
                      isHoy && styles.calendarDayCellToday,
                      isSelected && styles.calendarDayCellSelected,
                      dia.estaBloqueado && styles.calendarDayBlocked,
                      dia.esPasado && styles.calendarDayPast,
                    ]}
                    onPress={() => seleccionarFecha(dia)}
                  >
                    <Text
                      style={[
                        styles.calendarDayNumber,
                        isHoy && styles.calendarDayNumberToday,
                        isSelected && styles.calendarDayNumberSelected,
                        dia.estaBloqueado && styles.calendarDayBlockedText,
                        dia.esPasado && styles.calendarDayPastText,
                      ]}
                    >
                      {dia.numero}
                    </Text>

                    {dia.estaBloqueado && (
                      <Ionicons name="lock-closed" size={10} color="#EF4444" style={{ marginTop: 2 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Leyenda del Calendario */}
            <View style={styles.calendarLegendBox}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendLabel}>Seleccionado</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendLabel}>Cerrado (Feriado/Mant.)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                <Text style={styles.legendLabel}>Pasado</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL SELECTOR DE HORA (INICIO O CIERRE)
          ========================================================================= */}
      <Modal
        visible={modalPickerTipo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setModalPickerTipo(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModalContainer}>
            <View style={styles.calendarHeaderRow}>
              <View>
                <Text style={styles.modalCalTitle}>
                  {modalPickerTipo === 'inicio' ? 'Seleccionar Hora de Inicio' : 'Seleccionar Hora de Cierre'}
                </Text>
                <Text style={styles.modalCalSub}>
                  {modalPickerTipo === 'inicio'
                    ? 'Franja operativa: 06:00 a 22:00'
                    : `Cierre posterior a las ${horaInicio} (máx. 23:00)`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalPickerTipo(null)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {modalPickerTipo === 'inicio' ? (
                <View style={styles.timeOptionsGrid}>
                  {TODAS_HORAS_INICIO.map((h) => {
                    const isSel = horaInicio === h;
                    // Desactivar horas pasadas si es hoy
                    let esHoraPasada = false;
                    if (fechaSeleccionada === hoyStr) {
                      const ahora = new Date();
                      const [hh, mm] = h.split(':').map(Number);
                      const d = new Date();
                      d.setHours(hh, mm, 0, 0);
                      esHoraPasada = d <= ahora;
                    }

                    return (
                      <TouchableOpacity
                        key={h}
                        disabled={esHoraPasada}
                        style={[
                          styles.timeOptionPill,
                          isSel && styles.timeOptionPillSelected,
                          esHoraPasada && styles.timeOptionPillDisabled,
                        ]}
                        onPress={() => handleSelectHoraInicio(h)}
                      >
                        <Text
                          style={[
                            styles.timeOptionPillText,
                            isSel && styles.timeOptionPillTextSelected,
                            esHoraPasada && styles.timeOptionPillTextDisabled,
                          ]}
                        >
                          {h}
                        </Text>
                        {esHoraPasada && (
                          <Text style={{ fontSize: 9, color: colors.textMuted }}>Pasada</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {opcionesHoraFin.map((op) => {
                    const isSel = horaFin === op.hora;
                    return (
                      <TouchableOpacity
                        key={op.hora}
                        style={[
                          styles.timeFinOptionCard,
                          isSel && styles.timeFinOptionCardSelected,
                        ]}
                        onPress={() => {
                          setHoraFin(op.hora);
                          setModalPickerTipo(null);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.timeFinTitle, isSel && { color: colors.primary }]}>
                            {op.hora}
                          </Text>
                          <Text style={styles.timeFinSub}>
                            Duración de sesión: {op.duracion} minutos
                          </Text>
                        </View>
                        <Ionicons
                          name={isSel ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSel ? colors.primary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 45,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 16,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  chipDisabledBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  trainerSelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 12,
  },
  trainerSelfText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  fieldSubLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  openCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openCalendarBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  selectedDateBannerText: {
    color: colors.secondary,
    fontSize: 12,
  },
  timeSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '700',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  timePickerValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  durationSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  durationSummaryText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },

  // Estilos Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalCalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCalSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  monthNavBtn: {
    padding: 6,
  },
  monthNavText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekDayHeader: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDayEmpty: {
    width: `${100 / 7}%`,
    height: 40,
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calendarDayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  calendarDayCellSelected: {
    backgroundColor: colors.primary,
  },
  calendarDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  calendarDayNumberToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  calendarDayNumberSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  calendarDayBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
  },
  calendarDayBlockedText: {
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayPastText: {
    color: colors.textMuted,
  },
  calendarLegendBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Modal selector hora
  timePickerModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
  },
  timeOptionPill: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 8,
  },
  timeOptionPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeOptionPillDisabled: {
    opacity: 0.35,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  timeOptionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeOptionPillTextSelected: {
    color: '#FFF',
    fontWeight: '800',
  },
  timeOptionPillTextDisabled: {
    color: colors.textMuted,
  },
  timeFinOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeFinOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  timeFinTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  timeFinSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
