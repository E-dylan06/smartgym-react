import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  // Inicializar sesión desde AsyncStorage
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('@smartgym_token');
        const storedUser = await AsyncStorage.getItem('@smartgym_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verificar validez del token con /auth/me en segundo plano
          try {
            const res = await api.get('/auth/me');
            if (res.data.ok) {
              setUser(res.data.data.usuario);
              await AsyncStorage.setItem('@smartgym_user', JSON.stringify(res.data.data.usuario));
            }
          } catch (err) {
            // Si el token expiró (401), cerrar sesión
            if (err.response?.status === 401) {
              await AsyncStorage.multiRemove(['@smartgym_token', '@smartgym_user']);
              setToken(null);
              setUser(null);
            }
          }
        }

        // Comprobar soporte biométrico
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(compatible && enrolled);
      } catch (e) {
        console.error('Error al restaurar sesión:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Iniciar sesión
  const login = async (loginIdentifier, contrasenia) => {
    const res = await api.post('/auth/login', {
      login: loginIdentifier,
      contrasenia,
    });

    if (res.data.ok) {
      const { usuario, token: jwtToken } = res.data.data;
      setToken(jwtToken);
      setUser(usuario);

      await AsyncStorage.setItem('@smartgym_token', jwtToken);
      await AsyncStorage.setItem('@smartgym_user', JSON.stringify(usuario));
      await AsyncStorage.setItem('@smartgym_last_login', loginIdentifier);

      return { ok: true, usuario };
    }
    return { ok: false, message: res.data.message };
  };

  // Registro de usuario
  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);

    if (res.data.ok) {
      const { usuario, token: jwtToken } = res.data.data;
      setToken(jwtToken);
      setUser(usuario);

      await AsyncStorage.setItem('@smartgym_token', jwtToken);
      await AsyncStorage.setItem('@smartgym_user', JSON.stringify(usuario));

      return { ok: true, usuario };
    }
    return { ok: false, message: res.data.message };
  };

  // Autenticación biométrica (Huella / FaceID)
  const authenticateWithBiometrics = async () => {
    try {
      if (!isBiometricSupported) {
        return { ok: false, message: 'Tu dispositivo no tiene biometría configurada' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ingresa a SmartGym con tu huella o FaceID',
        fallbackLabel: 'Usar contraseña',
      });

      if (result.success) {
        const storedToken = await AsyncStorage.getItem('@smartgym_token');
        const storedUser = await AsyncStorage.getItem('@smartgym_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          return { ok: true };
        } else {
          return { ok: false, message: 'Primero inicia sesión con contraseña una vez para recordar tu acceso' };
        }
      }
      return { ok: false, message: 'Autenticación biométrica cancelada' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  };

  // Actualizar datos del usuario en memoria y almacenamiento local
  const updateUserData = async (newUserData) => {
    const updated = { ...user, ...newUserData };
    setUser(updated);
    await AsyncStorage.setItem('@smartgym_user', JSON.stringify(updated));
  };

  // Cerrar sesión
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['@smartgym_token', '@smartgym_user']);
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        isBiometricSupported,
        login,
        register,
        logout,
        updateUserData,
        authenticateWithBiometrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
