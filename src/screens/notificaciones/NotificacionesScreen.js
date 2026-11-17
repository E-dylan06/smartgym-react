import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotification } from '../../context/NotificationContext';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';

export default function NotificacionesScreen() {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotification();

  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'no_leidas'
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const notificacionesFiltradas = notifications.filter((n) => {
    if (filtro === 'no_leidas') return Number(n.leido) === 0;
    return true;
  });

  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'reserva_confirmada':
        return { name: 'calendar-outline', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'reserva_cancelada':
        return { name: 'close-circle-outline', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'clase_reprogramada_por_entrenador':
      case 'reprogramacion':
        return { name: 'time-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'cambio_entrenador_notificado':
      case 'asignacion_sustituto':
        return { name: 'swap-horizontal-outline', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'broadcast':
      case 'comunicado_general':
        return { name: 'megaphone-outline', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' };
      case 'prueba':
        return { name: 'flash-outline', color: colors.primary, bg: 'rgba(255, 87, 34, 0.15)' };
      default:
        return { name: 'notifications-outline', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
    }
  };

  const formatearFecha = (fechaRaw) => {
    if (!fechaRaw) return '';
    try {
      const d = new Date(fechaRaw);
      const hoy = new Date();
      const esHoy =
        d.getDate() === hoy.getDate() &&
        d.getMonth() === hoy.getMonth() &&
        d.getFullYear() === hoy.getFullYear();

      const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (esHoy) return `Hoy, ${hora}`;
      return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${hora}`;
    } catch {
      return String(fechaRaw);
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = Number(item.leido) === 0;
    const iconConfig = getNotificationIcon(item.tipo);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (isUnread) markAsRead(item.id_notificacion);
        }}
      >
        <Card style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
              <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                  {item.titulo}
                </Text>
                {isUnread && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NUEVO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.notifDate}>{formatearFecha(item.fecha_creacion)}</Text>
            </View>
          </View>

          <Text style={styles.notifBody}>{item.mensaje}</Text>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Barra de Filtros y Acción Masiva */}
      <View style={styles.topBar}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filtro === 'todas' && styles.filterChipActive]}
            onPress={() => setFiltro('todas')}
          >
            <Text style={[styles.filterText, filtro === 'todas' && styles.filterTextActive]}>
              Todas ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filtro === 'no_leidas' && styles.filterChipActive]}
            onPress={() => setFiltro('no_leidas')}
          >
            <Text style={[styles.filterText, filtro === 'no_leidas' && styles.filterTextActive]}>
              Sin leer ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
            <Ionicons name="checkmark-done" size={16} color={colors.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.markAllText}>Leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de Notificaciones */}
      {loading && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando notificaciones...</Text>
        </View>
      ) : notificacionesFiltradas.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>
            {filtro === 'no_leidas' ? 'Sin notificaciones pendientes' : 'No tienes notificaciones'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filtro === 'no_leidas'
              ? '¡Estás al día con todos tus avisos y reservas!'
              : 'Aquí verás confirmaciones de tus clases, cambios de horarios y anuncios.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notificacionesFiltradas}
          keyExtractor={(item) => String(item.id_notificacion)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notifCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  notifCardUnread: {
    borderColor: colors.primary,
    backgroundColor: '#1E1A18',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  newBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  notifDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  notifBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginLeft: 50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});
