import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  showLocalNotification,
  registerForPushNotificationsAsync,
} from '../services/notificationService';
import api from '../config/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cargar notificaciones desde la Base de Datos
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/notificaciones');
      if (res.data.ok) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.noLeidas || 0);
      }
    } catch (err) {
      console.warn('Error al obtener notificaciones de la BD:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Marcar una notificación como leída
  const markAsRead = async (idNotificacion) => {
    try {
      await api.put(`/notificaciones/${idNotificacion}/leida`);
      setNotifications((prev) =>
        prev.map((n) => (n.id_notificacion === idNotificacion ? { ...n, leido: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Error al marcar notificación como leída:', err.message);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      await api.put('/notificaciones/marcar-todas');
      setNotifications((prev) => prev.map((n) => ({ ...n, leido: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Error al marcar todas como leídas:', err.message);
    }
  };

  useEffect(() => {
    let active = true;

    if (user) {
      // 1. Obtener historial persistente de BD
      fetchNotifications();

      // 2. Registrar Expo Push Token en el backend
      registerForPushNotificationsAsync(api);

      // 3. Conectar a Socket.IO con token de autenticación
      connectNotificationSocket(
        user,
        (notif) => {
          if (!active) return;
          // Cuando llega una notificación nueva en tiempo real
          const nuevaNotif = {
            id_notificacion: notif.data?.id_notificacion || Date.now(),
            titulo: notif.title,
            mensaje: notif.body,
            tipo: notif.data?.tipo || 'alerta',
            leido: 0,
            fecha_creacion: notif.timestamp || new Date().toISOString(),
          };

          setNotifications((prev) => [nuevaNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        },
        token
      ).then((sock) => {
        if (active && sock) {
          setConnected(true);
        }
      });
    } else {
      disconnectNotificationSocket();
      setConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      active = false;
      disconnectNotificationSocket();
    };
  }, [user, fetchNotifications]);

  /**
   * Pide al backend que emita una señal real hacia este teléfono
   */
  const requestTestSignalFromBackend = async () => {
    try {
      const res = await api.post('/notificaciones/enviar-prueba', {
        title: '🏋️ SmartGym Notificación Real',
        body: `¡Hola ${user?.nombre || 'Atleta'}! El backend de SmartGym emitió esta señal al instante.`,
      });

      if (res.data.ok) {
        return { ok: true, message: 'Señal emitida desde el servidor' };
      }
      return { ok: false, message: res.data.message };
    } catch (err) {
      console.warn('Error al solicitar señal al backend:', err.message);
      // Fallback: mostrar notificación nativa local
      await showLocalNotification(
        '🏋️ SmartGym Notificación Local',
        `Demostración activa: Notificación nativa en tu dispositivo para ${user?.nombre || 'Atleta'}.`
      );
      return { ok: true, fallback: true };
    }
  };

  /**
   * Emite un aviso broadcast masivo a todos los clientes (Solo Administrador)
   */
  const sendBroadcastAlert = async (title, body) => {
    try {
      const res = await api.post('/notificaciones/broadcast', { title, body });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Error al enviar broadcast');
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        connected,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        requestTestSignalFromBackend,
        sendBroadcastAlert,
        showLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe usarse dentro de un NotificationProvider');
  }
  return context;
};
