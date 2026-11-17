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
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';

export default function EditProfileScreen({ route, navigation }) {
  const { updateUserData } = useAuth();
  const perfil = route.params?.perfil || {};
  const onUpdated = route.params?.onUpdated;

  const [nombre, setNombre] = useState(perfil.nombre || '');
  const [telefono, setTelefono] = useState(perfil.telefono || '');
  const [contactoEmergencia, setContactoEmergencia] = useState(perfil.contacto_emergencia || '');
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(perfil.telefono_emergencia || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa tu nombre completo');
      return;
    }

    try {
      setLoading(true);
      const res = await api.put('/perfil', {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        contacto_emergencia: contactoEmergencia.trim() || null,
        telefono_emergencia: telefonoEmergencia.trim() || null,
      });

      if (res.data.ok) {
        Alert.alert('¡Éxito!', 'Perfil actualizado correctamente');
        updateUserData(res.data.data.usuario);
        if (onUpdated) onUpdated();
        navigation.goBack();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al actualizar perfil';
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
        <Text style={styles.title}>Editar Información</Text>
        <Text style={styles.subtitle}>
          Mantén tus datos y teléfonos de contacto actualizados
        </Text>

        <CustomInput
          label="Nombre Completo"
          value={nombre}
          onChangeText={setNombre}
        />

        <CustomInput
          label="Teléfono"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />

        <Text style={styles.sectionHeader}>Contacto de Emergencia</Text>

        <CustomInput
          label="Nombre de Contacto"
          placeholder="ej. Madre, Pareja, Hermano"
          value={contactoEmergencia}
          onChangeText={setContactoEmergencia}
        />

        <CustomInput
          label="Teléfono de Emergencia"
          value={telefonoEmergencia}
          onChangeText={setTelefonoEmergencia}
          keyboardType="phone-pad"
        />

        <CustomButton
          title="Guardar Cambios"
          onPress={handleSave}
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
  sectionHeader: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
});
