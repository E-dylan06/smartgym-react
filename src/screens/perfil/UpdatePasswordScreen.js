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
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

export default function UpdatePasswordScreen({ navigation }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!actual.trim() || !nueva.trim() || !confirmar.trim()) {
      Alert.alert('Campos requeridos', 'Por favor llena todos los campos');
      return;
    }

    if (nueva.length < 6) {
      Alert.alert('Contraseña corta', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (nueva !== confirmar) {
      Alert.alert('Error', 'La nueva contraseña y su confirmación no coinciden');
      return;
    }

    try {
      setLoading(true);
      const res = await api.put('/auth/update-password', {
        contrasenia_actual: actual,
        nueva_contrasenia: nueva,
      });

      if (res.data.ok) {
        Alert.alert('¡Contraseña Actualizada!', 'Tu contraseña ha sido cambiada exitosamente', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al actualizar contraseña';
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
        <Text style={styles.title}>Actualizar Contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresa tu contraseña actual y define una nueva clave segura
        </Text>

        <CustomInput
          label="Contraseña Actual"
          placeholder="••••••••"
          value={actual}
          onChangeText={setActual}
          secureTextEntry
        />

        <CustomInput
          label="Nueva Contraseña (mínimo 6 caracteres)"
          placeholder="••••••••"
          value={nueva}
          onChangeText={setNueva}
          secureTextEntry
        />

        <CustomInput
          label="Confirmar Nueva Contraseña"
          placeholder="••••••••"
          value={confirmar}
          onChangeText={setConfirmar}
          secureTextEntry
        />

        <CustomButton
          title="Guardar Nueva Contraseña"
          onPress={handleUpdate}
          loading={loading}
          style={{ marginTop: 20 }}
        />

        <CustomButton
          title="Cancelar"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
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
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
});
