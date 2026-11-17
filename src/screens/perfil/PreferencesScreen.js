import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import CustomButton from '../../components/CustomButton';
import api from '../../config/api';
import { useNotification } from '../../context/NotificationContext';

export default function PreferencesScreen({ navigation }) {
  const { requestTestSignalFromBackend } = useNotification();
  const [notifActivas, setNotifActivas] = useState(true);
  const [recordatorio24h, setRecordatorio24h] = useState(true);
  const [recordatorio1h, setRecordatorio1h] = useState(true);
  const [temaOscuro, setTemaOscuro] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleTestNotification = async () => {
    try {
      setSendingTest(true);
      const res = await requestTestSignalFromBackend();
      if (res.ok) {
        Alert.alert(
          '🔔 Señal Enviada',
          'El backend emitió la señal en tiempo real hacia tu dispositivo. En breves instantes verás el banner nativo de SmartGym.'
        );
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar la señal de prueba.');
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const res = await api.get('/perfil/preferencias');
        if (res.data.ok) {
          const p = res.data.data.preferencias;
          setNotifActivas(p.notificaciones_activas ?? true);
          setRecordatorio24h(p.recordatorio_24h ?? true);
          setRecordatorio1h(p.recordatorio_1h ?? true);
          setTemaOscuro(p.tema === 'dark');
        }
      } catch (err) {
        console.warn('Error al cargar preferencias:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/perfil/preferencias', {
        notificaciones_activas: notifActivas,
        recordatorio_24h: recordatorio24h,
        recordatorio_1h: recordatorio1h,
        tema: temaOscuro ? 'dark' : 'light',
      });
      Alert.alert('Preferencias', 'Tus preferencias han sido guardadas correctamente', [
        { text: 'Aceptar', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron guardar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Preferencias de la App</Text>
      <Text style={styles.subtitle}>
        Personaliza recordatorios de clases y visualización de SmartGym
      </Text>

      <Text style={styles.sectionHeader}>Recordatorios y Notificaciones (RF11)</Text>

      <Card>
        <View style={styles.prefRow}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Notificaciones Push</Text>
            <Text style={styles.prefDesc}>Alertas generales del gimnasio y reservas</Text>
          </View>
          <Switch
            value={notifActivas}
            onValueChange={setNotifActivas}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.prefRow}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Recordatorio 24 horas antes</Text>
            <Text style={styles.prefDesc}>Te avisa un día antes de tu sesión programada</Text>
          </View>
          <Switch
            value={recordatorio24h}
            onValueChange={setRecordatorio24h}
            disabled={!notifActivas}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.prefRow}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Recordatorio 1 hora antes</Text>
            <Text style={styles.prefDesc}>Alerta previa para preparar tu entrenamiento</Text>
          </View>
          <Switch
            value={recordatorio1h}
            onValueChange={setRecordatorio1h}
            disabled={!notifActivas}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
          />
        </View>
      </Card>

      <Text style={styles.sectionHeader}>Apariencia</Text>

      <Card>
        <View style={styles.prefRow}>
          <View style={styles.prefInfo}>
            <Text style={styles.prefTitle}>Modo Oscuro Atlético</Text>
            <Text style={styles.prefDesc}>Ahorra batería y resalta el contraste deportivo</Text>
          </View>
          <Switch
            value={temaOscuro}
            onValueChange={setTemaOscuro}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
          />
        </View>
      </Card>

      <Text style={styles.sectionHeader}>Prueba de Notificación en Vivo</Text>
      <Card style={{ marginTop: 4 }}>
        <Text style={styles.prefDesc}>
          Envía una señal real desde el backend Node.js a este teléfono para comprobar el despliegue del banner nativo del sistema operativo.
        </Text>
        <CustomButton
          title={sendingTest ? "Emitiendo señal..." : "🔔 Probar Notificación desde Backend"}
          onPress={handleTestNotification}
          loading={sendingTest}
          variant="outline"
          style={{ marginTop: 14 }}
        />
      </Card>

      <CustomButton
        title="Guardar Preferencias"
        onPress={handleSave}
        loading={saving}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  prefInfo: {
    flex: 1,
    marginRight: 12,
  },
  prefTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  prefDesc: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
});
