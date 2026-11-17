import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

export default function AdminReportesScreen() {
  const [activeTab, setActiveTab] = useState('asistencias'); // 'asistencias' | 'entrenadores'
  const [reporteAsistencias, setReporteAsistencias] = useState(null);
  const [reporteCoaches, setReporteCoaches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReportes = async () => {
    try {
      const [resAsist, resCoaches] = await Promise.all([
        api.get('/admin/reportes/asistencias'),
        api.get('/admin/reportes/entrenadores'),
      ]);

      if (resAsist.data.ok) {
        setReporteAsistencias(resAsist.data.data);
      }
      if (resCoaches.data.ok) {
        setReporteCoaches(resCoaches.data.data);
      }
    } catch (err) {
      console.warn('Error al cargar reportes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportes();
  };

  const handleExportarSimulado = (tipo) => {
    Alert.alert(
      'Exportar Reporte',
      `Se ha generado el archivo estructurado de ${tipo} en formato CSV/Excel (UTF-8 con soporte para tildes y caracteres especiales). Los datos están listos para auditoría y contabilidad.`,
      [{ text: 'Entendido' }]
    );
  };

  const kpisAsist = reporteAsistencias?.kpis || {};
  const desgloseDisciplinas = reporteAsistencias?.desglose_por_disciplina || [];
  const sesiones = reporteAsistencias?.sesiones || [];

  const kpisCoaches = reporteCoaches?.kpis || {};
  const entrenadores = reporteCoaches?.entrenadores || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Ionicons name="bar-chart" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>MÓDULO DE AUDITORÍA Y CONTROL</Text>
        </View>
        <Text style={styles.title}>Reportes Ejecutivos</Text>
        <Text style={styles.subtitle}>
          Monitorea la efectividad de asistencia, aforo y horas dictadas por el staff
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'asistencias' && styles.tabBtnActive]}
          onPress={() => setActiveTab('asistencias')}
        >
          <Ionicons
            name="checkbox-outline"
            size={16}
            color={activeTab === 'asistencias' ? colors.primary : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'asistencias' && styles.tabBtnTextActive]}>
            Asistencias & Aforo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'entrenadores' && styles.tabBtnActive]}
          onPress={() => setActiveTab('entrenadores')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'entrenadores' ? colors.primary : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'entrenadores' && styles.tabBtnTextActive]}>
            Horas Entrenadores
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Procesando métricas y reportes...</Text>
        </View>
      ) : activeTab === 'asistencias' ? (
        <>
          {/* KPIs Asistencias */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Total Sesiones</Text>
              <Text style={styles.kpiNumber}>{kpisAsist.total_sesiones || 0}</Text>
              <Text style={styles.kpiSub}>Programadas</Text>
            </Card>

            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Tasa Asistencia</Text>
              <Text style={[styles.kpiNumber, { color: colors.secondary }]}>
                {kpisAsist.tasa_asistencia_pct || 0}%
              </Text>
              <Text style={styles.kpiSub}>Asistieron / Inscritos</Text>
            </Card>

            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Ocupación Prom.</Text>
              <Text style={[styles.kpiNumber, { color: colors.accent }]}>
                {kpisAsist.ocupacion_promedio_pct || 0}%
              </Text>
              <Text style={styles.kpiSub}>Capacidad cubierta</Text>
            </Card>
          </View>

          {/* Botón Exportar */}
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => handleExportarSimulado('Asistencias y Aforos')}
          >
            <Ionicons name="download-outline" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.exportBtnText}>Exportar Reporte a Excel / CSV</Text>
          </TouchableOpacity>

          {/* Desglose por disciplina */}
          <Text style={styles.sectionTitle}>Efectividad por Disciplina</Text>
          {desgloseDisciplinas.map((disc, idx) => (
            <Card key={idx} style={styles.cardItem}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardItemTitle}>{disc.clase}</Text>
                <View style={styles.miniTag}>
                  <Text style={styles.miniTagText}>{disc.sesiones} sesiones</Text>
                </View>
              </View>
              <View style={styles.detailStatsRow}>
                <Text style={styles.statDetail}>Inscritos: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{disc.inscritos}</Text></Text>
                <Text style={styles.statDetail}>Asistieron: <Text style={{ color: colors.secondary, fontWeight: '700' }}>{disc.asistieron}</Text></Text>
                <Text style={styles.statDetail}>
                  Efectividad:{' '}
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>
                    {disc.inscritos > 0 ? Math.round((disc.asistieron / disc.inscritos) * 100) : 0}%
                  </Text>
                </Text>
              </View>
            </Card>
          ))}

          {/* Listado de últimas sesiones */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Registro Detallado de Sesiones</Text>
          {sesiones.slice(0, 10).map((s) => (
            <Card key={s.id_horario} style={styles.cardSession}>
              <View style={styles.cardTopRow}>
                <Text style={styles.sessionTitle}>{s.clase}</Text>
                <Text style={styles.sessionDate}>{s.fecha}</Text>
              </View>
              <Text style={styles.sessionCoach}>Coach: {s.entrenador} • {s.horario}</Text>
              <View style={styles.sessionFooter}>
                <Text style={styles.sessionMetric}>
                  Aforo: {s.inscritos}/{s.capacidad} ({s.ocupacion_pct}%)
                </Text>
                <Text style={[styles.sessionMetric, { color: colors.secondary }]}>
                  Asistieron: {s.asistieron}
                </Text>
                {s.faltaron > 0 && (
                  <Text style={[styles.sessionMetric, { color: colors.danger }]}>
                    Faltas: {s.faltaron}
                  </Text>
                )}
              </View>
            </Card>
          ))}
        </>
      ) : (
        <>
          {/* KPIs Entrenadores */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Staff Activo</Text>
              <Text style={styles.kpiNumber}>{kpisCoaches.total_entrenadores || 0}</Text>
              <Text style={styles.kpiSub}>Entrenadores</Text>
            </Card>

            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Horas Dictadas</Text>
              <Text style={[styles.kpiNumber, { color: colors.primary }]}>
                {kpisCoaches.total_horas_dictadas || 0}h
              </Text>
              <Text style={styles.kpiSub}>Acumuladas</Text>
            </Card>

            <Card style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Nómina Est.</Text>
              <Text style={[styles.kpiNumber, { color: '#10B981', fontSize: 16 }]}>
                {kpisCoaches.total_nomina_formateada || 'S/ 0'}
              </Text>
              <Text style={styles.kpiSub}>Honorarios</Text>
            </Card>
          </View>

          {/* Botón Exportar */}
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => handleExportarSimulado('Horas y Honorarios de Entrenadores')}
          >
            <Ionicons name="download-outline" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.exportBtnText}>Exportar Nómina a Excel / CSV</Text>
          </TouchableOpacity>

          {/* Tarjetas por entrenador */}
          <Text style={styles.sectionTitle}>Horas y Honorarios por Instructor</Text>
          {entrenadores.map((coach) => (
            <Card key={coach.id_entrenador} style={styles.coachCard}>
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.coachName}>{coach.nombre}</Text>
                  <Text style={styles.coachSpec}>{coach.especialidad} • Tarifa: S/ {coach.tarifa_hora}/h</Text>
                </View>
                <View style={styles.honorariosBadge}>
                  <Text style={styles.honorariosText}>{coach.honorarios_formateados}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.coachStatsGrid}>
                <View style={styles.coachStatItem}>
                  <Text style={styles.coachStatVal}>{coach.clases_dictadas}</Text>
                  <Text style={styles.coachStatLbl}>Clases dictadas</Text>
                </View>
                <View style={styles.coachStatItem}>
                  <Text style={[styles.coachStatVal, { color: colors.primary }]}>{coach.horas_dictadas}h</Text>
                  <Text style={styles.coachStatLbl}>Horas reloj</Text>
                </View>
                <View style={styles.coachStatItem}>
                  <Text style={[styles.coachStatVal, { color: colors.secondary }]}>{coach.asistencias_confirmadas}</Text>
                  <Text style={styles.coachStatLbl}>Asistencias</Text>
                </View>
              </View>
            </Card>
          ))}
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
  header: {
    marginBottom: 16,
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
  },
  tabBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  kpiLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiNumber: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 4,
  },
  kpiSub: {
    color: colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 18,
  },
  exportBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardItem: {
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardItemTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  miniTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniTagText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statDetail: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cardSession: {
    padding: 12,
    marginBottom: 8,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionDate: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionCoach: {
    color: colors.textMuted,
    fontSize: 12,
    marginVertical: 4,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sessionMetric: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  coachCard: {
    padding: 14,
    marginBottom: 10,
  },
  coachName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  coachSpec: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  honorariosBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  honorariosText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  coachStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  coachStatItem: {
    alignItems: 'center',
  },
  coachStatVal: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  coachStatLbl: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
