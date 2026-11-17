import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

const TIPOS_BLOQUEO = [
  { id: 'feriado', label: '🏖️ Feriado' },
  { id: 'mantenimiento', label: '🛠️ Mantenimiento' },
  { id: 'evento_privado', label: '🎉 Evento Privado' },
  { id: 'emergencia', label: '⚠️ Emergencia' },
];

export default function AdminBloqueosScreen() {
  const [bloqueos, setBloqueos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [fechaInput, setFechaInput] = useState('');
  const [motivoInput, setMotivoInput] = useState('');
  const [tipoInput, setTipoInput] = useState(TIPOS_BLOQUEO[0].id);
  const [guardando, setGuardando] = useState(false);

  const fetchBloqueos = async () => {
    try {
      const res = await api.get('/admin/bloqueos');
      if (res.data.ok) {
        setBloqueos(res.data.data || []);
      }
    } catch (err) {
      console.warn('Error al cargar bloqueos:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBloqueos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBloqueos();
  };

  const abrirModalCrear = () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    setFechaInput(manana.toISOString().split('T')[0]);
    setMotivoInput('');
    setTipoInput(TIPOS_BLOQUEO[0].id);
    setModalVisible(true);
  };

  const handleCrearBloqueo = async () => {
    if (!fechaInput || fechaInput.length < 10) {
      Alert.alert('Fecha inválida', 'Ingresa la fecha en formato YYYY-MM-DD (ejemplo: 2026-12-25)');
      return;
    }

    if (!motivoInput.trim() || motivoInput.trim().length < 4) {
      Alert.alert('Motivo requerido', 'Ingresa el motivo del cierre (ejemplo: Mantenimiento general)');
      return;
    }

    try {
      setGuardando(true);
      const res = await api.post('/admin/bloqueos', {
        fecha: fechaInput.trim(),
        motivo: motivoInput.trim(),
        tipo: tipoInput,
      });

      if (res.data.ok) {
        Alert.alert('¡Día Bloqueado!', res.data.message);
        setModalVisible(false);
        fetchBloqueos();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al registrar bloqueo';
      Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarBloqueo = (item) => {
    Alert.alert(
      'Habilitar Día',
      `¿Deseas reactivar la programación para el ${item.fecha} (${item.motivo})? El gimnasio volverá a estar disponible.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, reactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/admin/bloqueos/${item.id_bloqueo}`);
              if (res.data.ok) {
                Alert.alert('Reactivado', 'El bloqueo ha sido levantado.');
                fetchBloqueos();
              }
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar el bloqueo.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    let badgeColor = colors.accent;
    let badgeBg = 'rgba(245, 158, 11, 0.15)';
    if (item.tipo === 'feriado') {
      badgeColor = '#60A5FA';
      badgeBg = 'rgba(59, 130, 246, 0.15)';
    } else if (item.tipo === 'emergencia') {
      badgeColor = colors.danger;
      badgeBg = 'rgba(239, 68, 68, 0.15)';
    }

    return (
      <Card style={styles.cardItem}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
              {item.tipo.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleEliminarBloqueo(item)}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <Text style={styles.cardDate}>{item.fecha}</Text>
        <Text style={styles.cardMotivo}>Motivo: {item.motivo}</Text>

        <View style={styles.cardFooter}>
          <Ionicons name="shield-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.cardAuditoria}>
            Registrado por {item.creado_por_nombre || 'Administración'}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Ionicons name="lock-closed" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>CALENDARIO NO LABORABLE</Text>
        </View>
        <Text style={styles.title}>Feriados & Mantenimiento</Text>
        <Text style={styles.subtitle}>
          Bloquea fechas para impedir la creación o reserva de clases en días no operativos
        </Text>
      </View>

      {/* Botón Nuevo Bloqueo */}
      <TouchableOpacity style={styles.addBtn} onPress={abrirModalCrear}>
        <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.addBtnText}>Bloquear Nueva Fecha</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando fechas bloqueadas...</Text>
        </View>
      ) : (
        <FlatList
          data={bloqueos}
          keyExtractor={(item) => item.id_bloqueo.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.secondary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Sin bloqueos programados</Text>
              <Text style={styles.emptySubtitle}>
                El gimnasio está habilitado para programar sesiones todos los días normales.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal Registrar Bloqueo */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bloquear Fecha en Calendario</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Fecha de Cierre (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-12-25"
                placeholderTextColor={colors.textMuted}
                value={fechaInput}
                onChangeText={setFechaInput}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Motivo del Cierre</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej: Feriado Nacional de Navidad"
                placeholderTextColor={colors.textMuted}
                value={motivoInput}
                onChangeText={setMotivoInput}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Tipo de Bloqueo</Text>
              <View style={styles.chipRow}>
                {TIPOS_BLOQUEO.map((t) => {
                  const sel = tipoInput === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setTipoInput(t.id)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCrearBloqueo}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Confirmar Bloqueo de Fecha</Text>
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
    padding: 16,
  },
  header: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13,
  },
  cardItem: {
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardDate: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMotivo: {
    color: colors.textSecondary,
    fontSize: 13,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardAuditoria: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  modalBody: {
    paddingBottom: 20,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    color: colors.textPrimary,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
