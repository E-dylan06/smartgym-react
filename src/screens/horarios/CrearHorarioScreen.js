import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

const HORARIOS_PREDETERMINADOS = [
  '07:00',
  '08:30',
  '10:00',
  '11:30',
  '16:00',
  '17:30',
  '19:00',
  '20:30',
];

export default function CrearHorarioScreen({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'administrador' || user?.rol_nombre === 'administrador';

  const [clases, setClases] = useState([]);
  const [entrenadores, setEntrenadores] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form states
  const [selectedClaseId, setSelectedClaseId] = useState(null);
  const [selectedEntrenadorId, setSelectedEntrenadorId] = useState(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');
  const [horaInicio, setHoraInicio] = useState(HORARIOS_PREDETERMINADOS[0]);
  const [horaPersonalizada, setHoraPersonalizada] = useState('');
  const [capacidad, setCapacidad] = useState('20');
  const [guardando, setGuardando] = useState(false);

  // Generar opciones de fecha para los próximos 5 días
  const [opcionesFecha, setOpcionesFecha] = useState([]);

  useEffect(() => {
    // Generar fechas
    const fechas = [];
    for (let i = 0; i <= 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const label =
        i === 0
          ? 'Hoy'
          : i === 1
          ? 'Mañana'
          : d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
      fechas.push({ iso, label });
    }
    setOpcionesFecha(fechas);
    setFechaSeleccionada(fechas[0].iso);

    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      setLoadingData(true);
      // 1. Cargar clases
      const resClases = await api.get('/clases');
      if (resClases.data.ok) {
        const listaClases = resClases.data.data.clases || [];
        setClases(listaClases);
        if (listaClases.length > 0) {
          setSelectedClaseId(listaClases[0].id_clase);
        }
      }

      // 2. Si es Admin, cargar lista de entrenadores para asignación
      if (isAdmin) {
        const resTrainers = await api.get('/admin/entrenadores');
        if (resTrainers.data.ok) {
          const listaTrainers = resTrainers.data.data.entrenadores || [];
          setEntrenadores(listaTrainers);
          if (listaTrainers.length > 0) {
            setSelectedEntrenadorId(listaTrainers[0].id_entrenador);
          }
        }
      }
    } catch (err) {
      console.warn('Error al cargar datos de programación:', err.message);
    } finally {
      setLoadingData(false);
    }
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

    const horaFinal = horaPersonalizada.trim() || horaInicio;

    try {
      setGuardando(true);
      const payload = {
        id_clase: selectedClaseId,
        fecha: fechaSeleccionada,
        hora_inicio: horaFinal,
        capacidad_maxima: parseInt(capacidad, 10) || 20,
      };

      if (isAdmin) {
        payload.id_entrenador = selectedEntrenadorId;
      }

      const res = await api.post('/horarios', payload);

      if (res.data.ok) {
        Alert.alert(
          '¡Horario Creado!',
          'La sesión de entrenamiento ha sido programada y los cupos ya están visibles para reserva.',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tagRow}>
          <Ionicons name="time" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.tagText}>GESTIÓN DE HORARIOS</Text>
        </View>
        <Text style={styles.title}>Programar Nueva Sesión</Text>
        <Text style={styles.subtitle}>
          Habilita nuevos horarios respetando la franja de apertura (06:00 a 23:00)
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
                    onPress={() => setSelectedClaseId(c.id_clase)}
                  >
                    <Ionicons
                      name="barbell"
                      size={14}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {c.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* PASO 2: Entrenador asignado */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Entrenador a Cargo</Text>
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
                <Ionicons name="checkmark-circle" size={18} color={colors.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.trainerSelfText}>
                  Asignado automáticamente a ti: <Text style={{ fontWeight: '800' }}>{user?.nombre}</Text>
                </Text>
              </View>
            )}
          </Card>

          {/* PASO 3: Fecha de la sesión */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Fecha de la Sesión</Text>
            <View style={styles.chipsContainer}>
              {opcionesFecha.map((f) => {
                const isSelected = fechaSeleccionada === f.iso;
                return (
                  <TouchableOpacity
                    key={f.iso}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setFechaSeleccionada(f.iso)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {f.label} ({f.iso.substring(5)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* PASO 4: Hora de Inicio */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Hora de Inicio (06:00 - 23:00)</Text>
            <View style={styles.chipsContainer}>
              {HORARIOS_PREDETERMINADOS.map((h) => {
                const isSelected = horaInicio === h && !horaPersonalizada;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => {
                      setHoraInicio(h);
                      setHoraPersonalizada('');
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={isSelected ? '#FFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginTop: 10 }}>
              <Text style={styles.fieldSubLabel}>U otra hora personalizada (HH:MM):</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 07:15, 14:00, 18:45"
                placeholderTextColor={colors.textMuted}
                value={horaPersonalizada}
                onChangeText={setHoraPersonalizada}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </Card>

          {/* PASO 5: Capacidad Máxima */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>5. Aforo Máximo de Cupos</Text>
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
          <View style={{ marginTop: 10, marginBottom: 30 }}>
            <CustomButton
              title="Publicar Sesión de Clase"
              loading={guardando}
              onPress={handleCrearHorario}
              icon="add-circle"
            />
          </View>
        </>
      )}
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
    marginBottom: 6,
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
});
