import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

const OBJETIVOS_DISPONIBLES = [
  { id: 'Ganar masa muscular', label: '💪 Ganar masa muscular' },
  { id: 'Perder grasa y definir', label: '🔥 Perder grasa y definir' },
  { id: 'Mejorar resistencia', label: '🏃 Mejorar resistencia' },
  { id: 'Tonificación general', label: '⚡ Tonificación general' },
  { id: 'Salud y Bienestar', label: '🧘 Salud y Bienestar' },
];

const NIVELES_ACTIVIDAD = ['Principiante (1-2 días)', 'Moderado (3-4 días)', 'Activo (5+ días)'];

export default function MetricasProgresoScreen() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados Modal Registro
  const [modalVisible, setModalVisible] = useState(false);
  const [pesoInput, setPesoInput] = useState('');
  const [alturaInput, setAlturaInput] = useState('');
  const [objetivoInput, setObjetivoInput] = useState(OBJETIVOS_DISPONIBLES[0].id);
  const [nivelInput, setNivelInput] = useState(NIVELES_ACTIVIDAD[1]);
  const [guardando, setGuardando] = useState(false);

  const fetchMetricas = async () => {
    try {
      const res = await api.get('/perfil/metricas');
      if (res.data.ok) {
        setMetricas(res.data.data);
      }
    } catch (err) {
      console.warn('Error al cargar métricas:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetricas();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetricas();
  };

  const abrirModalRegistro = () => {
    const act = metricas?.corporales?.actual;
    setPesoInput(act?.peso_kg ? String(act.peso_kg) : '');
    setAlturaInput(act?.altura_cm ? String(act.altura_cm) : '170');
    setObjetivoInput(act?.objetivo || OBJETIVOS_DISPONIBLES[0].id);
    setNivelInput(act?.nivel_actividad || NIVELES_ACTIVIDAD[1]);
    setModalVisible(true);
  };

  const handleGuardarMetricas = async () => {
    const p = parseFloat(pesoInput.replace(',', '.'));
    const a = parseFloat(alturaInput.replace(',', '.'));

    if (isNaN(p) || p < 25 || p > 300) {
      Alert.alert('Peso inválido', 'Por favor ingresa un peso válido en kg (ejemplo: 72.5)');
      return;
    }

    if (isNaN(a) || a < 80 || a > 250) {
      Alert.alert('Altura inválida', 'Por favor ingresa tu altura en cm (ejemplo: 175)');
      return;
    }

    try {
      setGuardando(true);
      const res = await api.post('/perfil/metricas-corporales', {
        peso_kg: p,
        altura_cm: a,
        objetivo: objetivoInput,
        nivel_actividad: nivelInput,
      });

      if (res.data.ok) {
        Alert.alert('¡Métricas Actualizadas! 🎯', 'Tus medidas se registraron y tu IMC fue recalculado correctamente.');
        setModalVisible(false);
        fetchMetricas();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al guardar medidas';
      Alert.alert('Error', msg);
    } finally {
      setGuardando(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Calculando tu progreso y métricas...</Text>
      </View>
    );
  }

  const ent = metricas?.entrenamiento || {};
  const corp = metricas?.corporales?.actual;
  const hist = metricas?.corporales?.historial || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* BANNER DE RACHA / STREAK */}
      <View style={styles.streakBanner}>
        <View style={styles.streakIconCircle}>
          <Ionicons name="flame" size={32} color="#FF7A00" />
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakTitle}>Racha de Entrenamiento</Text>
          <Text style={styles.streakCounter}>
            {ent.racha_dias || 0} {ent.racha_dias === 1 ? 'Sesión Consecutiva' : 'Sesiones Consecutivas'}
          </Text>
          <Text style={styles.streakSubtext}>
            {ent.racha_dias > 0
              ? '¡Excelente disciplina! Cada entrenamiento cuenta para tu objetivo.'
              : 'Asiste a tu próxima clase para encender tu racha de entrenamiento.'}
          </Text>
        </View>
      </View>

      {/* MÉTRICAS DE ENTRENAMIENTO */}
      <Text style={styles.sectionTitle}>Rendimiento en el Gimnasio</Text>
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="calendar" size={18} color={colors.secondary} />
            <Text style={styles.kpiLabel}>Este Mes</Text>
          </View>
          <Text style={[styles.kpiValue, { color: colors.secondary }]}>
            {ent.asistencias_mes || 0}
          </Text>
          <Text style={styles.kpiFooter}>Clases completadas</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="time" size={18} color={colors.primary} />
            <Text style={styles.kpiLabel}>Horas Activas</Text>
          </View>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {ent.horas_totales || 0}h
          </Text>
          <Text style={styles.kpiFooter}>Tiempo acumulado</Text>
        </Card>
      </View>

      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="trophy" size={18} color={colors.accent} />
            <Text style={styles.kpiLabel}>Favorita</Text>
          </View>
          <Text style={[styles.kpiValueSmall, { color: colors.accent }]} numberOfLines={1}>
            {ent.disciplina_favorita || 'Ninguna'}
          </Text>
          <Text style={styles.kpiFooter}>
            {ent.conteo_favorita > 0 ? `${ent.conteo_favorita} sesiones asistidas` : 'Sin registros'}
          </Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Ionicons name="checkmark-done-circle" size={18} color="#60A5FA" />
            <Text style={styles.kpiLabel}>Total Asistencias</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#60A5FA' }]}>
            {ent.total_asistencias || 0}
          </Text>
          <Text style={styles.kpiFooter}>Histórico general</Text>
        </Card>
      </View>

      {/* COMPOSICIÓN CORPORAL E IMC */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Composición Corporal & IMC</Text>
        <TouchableOpacity style={styles.updateBadgeButton} onPress={abrirModalRegistro}>
          <Ionicons name="add-circle" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.updateBadgeText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {corp ? (
        <Card style={styles.imcCard}>
          <View style={styles.imcHeaderRow}>
            <View>
              <Text style={styles.imcNumberLabel}>Índice de Masa Corporal (IMC)</Text>
              <Text style={[styles.imcBigValue, { color: corp.color_imc }]}>
                {corp.imc}
              </Text>
            </View>
            <View style={[styles.imcBadge, { backgroundColor: `${corp.color_imc}20` }]}>
              <Text style={[styles.imcBadgeText, { color: corp.color_imc }]}>
                {corp.clasificacion_imc}
              </Text>
            </View>
          </View>

          {/* Barra visual de escala IMC */}
          <View style={styles.imcScaleContainer}>
            <View style={[styles.imcScaleBar, { backgroundColor: '#60A5FA' }]} />
            <View style={[styles.imcScaleBar, { backgroundColor: '#10B981' }]} />
            <View style={[styles.imcScaleBar, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.imcScaleBar, { backgroundColor: '#EF4444' }]} />
          </View>
          <View style={styles.imcScaleLabels}>
            <Text style={styles.scaleText}>Bajo (&lt;18.5)</Text>
            <Text style={styles.scaleText}>Normal (18.5-24.9)</Text>
            <Text style={styles.scaleText}>Sobrepeso</Text>
            <Text style={styles.scaleText}>Obesidad (&gt;30)</Text>
          </View>

          <View style={styles.divider} />

          {/* Detalles de Peso, Altura y Objetivo */}
          <View style={styles.bodyDetailsRow}>
            <View style={styles.bodyDetailItem}>
              <Ionicons name="scale-outline" size={16} color={colors.textMuted} />
              <Text style={styles.bodyDetailLabel}>Peso Actual</Text>
              <Text style={styles.bodyDetailVal}>{corp.peso_kg} kg</Text>
            </View>

            <View style={styles.bodyDetailItem}>
              <Ionicons name="resize-outline" size={16} color={colors.textMuted} />
              <Text style={styles.bodyDetailLabel}>Estatura</Text>
              <Text style={styles.bodyDetailVal}>{corp.altura_cm} cm</Text>
            </View>

            <View style={styles.bodyDetailItem}>
              <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
              <Text style={styles.bodyDetailLabel}>Nivel</Text>
              <Text style={styles.bodyDetailVal} numberOfLines={1}>{corp.nivel_actividad}</Text>
            </View>
          </View>

          <View style={styles.goalRow}>
            <Ionicons name="star" size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.goalText}>
              Objetivo: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{corp.objetivo}</Text>
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Ionicons name="fitness-outline" size={40} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>Aún no registras tus medidas</Text>
          <Text style={styles.emptySub}>
            Registra tu peso y estatura para que SmartGym calcule automáticamente tu IMC y supervise tu evolución.
          </Text>
          <CustomButton
            title="Registrar mis medidas"
            onPress={abrirModalRegistro}
            style={{ marginTop: 14 }}
          />
        </Card>
      )}

      {/* HISTORIAL DE EVOLUCIÓN */}
      {hist.length > 1 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Historial de Registros</Text>
          {hist.slice(0, 5).map((item, idx) => {
            const fechaStr = item.fecha_registro ? String(item.fecha_registro).substring(0, 10) : '';
            return (
              <Card key={item.id_metrica || idx} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.historyDate}>{fechaStr}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyWeight}>{item.peso_kg} kg</Text>
                  <Text style={styles.historyHeight}>{item.altura_cm} cm</Text>
                </View>
              </Card>
            );
          })}
        </>
      )}

      {/* MODAL PARA ACTUALIZAR MEDIDAS */}
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
                <Text style={styles.modalTitle}>Actualizar Medidas</Text>
                <Text style={styles.modalSub}>Mantén al día tu peso y objetivos corporales</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputLabel}>Peso Corporal (kg)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="scale-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 72.5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={pesoInput}
                  onChangeText={setPesoInput}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Estatura (cm)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="resize-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 175"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={alturaInput}
                  onChangeText={setAlturaInput}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Objetivo Principal</Text>
              <View style={styles.chipGroup}>
                {OBJETIVOS_DISPONIBLES.map((obj) => {
                  const sel = objetivoInput === obj.id;
                  return (
                    <TouchableOpacity
                      key={obj.id}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setObjetivoInput(obj.id)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {obj.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Frecuencia de Entrenamiento</Text>
              <View style={styles.chipGroup}>
                {NIVELES_ACTIVIDAD.map((niv) => {
                  const sel = nivelInput === niv;
                  return (
                    <TouchableOpacity
                      key={niv}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setNivelInput(niv)}
                    >
                      <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                        {niv}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleGuardarMetricas}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Guardar Medidas</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  streakBanner: {
    backgroundColor: 'rgba(255, 122, 0, 0.12)',
    borderColor: 'rgba(255, 122, 0, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  streakIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 122, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    color: '#FF7A00',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakCounter: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  streakSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  updateBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  updateBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 14,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  kpiValueSmall: {
    fontSize: 15,
    fontWeight: '700',
  },
  kpiFooter: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  imcCard: {
    padding: 16,
  },
  imcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  imcNumberLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  imcBigValue: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  imcBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  imcBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  imcScaleContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 6,
  },
  imcScaleBar: {
    flex: 1,
    marginHorizontal: 1,
  },
  imcScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleText: {
    color: colors.textMuted,
    fontSize: 9,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  bodyDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  bodyDetailItem: {
    alignItems: 'center',
  },
  bodyDetailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  bodyDetailVal: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 8,
  },
  goalText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyWeight: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 12,
  },
  historyHeight: {
    color: colors.textMuted,
    fontSize: 12,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalBody: {
    padding: 18,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
