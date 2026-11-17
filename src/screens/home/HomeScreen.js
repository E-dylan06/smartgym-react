import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { unreadCount, requestTestSignalFromBackend, sendBroadcastAlert } = useNotification();
  const isAdmin = user?.rol === 'administrador' || user?.rol_nombre === 'administrador';

  // Estados para Cliente
  const [proximaReserva, setProximaReserva] = useState(null);
  const [totalClases, setTotalClases] = useState(0);

  // Estados para Administrador / Dueño
  const [adminData, setAdminData] = useState(null);
  const [sendingNotif, setSendingNotif] = useState(false);

  // Estados comunes
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleAdminBroadcast = async () => {
    try {
      setSendingNotif(true);
      await sendBroadcastAlert(
        '¡Aviso de SmartGym! 📢',
        'El administrador ha publicado una actualización de horarios para el fin de semana.'
      );
      Alert.alert('✅ Notificación Emitida', 'Se envió la señal de notificación masiva a todos los teléfonos.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setSendingNotif(true);
      const res = await requestTestSignalFromBackend();
      if (res.ok) {
        Alert.alert('🔔 Señal Emitida', 'El backend emitió la notificación hacia tu teléfono.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo emitir la señal.');
    } finally {
      setSendingNotif(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      if (isAdmin) {
        // Cargar métricas ejecutivas del Administrador
        const resAdmin = await api.get('/dashboard/admin');
        if (resAdmin.data.ok) {
          setAdminData(resAdmin.data.data);
        }
      } else {
        // 1. Obtener reservas del cliente
        const resReservas = await api.get('/reservas/mis-reservas');
        if (resReservas.data.ok) {
          const proximas = resReservas.data.data.proximas || [];
          setProximaReserva(proximas.length > 0 ? proximas[0] : null);
        }

        // 2. Obtener total de clases
        const resClases = await api.get('/clases');
        if (resClases.data.ok) {
          setTotalClases(resClases.data.total || 0);
        }
      }
    } catch (err) {
      console.warn('Error al cargar dashboard:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  // =========================================================================
  // VISTA 1: DASHBOARD DEL DUEÑO / ADMINISTRADOR
  // =========================================================================
  if (isAdmin) {
    const kpis = adminData?.kpis || {};
    const aforoEnVivo = adminData?.aforoEnVivo || [];
    const alertas = adminData?.alertas || {};
    const topClases = adminData?.topClases || [];

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Ejecutivo del Dueño */}
        <View style={styles.header}>
          <View>
            <View style={styles.adminBadgeRow}>
              <Ionicons name="shield-checkmark" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={styles.adminBadgeText}>PANEL DEL DUEÑO</Text>
            </View>
            <Text style={styles.name}>{user?.nombre || 'Administrador'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              style={styles.notifBadgeBtn}
              onPress={() => navigation.navigate('Notificaciones')}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.unreadDotBadge}>
                  <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileBadge, { borderColor: '#F59E0B' }]}
              onPress={() => navigation.navigate('PerfilTab')}
            >
              <Ionicons name="business" size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Resumen */}
        <View style={styles.adminBanner}>
          <View style={styles.tagRow}>
            <Ionicons name="stats-chart" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.heroTag}>METRICAS EN TIEMPO REAL</Text>
          </View>
          <Text style={styles.adminBannerTitle}>Control General del Gimnasio</Text>
          <Text style={styles.adminBannerSubtitle}>
            Monitoreo en vivo de ingresos proyectados, aforo de salas y asistencia de socios.
          </Text>
        </View>

        {/* Acciones Rápidas del Administrador */}
        <View style={styles.adminQuickActionsRow}>
          <TouchableOpacity
            style={styles.adminQuickBtn}
            onPress={() => navigation.navigate('UsuariosTab')}
          >
            <Ionicons name="people" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.adminQuickBtnText}>Gestión Usuarios & Roles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminQuickBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('ProgramarTab')}
          >
            <Ionicons name="add-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.adminQuickBtnText}>Programar Horario</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* GRID DE KPIs (4 Tarjetas) */}
            <Text style={styles.sectionTitle}>Indicadores Clave (KPIs)</Text>
            <View style={styles.kpiGrid}>
              {/* KPI 1: Socios */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Ionicons name="people" size={20} color={colors.primary} />
                  <View style={[styles.miniBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={[styles.miniBadgeText, { color: colors.secondary }]}>
                      {kpis.porcentajeSociosActivos || 0}% Activos
                    </Text>
                  </View>
                </View>
                <Text style={styles.kpiValue}>{kpis.totalSocios || 0}</Text>
                <Text style={styles.kpiLabel}>Total Socios Registrados</Text>
                <Text style={styles.kpiSubtext}>
                  {kpis.sociosActivos || 0} con membresía vigente
                </Text>
              </Card>

              {/* KPI 2: Ingresos */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Ionicons name="cash" size={20} color="#10B981" />
                  <View style={[styles.miniBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={[styles.miniBadgeText, { color: '#10B981' }]}>Mensual</Text>
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                  {kpis.ingresosFormateados || 'S/ 0.00'}
                </Text>
                <Text style={styles.kpiLabel}>Ingresos por Membresías</Text>
                <Text style={styles.kpiSubtext}>Proyección de socios activos</Text>
              </Card>

              {/* KPI 3: Reservas */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Ionicons name="calendar" size={20} color="#38BDF8" />
                  <View style={[styles.miniBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                    <Text style={[styles.miniBadgeText, { color: '#38BDF8' }]}>
                      {kpis.reservasHoy || 0} Hoy
                    </Text>
                  </View>
                </View>
                <Text style={styles.kpiValue}>{kpis.reservasMes || 0}</Text>
                <Text style={styles.kpiLabel}>Reservas del Mes</Text>
                <Text style={styles.kpiSubtext}>Total de citas agendadas</Text>
              </Card>

              {/* KPI 4: Asistencia */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#F59E0B" />
                  <View style={[styles.miniBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Text style={[styles.miniBadgeText, { color: '#F59E0B' }]}>Histórico</Text>
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                  {kpis.tasaAsistencia || 0}%
                </Text>
                <Text style={styles.kpiLabel}>Tasa de Asistencia</Text>
                <Text style={styles.kpiSubtext}>
                  {kpis.totalAsistieron || 0} asistencias registradas
                </Text>
              </Card>
            </View>

            {/* MÓDULOS DE GESTIÓN AVANZADA (C.1, C.2, C.3) */}
            <Text style={styles.sectionTitle}>Módulos de Gestión Avanzada</Text>
            <View style={styles.adminModulesContainer}>
              <TouchableOpacity
                style={styles.adminModuleCard}
                onPress={() => navigation.navigate('AdminReportes')}
              >
                <View style={[styles.adminModuleIconBg, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Ionicons name="bar-chart" size={22} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminModuleTitle}>Reportes & Nómina de Coaches</Text>
                  <Text style={styles.adminModuleDesc}>Asistencias por clase, horas dictadas y honorarios</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminModuleCard}
                onPress={() => navigation.navigate('AdminBloqueos')}
              >
                <View style={[styles.adminModuleIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="calendar-clear" size={22} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminModuleTitle}>Feriados & Bloqueos de Gimnasio</Text>
                  <Text style={styles.adminModuleDesc}>Días festivos y cierres por mantenimiento</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminModuleCard}
                onPress={() => navigation.navigate('AdminDisciplinas')}
              >
                <View style={[styles.adminModuleIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="barbell" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminModuleTitle}>Catálogo de Disciplinas (CRUD)</Text>
                  <Text style={styles.adminModuleDesc}>Crear, editar y dar de baja disciplinas deportivas</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* CONTROL DE AFORO EN TIEMPO REAL */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Control de Aforo en Vivo</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ClasesTab')}>
                <Text style={styles.seeAllText}>Ver catálogo</Text>
              </TouchableOpacity>
            </View>

            {aforoEnVivo.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptySubtitle}>No hay sesiones programadas próximas</Text>
              </Card>
            ) : (
              aforoEnVivo.map((h) => {
                let colorBarra = colors.secondary;
                if (h.porcentaje_ocupacion >= 100) colorBarra = colors.danger;
                else if (h.porcentaje_ocupacion >= 70) colorBarra = colors.accent;

                return (
                  <Card key={h.id_horario} style={styles.aforoCard}>
                    <View style={styles.aforoHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aforoClase}>{h.clase_nombre}</Text>
                        <Text style={styles.aforoTrainer}>
                          Trainer: {h.entrenador_nombre || 'Asignado'} • {h.turno || 'Turno'}
                        </Text>
                      </View>
                      <View style={[styles.aforoBadge, { backgroundColor: `${colorBarra}22` }]}>
                        <Text style={[styles.aforoBadgeText, { color: colorBarra }]}>
                          {h.porcentaje_ocupacion}% LLENO
                        </Text>
                      </View>
                    </View>

                    {/* Barra de progreso de aforo */}
                    <View style={styles.progressBarBackground}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, h.porcentaje_ocupacion)}%`,
                            backgroundColor: colorBarra,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.aforoFooter}>
                      <Text style={styles.aforoFooterText}>
                        <Ionicons name="time-outline" size={12} color={colors.textSecondary} />{' '}
                        {h.hora_inicio?.substring(0, 5)} - {h.hora_fin?.substring(0, 5)}
                      </Text>
                      <Text style={styles.aforoFooterText}>
                        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                          {h.cupos_ocupados}
                        </Text>{' '}
                        de {h.capacidad_maxima} cupos ({h.cupos_disponibles} libres)
                      </Text>
                    </View>
                  </Card>
                );
              })
            )}

            {/* ALERTAS DE GESTIÓN */}
            <Text style={styles.sectionTitle}>Alertas Administrativas</Text>
            {alertas.totalAlertas > 0 ? (
              <Card style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Ionicons name="warning" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.alertTitle}>
                    {alertas.membresiasPorVencer?.length || 0} Membresías por Vencer (7 días)
                  </Text>
                </View>
                {alertas.membresiasPorVencer?.map((m) => (
                  <View key={m.id_usuario} style={styles.alertItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertItemName}>{m.nombre}</Text>
                      <Text style={styles.alertItemSub}>
                        {m.plan_nombre || 'Plan'} • Tel: {m.telefono || 'Sin teléfono'}
                      </Text>
                    </View>
                    <View style={styles.alertItemBadge}>
                      <Text style={styles.alertItemBadgeText}>
                        {m.dias_restantes}d restantes
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={styles.okCard}>
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.okTitle}>Todo bajo control</Text>
                  <Text style={styles.okSubtitle}>No hay vencimientos ni sobrecupos críticos hoy.</Text>
                </View>
              </Card>
            )}

            {/* TOP DISCIPLINAS */}
            {topClases.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Disciplinas Más Populares</Text>
                <Card style={styles.topClasesCard}>
                  {topClases.map((c, index) => (
                    <View key={c.id_clase} style={styles.topClaseRow}>
                      <View style={styles.rankingNumber}>
                        <Text style={styles.rankingText}>#{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.topClaseTitle}>{c.nombre}</Text>
                        <Text style={styles.topClaseSub}>{c.duracion_minutos} min por sesión</Text>
                      </View>
                      <View style={styles.topClaseReservas}>
                        <Text style={styles.topClaseReservasCount}>{c.total_reservas}</Text>
                        <Text style={styles.topClaseReservasLabel}>reservas</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* COMUNICACIONES Y NOTIFICACIONES PUSH EN TIEMPO REAL */}
            <Text style={styles.sectionTitle}>Comunicaciones en Vivo</Text>
            <Card style={styles.notifAdminCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="notifications-circle" size={26} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.notifAdminTitle}>Señales Push al Celular</Text>
              </View>
              <Text style={styles.notifAdminDesc}>
                Emite señales directas por WebSocket desde el backend Node.js para levantar notificaciones nativas en el dispositivo móvil.
              </Text>
              <View style={styles.notifBtnRow}>
                <TouchableOpacity
                  style={[styles.notifBtn, { backgroundColor: colors.surfaceLight }]}
                  onPress={handleTestNotification}
                  disabled={sendingNotif}
                >
                  <Ionicons name="phone-portrait-outline" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.notifBtnText}>Probar en mi celular</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.notifBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAdminBroadcast}
                  disabled={sendingNotif}
                >
                  <Ionicons name="megaphone-outline" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.notifBtnText}>Aviso Masivo a Socios</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    );
  }

  // =========================================================================
  // VISTA 2: DASHBOARD DEL SOCIO / CLIENTE (Experiencia deportiva)
  // =========================================================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header con Saludo */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>¡HOLA DE NUEVO!</Text>
          <Text style={styles.name}>{user?.nombre || 'Atleta'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={styles.notifBadgeBtn}
            onPress={() => navigation.navigate('Notificaciones')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.unreadDotBadge}>
                <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => navigation.navigate('PerfilTab')}
          >
            {user?.nombre ? (
              <Text style={styles.profileBadgeText}>
                {user.nombre.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner Principal de Motivación */}
      <View style={styles.heroBanner}>
        <View style={styles.tagRow}>
          <Ionicons name="flame" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.heroTag}>SMARTGYM 2026</Text>
        </View>
        <Text style={styles.heroTitle}>Supera tus límites hoy</Text>
        <Text style={styles.heroSubtitle}>
          El control total de tus entrenamientos, aforo y reservas en la palma de tu mano.
        </Text>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={() => navigation.navigate('ClasesTab')}
        >
          <Text style={styles.heroButtonText}>Ver Clases Disponibles</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Próxima Clase Reservada */}
      <Text style={styles.sectionTitle}>Tu Próxima Clase</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
      ) : proximaReserva ? (
        <Card style={styles.nextReservationCard}>
          <View style={styles.resHeader}>
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.secondary} style={{ marginRight: 4 }} />
              <Text style={styles.activeText}>CONFIRMADA</Text>
            </View>
            <View style={styles.iconTextRow}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.resDate}>
                {new Date(proximaReserva.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
          </View>

          <Text style={styles.resTitle}>{proximaReserva.clase_nombre}</Text>

          <View style={styles.resDetailsRow}>
            <View style={styles.iconTextRow}>
              <Ionicons name="time-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.resDetail}>
                {proximaReserva.hora_inicio?.substring(0, 5)} - {proximaReserva.hora_fin?.substring(0, 5)}
              </Text>
            </View>
            <View style={[styles.iconTextRow, { marginTop: 4 }]}>
              <Ionicons name="person-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.resDetail}>
                Trainer: {proximaReserva.entrenador_nombre}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewReservationsLink}
            onPress={() => navigation.navigate('ReservasTab')}
          >
            <Text style={styles.viewReservationsText}>Gestionar mis reservas</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={38} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>No tienes clases programadas</Text>
          <Text style={styles.emptySubtitle}>
            Explora los horarios disponibles y asegura tu cupo antes de que se agote.
          </Text>
          <TouchableOpacity
            style={styles.bookNowButton}
            onPress={() => navigation.navigate('ClasesTab')}
          >
            <Text style={styles.bookNowText}>Reservar Ahora</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Accesos Rápidos */}
      <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('ClasesTab')}
        >
          <Ionicons name="barbell-outline" size={26} color={colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.quickTitle}>Clases y Cupos</Text>
          <Text style={styles.quickDesc}>{totalClases} disciplinas activas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('ReservasTab')}
        >
          <Ionicons name="clipboard-outline" size={26} color={colors.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.quickTitle}>Mis Reservas</Text>
          <Text style={styles.quickDesc}>Historial y citas</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  greeting: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  adminBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  adminBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  profileBadgeText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  adminBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  adminBannerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  adminBannerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  kpiLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  aforoCard: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  aforoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  aforoClase: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  aforoTrainer: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  aforoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aforoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  aforoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aforoFooterText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  alertCard: {
    padding: 14,
    backgroundColor: '#1E293B',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 20,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '800',
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  alertItemName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  alertItemSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  alertItemBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertItemBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  okCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  okTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  okSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  topClasesCard: {
    padding: 14,
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  topClaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  rankingNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankingText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  topClaseTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  topClaseSub: {
    color: colors.textMuted,
    fontSize: 11,
  },
  topClaseReservas: {
    alignItems: 'flex-end',
  },
  topClaseReservasCount: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  topClaseReservasLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  heroBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.3)',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroTag: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  heroButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  nextReservationCard: {
    padding: 18,
    marginBottom: 24,
  },
  resHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resDate: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  resTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  resDetailsRow: {
    marginBottom: 14,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resDetail: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  viewReservationsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
    paddingTop: 10,
  },
  viewReservationsText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  bookNowButton: {
    backgroundColor: colors.surfaceLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  bookNowText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    backgroundColor: colors.surface,
    width: '48%',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickDesc: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  notifAdminCard: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  notifAdminTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  notifAdminDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  notifBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notifBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  notifBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  adminQuickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
  },
  adminQuickBtn: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminQuickBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  notifBadgeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDotBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  unreadDotText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  adminModulesContainer: {
    gap: 10,
    marginBottom: 20,
  },
  adminModuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  adminModuleIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminModuleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  adminModuleDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
