import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import CustomButton from '../../components/CustomButton';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

export default function DetalleClaseScreen({ route, navigation }) {
  const { user } = useAuth();
  const { horario, onReserved } = route.params;
  const [loading, setLoading] = useState(false);
  const [advertenciaModal, setAdvertenciaModal] = useState({
    visible: false,
    mensaje: '',
    detalle: '',
    claseRelacionada: '',
  });

  const fechaObj = new Date(horario.fecha);
  const fechaFormateada = fechaObj.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const aforoOcupado = horario.capacidad_maxima - horario.cupos_disponibles;
  const porcentajeOcupacion = Math.round((aforoOcupado / horario.capacidad_maxima) * 100);

  const handleReservar = async () => {
    try {
      setLoading(true);
      const res = await api.post('/reservas', {
        id_horario: horario.id_horario,
      });

      if (res.data.ok) {
        if (onReserved) onReserved();

        const adv = res.data.advertencia_descanso || res.data.data?.advertencia_descanso;
        if (adv && adv.requiere_descanso) {
          // Desplegar la ventanita flotante con la advertencia
          setAdvertenciaModal({
            visible: true,
            mensaje: adv.mensaje || 'Advertencia: Tómate un descanso antes de comenzar con tu siguiente rutina.',
            detalle: adv.detalle || 'Has programado rutinas seguidas con poco tiempo de recuperación. Recuerda hidratarte bien.',
            claseRelacionada: adv.clase_relacionada || '',
          });
        } else {
          Alert.alert(
            '¡Reserva Exitosa!',
            `Has reservado tu cupo para ${horario.clase_nombre} el ${fechaFormateada} a las ${horario.hora_inicio?.substring(0, 5)}.`,
            [
              {
                text: 'Ver Mis Reservas',
                onPress: () => navigation.navigate('ReservasTab'),
              },
              {
                text: 'Seguir Explorando',
                onPress: () => navigation.goBack(),
                style: 'cancel',
              },
            ]
          );
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'No se pudo completar la reserva';
      Alert.alert('No se pudo reservar', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAceptarAdvertencia = () => {
    setAdvertenciaModal({ visible: false, mensaje: '', detalle: '', claseRelacionada: '' });
    navigation.navigate('ReservasTab');
  };

  const sinCupo = horario.cupos_disponibles <= 0 || horario.estado === 'lleno';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner de la clase */}
      <View style={styles.headerCard}>
        <Text style={styles.badgeTipo}>
          {horario.tipo_clase_nombre || 'CLASE GRUPAL'}
        </Text>
        <Text style={styles.tituloClase}>{horario.clase_nombre}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={{ marginRight: 5 }} />
          <Text style={styles.duracion}>Duración: {horario.duracion_minutos} minutos</Text>
        </View>
      </View>

      {/* Descripción */}
      <Card>
        <Text style={styles.sectionHeader}>Descripción de la Sesión</Text>
        <Text style={styles.descripcionTexto}>
          {horario.clase_descripcion ||
            'Entrenamiento diseñado para mejorar tu fuerza, resistencia y capacidad cardiovascular con entrenadores certificados.'}
        </Text>
      </Card>

      {/* Entrenador */}
      <Card>
        <Text style={styles.sectionHeader}>Entrenador a Cargo</Text>
        <View style={styles.coachRow}>
          <View style={styles.coachAvatar}>
            <Text style={styles.coachInitial}>
              {horario.entrenador_nombre ? horario.entrenador_nombre.charAt(0) : 'T'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.coachName}>{horario.entrenador_nombre}</Text>
            <Text style={styles.coachRole}>
              Especialidad: {horario.especialidad_nombre || 'Instructor General'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Horario y Aforo en Tiempo Real */}
      <Card>
        <Text style={styles.sectionHeader}>Fecha, Horario y Aforo</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fecha:</Text>
          <Text style={styles.infoValue}>{fechaFormateada}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Horario:</Text>
          <Text style={styles.infoValue}>
            {horario.hora_inicio?.substring(0, 5)} - {horario.hora_fin?.substring(0, 5)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Capacidad Máxima:</Text>
          <Text style={styles.infoValue}>{horario.capacidad_maxima} personas</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cupos Disponibles:</Text>
          <Text
            style={[
              styles.infoValue,
              { color: sinCupo ? colors.danger : colors.secondary, fontWeight: '800' },
            ]}
          >
            {horario.cupos_disponibles} cupos
          </Text>
        </View>

        {/* Barra de Progreso de Ocupación */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${porcentajeOcupacion}%`,
                  backgroundColor: sinCupo ? colors.danger : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{porcentajeOcupacion}% de aforo ocupado</Text>
        </View>
      </Card>

      {/* Botón de Confirmación de Reserva o Gestión de Asistencia */}
      {user?.rol === 'entrenador' && (horario.entrenador_nombre === user?.nombre || horario.id_usuario === user?.id_usuario) ? (
        <View style={{ marginTop: 12, marginBottom: 30 }}>
          <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: '#3B82F6', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="fitness" size={20} color="#60A5FA" style={{ marginRight: 8 }} />
            <Text style={{ color: '#F8FAFC', fontSize: 13, flex: 1 }}>
              Eres el instructor asignado a esta sesión. No puedes auto-reservar cupos.
            </Text>
          </View>
          <CustomButton
            title="Ver Asistencia de Alumnos"
            icon="people"
            onPress={() => navigation.navigate('AlumnosClase', { horario })}
          />
        </View>
      ) : (
        <CustomButton
          title={sinCupo ? 'Aforo Completo (Sin Cupos)' : 'Confirmar Reserva de Cupo'}
          onPress={handleReservar}
          disabled={sinCupo}
          loading={loading}
          variant={sinCupo ? 'outline' : 'primary'}
          style={{ marginTop: 12, marginBottom: 30 }}
        />
      )}

      {/* Ventanita Flotante / Modal de Advertencia de Descanso */}
      <Modal
        visible={advertenciaModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleAceptarAdvertencia}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconBadge}>
              <Ionicons name="warning" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>¡Atención, Atleta!</Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningMainText}>
                {advertenciaModal.mensaje}
              </Text>
            </View>
            <Text style={styles.modalDesc}>
              {advertenciaModal.detalle}
            </Text>
            <Text style={styles.modalSubDesc}>
              Tu reserva ya ha sido confirmada con éxito. Asegúrate de descansar e hidratarte correctamente.
            </Text>
            <CustomButton
              title="Aceptar"
              onPress={handleAceptarAdvertencia}
              style={{ width: '100%', marginTop: 8 }}
            />
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
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.4)',
    marginBottom: 16,
  },
  badgeTipo: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tituloClase: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  duracion: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  sectionHeader: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  descripcionTexto: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  coachInitial: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  coachName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  coachRole: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    width: '100%',
    maxWidth: 380,
  },
  modalIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 12,
  },
  warningMainText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  modalDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubDesc: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
});
