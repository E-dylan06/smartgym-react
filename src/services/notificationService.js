import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import io from 'socket.io-client';
import { getServerUrl } from '../config/api';

// Configurar cómo debe comportarse la notificación cuando la app está abierta (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let socket = null;
let isInitialized = false;

/**
 * Configura canales nativos en Android y solicita permisos al usuario
 */
export const setupNotificationChannelsAndPermissions = async () => {
  if (isInitialized) return true;

  try {
    // 1. Canal de alta prioridad para Android (imprescindible para que levante el banner nativo)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('smartgym_channel', {
        name: 'SmartGym Avisos y Citas',
        description: 'Notificaciones en tiempo real sobre tus reservas, cupos y avisos del gimnasio',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF5722',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    }

    // 2. Solicitar permisos al sistema operativo
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permiso de notificaciones no otorgado por el usuario.');
      return false;
    }

    isInitialized = true;
    return true;
  } catch (err) {
    console.warn('Error al configurar permisos de notificaciones:', err.message);
    return false;
  }
};

/**
 * Obtiene el Expo Push Token del dispositivo y lo sincroniza con el backend
 */
export const registerForPushNotificationsAsync = async (apiClient) => {
  try {
    const hasPermission = await setupNotificationChannelsAndPermissions();
    if (!hasPermission) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync().catch((err) => {
      console.log('Push token no generado (habitual en emuladores de desarrollo):', err.message);
      return null;
    });

    if (tokenData?.data) {
      console.log('📱 Expo Push Token registrado:', tokenData.data);
      if (apiClient) {
        await apiClient.post('/notificaciones/token', { token: tokenData.data }).catch(() => {});
      }
      return tokenData.data;
    }
    return null;
  } catch (e) {
    console.warn('Error registrando push token en backend:', e.message);
    return null;
  }
};

/**
 * Conecta el socket al backend de SmartGym para escuchar señales en tiempo real
 */
export const connectNotificationSocket = async (user, onNotificationReceived) => {
  try {
    // Configurar permisos y canal primero
    await setupNotificationChannelsAndPermissions();

    const serverUrl = await getServerUrl();

    // Desconectar socket previo si existía
    if (socket) {
      socket.disconnect();
    }

    console.log(`📡 Conectando Socket.IO para notificaciones en: ${serverUrl}`);

    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log(`✅ Conectado a Socket.IO con ID: ${socket.id}`);
      if (user) {
        socket.emit('registrar_usuario', {
          id_usuario: user.id_usuario,
          rol: user.rol || user.rol_nombre,
        });
      }
    });

    // Escuchar la señal 'notificacion' emitida por el backend
    socket.on('notificacion', async (data) => {
      console.log('⚡ [Señal recibida del backend]:', data);

      // Levantar notificación nativa del sistema operativo en el teléfono
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: data.title || 'SmartGym 🏋️',
            body: data.body || '',
            data: data.data || {},
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            channelId: 'smartgym_channel',
          },
          trigger: null, // trigger null = mostrar inmediatamente
        });
      } catch (e) {
        console.warn('Error al levantar notificación nativa:', e.message);
      }

      // Notificar al callback de React si está registrado
      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(data);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Error de conexión en Socket.IO:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO desconectado:', reason);
    });

    return socket;
  } catch (error) {
    console.warn('Error inicializando Socket.IO:', error.message);
    return null;
  }
};

/**
 * Desconecta el socket al cerrar sesión
 */
export const disconnectNotificationSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Dispara una notificación nativa local de prueba inmediatamente
 */
export const showLocalNotification = async (title, body, data = {}) => {
  await setupNotificationChannelsAndPermissions();

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: title || 'SmartGym 🏋️',
      body: body || 'Prueba de notificación',
      data,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      channelId: 'smartgym_channel',
    },
    trigger: null,
  });
};
