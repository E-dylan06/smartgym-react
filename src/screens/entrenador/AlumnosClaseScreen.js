import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

export default function AlumnosClaseScreen({ route, navigation }) {
  const { horario } = route.params;
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchAlumnos = async () => {
    try {
      const res = await api.get(`/entrenadores/clases/${horario.id_horario}/alumnos`);
      if (res.data.ok) {
        setAlumnos(res.data.data.alumnos || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al obtener alumnos';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlumnos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlumnos();
  };

  const handleMarcarAsistencia = async (idReserva, asistioValor) => {
    try {
      setMarkingId(idReserva);
      const res = await api.post('/asistencias/marcar', {
        id_reserva: idReserva,
        asistio: asistioValor,
      });

      if (res.data.ok) {
        // Actualizar localmente el alumno en la lista
        setAlumnos((prev) =>
          prev.map((al) =>
            al.id_reserva === idReserva ? { ...al, asistio: asistioValor } : al
          )
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al marcar asistencia';
      Alert.alert('Error', msg);
    } finally {
      setMarkingId(null);
    }
  };

  const fechaObj = new Date(horario.fecha);
  const fechaFormateada = fechaObj.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const presentesCount = alumnos.filter((a) => a.asistio === 'si').length;
  const ausentesCount = alumnos.filter((a) => a.asistio === 'no').length;

  const alumnosFiltrados = alumnos.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.alumno_nombre?.toLowerCase().includes(q) ||
      a.alumno_correo?.toLowerCase().includes(q) ||
      a.alumno_telefono?.toLowerCase().includes(q)
    );
  });

  const renderItem = ({ item }) => {
    const isPresente = item.asistio === 'si';
    const isAusente = item.asistio === 'no';
    const isProcessing = markingId === item.id_reserva;

    return (
      <Card style={styles.studentCard}>
        <View style={styles.studentHeader}>
          {/* Avatar con Inicial */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.alumno_nombre ? item.alumno_nombre.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>

          {/* Información del Alumno */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.studentName}>{item.alumno_nombre}</Text>
            <Text style={styles.studentContact}>{item.alumno_correo}</Text>
            {item.alumno_telefono && (
              <Text style={styles.studentPhone}>📞 {item.alumno_telefono}</Text>
            )}
          </View>

          {/* Estado de Asistencia Badge */}
          <View
            style={[
              styles.badgeStatus,
              isPresente && { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
              isAusente && { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
            ]}
          >
            <Ionicons
              name={
                isPresente
                  ? 'checkmark-circle'
                  : isAusente
                  ? 'close-circle'
                  : 'hourglass-outline'
              }
              size={12}
              color={
                isPresente
                  ? colors.secondary
                  : isAusente
                  ? colors.danger
                  : colors.textMuted
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.badgeStatusText,
                {
                  color: isPresente
                    ? colors.secondary
                    : isAusente
                    ? colors.danger
                    : colors.textMuted,
                },
              ]}
            >
              {isPresente ? 'PRESENTE' : isAusente ? 'AUSENTE' : 'PENDIENTE'}
            </Text>
          </View>
        </View>

        {/* Botones interactivos para tomar asistencia */}
        <View style={styles.attendanceActions}>
          <TouchableOpacity
            style={[
              styles.attendBtn,
              isPresente && styles.attendBtnActivePresent,
              isProcessing && { opacity: 0.5 },
            ]}
            disabled={isProcessing}
            onPress={() => handleMarcarAsistencia(item.id_reserva, 'si')}
          >
            <Ionicons
              name="checkmark"
              size={16}
              color={isPresente ? '#FFF' : colors.secondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.attendBtnText,
                { color: isPresente ? '#FFF' : colors.secondary },
              ]}
            >
              Presente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.attendBtn,
              isAusente && styles.attendBtnActiveAbsent,
              isProcessing && { opacity: 0.5 },
            ]}
            disabled={isProcessing}
            onPress={() => handleMarcarAsistencia(item.id_reserva, 'no')}
          >
            <Ionicons
              name="close"
              size={16}
              color={isAusente ? '#FFF' : colors.danger}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.attendBtnText,
                { color: isAusente ? '#FFF' : colors.danger },
              ]}
            >
              Ausente
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Resumen de la Clase */}
      <View style={styles.headerBanner}>
        <Text style={styles.claseTitulo}>{horario.clase_nombre}</Text>
        <Text style={styles.claseFecha}>
          📅 {fechaFormateada} • ⏰ {horario.hora_inicio?.substring(0, 5)} - {horario.hora_fin?.substring(0, 5)}
        </Text>

        {/* Mini stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Inscritos:</Text>
            <Text style={styles.statPillVal}>{alumnos.length}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.statPillLabel, { color: colors.secondary }]}>Presentes:</Text>
            <Text style={[styles.statPillVal, { color: colors.secondary }]}>{presentesCount}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Text style={[styles.statPillLabel, { color: colors.danger }]}>Ausentes:</Text>
            <Text style={[styles.statPillVal, { color: colors.danger }]}>{ausentesCount}</Text>
          </View>
        </View>
      </View>

      {/* Buscador de Alumno */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar alumno por nombre o correo..."
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

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando lista de alumnos...</Text>
        </View>
      ) : (
        <FlatList
          data={alumnosFiltrados}
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
              <Ionicons name="people-outline" size={48} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>
                {search ? 'No se encontraron coincidencias' : 'Sin alumnos inscritos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? 'Intenta con otro término de búsqueda'
                  : 'Aún no hay reservas confirmadas para este horario de clase.'}
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
  headerBanner: {
    backgroundColor: colors.surface,
    padding: 18,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  claseTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  claseFecha: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  statPillLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statPillVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  studentCard: {
    marginVertical: 6,
    padding: 14,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  studentContact: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  studentPhone: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
  },
  badgeStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  attendBtnActivePresent: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  attendBtnActiveAbsent: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  attendBtnText: {
    fontSize: 13,
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
    paddingHorizontal: 20,
  },
});
