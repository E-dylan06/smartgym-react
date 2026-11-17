import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// IP local de tu máquina para conectar el celular vía Expo Go
export const DEFAULT_HOST = '192.168.0.106';
export const PORT = '3000';

export const getBaseUrl = async () => {
  try {
    const customHost = await AsyncStorage.getItem('@smartgym_server_host');
    const host = customHost || DEFAULT_HOST;
    return `http://${host}:${PORT}/api`;
  } catch {
    return `http://${DEFAULT_HOST}:${PORT}/api`;
  }
};

export const getServerUrl = async () => {
  try {
    const customHost = await AsyncStorage.getItem('@smartgym_server_host');
    const host = customHost || DEFAULT_HOST;
    return `http://${host}:${PORT}`;
  } catch {
    return `http://${DEFAULT_HOST}:${PORT}`;
  }
};

export const getFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `http://${DEFAULT_HOST}:${PORT}${path.startsWith('/') ? '' : '/'}${path}`;
};

const api = axios.create({
  baseURL: `http://${DEFAULT_HOST}:${PORT}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar token JWT automáticamente
api.interceptors.request.use(
  async (config) => {
    try {
      const customHost = await AsyncStorage.getItem('@smartgym_server_host');
      const host = customHost || DEFAULT_HOST;
      config.baseURL = `http://${host}:${PORT}/api`;

      const token = await AsyncStorage.getItem('@smartgym_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Error al leer token para request:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
