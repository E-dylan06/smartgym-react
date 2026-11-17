import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { DEFAULT_HOST } from '../../config/api';

export default function LoginScreen({ navigation }) {
  const { login, authenticateWithBiometrics, isBiometricSupported } = useAuth();

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [contrasenia, setContrasenia] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal para configurar IP del servidor en red local
  const [modalVisible, setModalVisible] = useState(false);
  const [serverHost, setServerHost] = useState(DEFAULT_HOST);

  useEffect(() => {
    const loadSaved = async () => {
      const savedHost = await AsyncStorage.getItem('@smartgym_server_host');
      if (savedHost) setServerHost(savedHost);

      const lastLogin = await AsyncStorage.getItem('@smartgym_last_login');
      if (lastLogin) setLoginIdentifier(lastLogin);
    };
    loadSaved();
  }, []);

  const handleSaveHost = async () => {
    await AsyncStorage.setItem('@smartgym_server_host', serverHost.trim());
    setModalVisible(false);
    Alert.alert('Configuración guardada', `Servidor configurado en: ${serverHost.trim()}:3000`);
  };

  const handleLogin = async () => {
    if (!loginIdentifier.trim() || !contrasenia.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo/DNI y contraseña');
      return;
    }

    try {
      setLoading(true);
      const res = await login(loginIdentifier.trim(), contrasenia);
      if (!res.ok) {
        Alert.alert('Error de acceso', res.message || 'Credenciales incorrectas');
      }
    } catch (err) {
      if (err.response) {
        Alert.alert('Error de acceso', err.response.data?.message || 'Credenciales incorrectas');
      } else {
        Alert.alert(
          'Error de conexión',
          'No se pudo contactar al servidor. Verifica que el backend esté corriendo y tu celular esté en la misma red Wi-Fi.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const res = await authenticateWithBiometrics();
    if (!res.ok && res.message) {
      Alert.alert('Biometría', res.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SMARTGYM 2026</Text>
          </View>
          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>
            Inicia sesión para reservar tus clases y gestionar tus entrenamientos
          </Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Correo electrónico o DNI"
            placeholder="ej. socio@smartgym.pe o 72345678"
            value={loginIdentifier}
            onChangeText={setLoginIdentifier}
            keyboardType="email-address"
          />

          <CustomInput
            label="Contraseña"
            placeholder="••••••••"
            value={contrasenia}
            onChangeText={setContrasenia}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <CustomButton
            title="Iniciar Sesión"
            onPress={handleLogin}
            loading={loading}
          />

          {isBiometricSupported && (
            <CustomButton
              title="Ingresar con Huella / FaceID"
              onPress={handleBiometricLogin}
              variant="outline"
              style={{ marginTop: 4 }}
            />
          )}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿Aún no tienes cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.configServerButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.configServerText}>⚙️ Configurar IP del Servidor ({serverHost})</Text>
          </TouchableOpacity>
        </View>

        {/* Modal de configuración de IP para pruebas en móvil */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>IP del Servidor Backend</Text>
              <Text style={styles.modalDescription}>
                Ingresa la dirección IP de tu computadora para que tu teléfono se conecte por Wi-Fi.
              </Text>
              <TextInput
                value={serverHost}
                onChangeText={setServerHost}
                style={styles.ipInput}
                placeholder="192.168.0.106"
                placeholderTextColor={colors.textMuted}
              />
              <CustomButton title="Guardar IP" onPress={handleSaveHost} />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{ marginTop: 10, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textSecondary }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.4)',
    marginBottom: 12,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginVertical: 8,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  registerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  configServerButton: {
    marginTop: 28,
    alignItems: 'center',
    padding: 8,
  },
  configServerText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  ipInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 48,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 16,
  },
});
