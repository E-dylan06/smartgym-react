import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasenia, setContrasenia] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contactoEmergencia, setContactoEmergencia] = useState('');
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!nombre.trim() || !correo.trim() || !contrasenia.trim()) {
      Alert.alert('Campos obligatorios', 'Por favor completa tu nombre, correo y contraseña');
      return;
    }

    if (contrasenia.length < 6) {
      Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      const res = await register({
        nombre: nombre.trim(),
        correo: correo.trim(),
        contrasenia,
        dni: dni.trim() || undefined,
        telefono: telefono.trim() || undefined,
        contacto_emergencia: contactoEmergencia.trim() || undefined,
        telefono_emergencia: telefonoEmergencia.trim() || undefined,
      });

      if (res.ok) {
        Alert.alert('¡Bienvenido!', 'Tu cuenta ha sido creada exitosamente en SmartGym');
      } else {
        Alert.alert('Error al registrarse', res.message || 'No se pudo completar el registro');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al conectar con el servidor';
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
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>
            Únete a SmartGym y gestiona tus reservas de manera ágil
          </Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label="Nombre Completo *"
            placeholder="ej. Carlos Sánchez"
            value={nombre}
            onChangeText={setNombre}
          />

          <CustomInput
            label="Correo Electrónico *"
            placeholder="carlos@correo.com"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
          />

          <CustomInput
            label="Contraseña (mínimo 6 caracteres) *"
            placeholder="••••••••"
            value={contrasenia}
            onChangeText={setContrasenia}
            secureTextEntry
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <CustomInput
                label="DNI"
                placeholder="72345678"
                value={dni}
                onChangeText={setDni}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <CustomInput
                label="Teléfono"
                placeholder="987654321"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>Contacto de Emergencia (Opcional)</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <CustomInput
                label="Nombre Contacto"
                placeholder="ej. Mamá / Hermano"
                value={contactoEmergencia}
                onChangeText={setContactoEmergencia}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <CustomInput
                label="Teléfono Emergencia"
                placeholder="912345678"
                value={telefonoEmergencia}
                onChangeText={setTelefonoEmergencia}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <CustomButton
            title="Registrarme en SmartGym"
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 16 }}
          />

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>¿Ya tienes una cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
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
    padding: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
  },
  sectionHeader: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
