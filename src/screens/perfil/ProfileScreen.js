import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import CustomButton from '../../components/CustomButton';
import api, { getFileUrl } from '../../config/api';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUserData } = useAuth();
  const [perfilData, setPerfilData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerfil = async () => {
    try {
      const res = await api.get('/perfil');
      if (res.data.ok) {
        setPerfilData(res.data.data.perfil);
      }
    } catch (err) {
      console.warn('Error al cargar perfil:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerfil();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerfil();
  };

  // Subir foto de perfil usando expo-image-picker (Requerimiento 2.2)
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para cambiar tu foto');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageAsset = result.assets[0];
      await uploadProfilePhoto(imageAsset);
    }
  };

  const uploadProfilePhoto = async (imageAsset) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      const filename = imageAsset.uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('foto', {
        uri: imageAsset.uri,
        name: filename,
        type,
      });

      const res = await api.post('/perfil/foto', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.ok) {
        Alert.alert('¡Foto Actualizada!', 'Tu foto de perfil se actualizó correctamente');
        updateUserData({ foto_url: res.data.data.foto_url });
        fetchPerfil();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al subir imagen';
      Alert.alert('Error al subir foto', msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de SmartGym?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  const p = perfilData || user || {};
  const memb = perfilData?.membresia || {};
  const stats = perfilData?.estadisticas || {};

  const avatarUrl = p.foto_url ? getFileUrl(p.foto_url) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Tarjeta de Avatar y Nombre */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {p.nombre ? p.nombre.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          {uploadingImage && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#FFF" size="small" />
            </View>
          )}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={handlePickImage}
            disabled={uploadingImage}
          >
            <Ionicons name="camera" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.userName}>{p.nombre}</Text>
        <Text style={styles.userEmail}>{p.correo}</Text>
        <View style={styles.roleTag}>
          <Text style={styles.roleText}>
            {(p.rol || 'CLIENTE').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Tarjeta de Membresía */}
      <Card style={styles.membershipCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTitle}>Membresía SmartGym</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  memb.estado === 'activa'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: memb.estado === 'activa' ? colors.secondary : colors.danger,
                },
              ]}
            >
              {memb.estado ? memb.estado.toUpperCase() : 'SIN PLAN'}
            </Text>
          </View>
        </View>

        <Text style={styles.planName}>{memb.nombre || 'Sin membresía'}</Text>
        {memb.dias_restantes > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="time-outline" size={14} color={colors.secondary} style={{ marginRight: 5 }} />
            <Text style={styles.daysRemaining}>
              {memb.dias_restantes} días de membresía restantes
            </Text>
          </View>
        )}
      </Card>

      {/* Estadísticas de Entrenamiento */}
      <View style={styles.statsRow}>
        <Card style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total_reservas || 0}</Text>
          <Text style={styles.statLabel}>Reservas</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.secondary }]}>
            {stats.asistencias_completadas || 0}
          </Text>
          <Text style={styles.statLabel}>Asistencias</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.danger }]}>
            {stats.reservas_canceladas || 0}
          </Text>
          <Text style={styles.statLabel}>Canceladas</Text>
        </Card>
      </View>

      {/* Tarjeta de Acceso a Métricas y Progreso */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MetricasProgreso')}
        style={{ marginVertical: 4 }}
      >
        <Card style={styles.metricasCard}>
          <View style={styles.metricasLeft}>
            <View style={styles.metricasIconBox}>
              <Ionicons name="flame" size={22} color="#FF7A00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricasTitle}>Mi Progreso & Métricas</Text>
              <Text style={styles.metricasSub}>Racha, cálculo de IMC y metas de peso</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      </TouchableOpacity>

      {/* Información Personal y Emergencia */}
      <Card>
        <Text style={styles.sectionTitle}>Datos Personales</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>DNI / Documento:</Text>
          <Text style={styles.infoValue}>{p.dni || 'No registrado'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Teléfono:</Text>
          <Text style={styles.infoValue}>{p.telefono || 'No registrado'}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Contacto de Emergencia</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contacto:</Text>
          <Text style={styles.infoValue}>{p.contacto_emergencia || 'No registrado'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tel. Emergencia:</Text>
          <Text style={styles.infoValue}>{p.telefono_emergencia || 'No registrado'}</Text>
        </View>
      </Card>

      {/* Acciones del perfil */}
      <View style={styles.actionsContainer}>
        <CustomButton
          title="Editar Información Personal"
          onPress={() => navigation.navigate('EditProfile', { perfil: p, onUpdated: fetchPerfil })}
          variant="outline"
        />

        <CustomButton
          title="Actualizar Contraseña"
          onPress={() => navigation.navigate('UpdatePassword')}
          variant="outline"
        />

        <CustomButton
          title="Preferencias de la App"
          onPress={() => navigation.navigate('Preferences')}
          variant="outline"
        />

        <CustomButton
          title="Cerrar Sesión"
          onPress={handleLogout}
          variant="danger"
          style={{ marginTop: 12 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  cameraIcon: {
    fontSize: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  roleTag: {
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 34, 0.3)',
  },
  roleText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  membershipCard: {
    borderColor: 'rgba(255, 87, 34, 0.3)',
    backgroundColor: '#1E2538',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  planName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  daysRemaining: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  actionsContainer: {
    marginTop: 10,
  },
  metricasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF7A00',
    backgroundColor: 'rgba(255, 122, 0, 0.06)',
  },
  metricasLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricasIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 122, 0, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metricasTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  metricasSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
