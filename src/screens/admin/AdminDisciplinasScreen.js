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

export default function AdminDisciplinasScreen() {
  const [clases, setClases] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados Modal Crear/Editar
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoClase, setEditandoClase] = useState(null); // null = creando
  const [nombreInput, setNombreInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [duracionInput, setDuracionInput] = useState('60');
  const [precioInput, setPrecioInput] = useState('0');
  const [tipoSeleccionado, setTipoSeleccionado] = useState(1);
  const [guardando, setGuardando] = useState(false);

  const fetchDatos = async () => {
    try {
      const [resClases, resTipos] = await Promise.all([
        api.get('/clases'),
        api.get('/clases/tipos'),
      ]);

      if (resClases.data.ok) {
        setClases(resClases.data.data.clases || []);
      }
      if (resTipos.data.ok) {
        setTipos(resTipos.data.data || []);
      }
    } catch (err) {
      console.warn('Error al cargar catálogo de clases:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDatos();
  };

  const abrirModalCrear = () => {
    setEditandoClase(null);
    setNombreInput('');
    setDescInput('');
    setDuracionInput('60');
    setPrecioInput('0');
    setTipoSeleccionado(tipos[0]?.id_tipo_clase || 1);
    setModalVisible(true);
  };

  const abrirModalEditar = (item) => {
    setEditandoClase(item);
    setNombreInput(item.nombre || '');
    setDescInput(item.descripcion || '');
    setDuracionInput(String(item.duracion_minutos || '60'));
    setPrecioInput(String(item.precio_sesion || '0'));
    setTipoSeleccionado(item.id_tipo_clase || tipos[0]?.id_tipo_clase || 1);
    setModalVisible(true);
  };

  const handleGuardarClase = async () => {
    if (!nombreInput.trim() || nombreInput.trim().length < 3) {
      Alert.alert('Nombre requerido', 'El nombre de la disciplina debe tener al menos 3 caracteres.');
      return;
    }

    const dur = parseInt(duracionInput, 10);
    if (isNaN(dur) || dur < 15 || dur > 180) {
      Alert.alert('Duración inválida', 'La duración debe estar entre 15 y 180 minutos.');
      return;
    }

    try {
      setGuardando(true);
      if (editandoClase) {
        const res = await api.put(`/clases/${editandoClase.id_clase}`, {
          nombre: nombreInput.trim(),
          descripcion: descInput.trim(),
          duracion_minutos: dur,
          precio_sesion: parseFloat(precioInput) || 0,
          id_tipo_clase: tipoSeleccionado,
        });
        if (res.data.ok) {
          Alert.alert('¡Actualizada!', 'La disciplina se modificó exitosamente.');
          setModalVisible(false);
          fetchDatos();
        }
      } else {
        const res = await api.post('/clases', {
          nombre: nombreInput.trim(),
          descripcion: descInput.trim(),
          duracion_minutos: dur,
          precio_sesion: parseFloat(precioInput) || 0,
          id_tipo_clase: tipoSeleccionado,
        });
        if (res.data.ok) {
          Alert.alert('¡Creada!', 'Nueva disciplina añadida al catálogo.');
          setModalVisible(false);
          fetchDatos();
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al guardar disciplina';
      Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarClase = (item) => {
    Alert.alert(
      'Desactivar Disciplina',
      `¿Deseas retirar "${item.nombre}" del catálogo activo? No se afectarán las reservas pasadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, retirar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/clases/${item.id_clase}`);
              if (res.data.ok) {
                Alert.alert('Desactivada', 'La disciplina fue retirada del catálogo.');
                fetchDatos();
              }
            } catch (err) {
              const msg = err.response?.data?.message || err.message || 'No se pudo retirar la disciplina';
              Alert.alert('Aviso', msg);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    return (
      <Card style={styles.cardItem}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeTipo}>
            <Text style={styles.badgeTipoText}>{item.tipo_clase_nombre || 'General'}</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.iconActionBtn} onPress={() => abrirModalEditar(item)}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconActionBtn, { marginLeft: 10 }]} onPress={() => handleEliminarClase(item)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion || 'Sin descripción'}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{item.duracion_minutos} min</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="cash-outline" size={14} color={colors.secondary} style={{ marginRight: 4 }} />
            <Text style={[styles.footerText, { color: colors.secondary, fontWeight: '700' }]}>
              {item.precio_sesion > 0 ? `S/ ${item.precio_sesion}` : 'Incluida en plan'}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Ionicons name="barbell" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>CATÁLOGO DE DISCIPLINAS</Text>
        </View>
        <Text style={styles.title}>Disciplinas & Clases</Text>
        <Text style={styles.subtitle}>
          Crea nuevas actividades deportivas (Yoga, CrossFit, Zumba) y define sus duraciones
        </Text>
      </View>

      {/* Botón Nueva Disciplina */}
      <TouchableOpacity style={styles.addBtn} onPress={abrirModalCrear}>
        <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.addBtnText}>Añadir Nueva Disciplina</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando disciplinas...</Text>
        </View>
      ) : (
        <FlatList
          data={clases}
          keyExtractor={(item) => item.id_clase.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="barbell-outline" size={48} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Sin disciplinas creadas</Text>
              <Text style={styles.emptySubtitle}>Pulsa el botón de arriba para registrar tu primera clase.</Text>
            </View>
          }
        />
      )}

      {/* Modal Crear / Editar */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editandoClase ? 'Editar Disciplina' : 'Crear Nueva Disciplina'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre de la Clase</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej: CrossFit Power Pro"
                placeholderTextColor={colors.textMuted}
                value={nombreInput}
                onChangeText={setNombreInput}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Descripción breve</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Ej: Rutina de alta intensidad con barras y pesas rusas"
                placeholderTextColor={colors.textMuted}
                multiline={true}
                value={descInput}
                onChangeText={setDescInput}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Duración (min)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="60"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={duracionInput}
                    onChangeText={setDuracionInput}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Precio Sesión (S/)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={precioInput}
                    onChangeText={setPrecioInput}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Categoría / Tipo de Clase</Text>
              <View style={styles.chipRow}>
                {tipos.map((t) => {
                  const sel = tipoSeleccionado === t.id_tipo_clase;
                  return (
                    <TouchableOpacity
                      key={t.id_tipo_clase}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setTipoSeleccionado(t.id_tipo_clase)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {t.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleGuardarClase}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editandoClase ? 'Guardar Cambios' : 'Registrar Disciplina'}
                  </Text>
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
  badgeTipo: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTipoText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconActionBtn: {
    padding: 4,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  cardDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
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
  rowInputs: {
    flexDirection: 'row',
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
