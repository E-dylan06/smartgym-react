import React, { useState } from 'react';
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

export default function ForgotPasswordScreen({ navigation }) {
  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!correo.trim()) {
      Alert.alert('Correo requerido', 'Ingresa tu correo para recuperar el acceso');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/forgot-password', {
        correo: correo.trim(),
      });

      if (res.data.ok) {
        const codigo = res.data.data?.codigo_demo;
        Alert.alert(
          'Código Generado',
          `Se envió tu código de recuperación.\n\nCódigo de prueba: ${codigo}\n\nUsa este código en la siguiente pantalla.`,
          [
            {
              text: 'Continuar',
              onPress: () =>
                navigation.navigate('ResetPassword', {
                  correo: correo.trim(),
                  codigoDemo: codigo,
                }),
            },
          ]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al solicitar código';
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
          <Ionicons name="lock-closed-outline" size={50} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa tu correo registrado y te proporcionaremos un código de 6 dígitos para restaurar tu acceso.
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

          <CustomButton
            title="Enviar Código de Recuperación"
            onPress={handleRequestCode}
            loading={loading}
            style={{ marginTop: 16 }}
          />

          <CustomButton
            title="Volver al Login"
            variant="outline"
            onPress={() => navigation.goBack()}
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
    marginBottom: 32,
  },
  icon: {
    fontSize: 50,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
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
});
