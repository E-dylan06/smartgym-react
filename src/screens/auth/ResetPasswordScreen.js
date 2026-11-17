import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

export default function ResetPasswordScreen({ route, navigation }) {
  const initialEmail = route.params?.correo || '';
  const demoCode = route.params?.codigoDemo || '';

  const [correo, setCorreo] = useState(initialEmail);
  const [codigo, setCodigo] = useState(demoCode);
  const [nuevaContrasenia, setNuevaContrasenia] = useState('');
  const [confirmarContrasenia, setConfirmarContrasenia] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (demoCode) setCodigo(demoCode);
    if (initialEmail) setCorreo(initialEmail);
  }, [demoCode, initialEmail]);

  const handleReset = async () => {
    if (!correo.trim() || !codigo.trim() || !nuevaContrasenia.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos');
      return;
    }

    if (nuevaContrasenia.length < 6) {
      Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (nuevaContrasenia !== confirmarContrasenia) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/reset-password', {
        correo: correo.trim(),
        codigo: codigo.trim(),
        nueva_contrasenia: nuevaContrasenia,
      });

      if (res.data.ok) {
        Alert.alert(
          '¡Éxito!',
          'Tu contraseña ha sido restaurada correctamente. Ahora puedes iniciar sesión con tu nueva clave.',
          [
            {
              text: 'Ir al Login',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al restablecer contraseña';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark-outline" size={50} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.title}>Nueva Contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa el código recibido y tu nueva contraseña de acceso.
          </Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Correo Electrónico"
            placeholder="tu@correo.com"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
          />

          <CustomInput
            label="Código de 6 dígitos"
            placeholder="123456"
            value={codigo}
            onChangeText={setCodigo}
            keyboardType="numeric"
          />

          <CustomInput
            label="Nueva Contraseña (mínimo 6 caracteres)"
            placeholder="••••••••"
            value={nuevaContrasenia}
            onChangeText={setNuevaContrasenia}
            secureTextEntry
          />

          <CustomInput
            label="Confirmar Nueva Contraseña"
            placeholder="••••••••"
            value={confirmarContrasenia}
            onChangeText={setConfirmarContrasenia}
            secureTextEntry
          />

          <CustomButton
            title="Restablecer Contraseña"
            onPress={handleReset}
            loading={loading}
            style={{ marginTop: 16 }}
          />

          <CustomButton
            title="Cancelar"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: 8 }}
          />
        </View>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 50,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
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
});
