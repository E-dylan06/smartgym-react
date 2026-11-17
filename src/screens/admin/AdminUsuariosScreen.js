import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Card from '../../components/Card';
import api from '../../config/api';

export default function AdminUsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('todos'); // 'todos' | 'cliente' | 'entrenador' | 'administrador'
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modal para cambio de rol
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRoleSelection, setNewRoleSelection] = useState('cliente');

  const fetchUsuarios = async () => {
    try {
      const res = await api.get('/admin/usuarios');
      if (res.data.ok) {
        setUsuarios(res.data.data.usuarios || []);
      }
    } catch (err) {
      console.warn('Error al cargar usuarios:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsuarios();
  };

  // Cambiar rol de usuario
  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRoleSelection(user.rol_nombre || user.rol || 'cliente');
    setRoleModalVisible(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUser) return;
    try {
      setActionLoadingId(selectedUser.id_usuario);
      setRoleModalVisible(false);

      const res = await api.put(`/admin/usuarios/${selectedUser.id_usuario}/rol`, {
        nuevo_rol: newRoleSelection,
      });

      if (res.data.ok) {
        Alert.alert(
          'Rol Actualizado',
          `El usuario ${selectedUser.nombre} ahora tiene el rol de '${newRoleSelection}'.`
        );
        // Actualizar localmente
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id_usuario === selectedUser.id_usuario
              ? { ...u, rol: newRoleSelection, rol_nombre: newRoleSelection }
              : u
          )
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al actualizar rol';
      Alert.alert('Error', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Alternar estado activo / inactivo
  const handleToggleEstado = (user) => {
    const nuevoEstado = !Boolean(user.activo);
    const accion = nuevoEstado ? 'activar' : 'desactivar';

    Alert.alert(
      `¿Deseas ${accion} la cuenta?`,
      `El usuario "${user.nombre}" ${nuevoEstado ? 'podrá' : 'ya no podrá'} iniciar sesión en la aplicación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Sí, ${accion}`,
          style: nuevoEstado ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActionLoadingId(user.id_usuario);
              const res = await api.put(`/admin/usuarios/${user.id_usuario}/estado`, {
                activo: nuevoEstado ? 1 : 0,
              });

              if (res.data.ok) {
                setUsuarios((prev) =>
                  prev.map((u) =>
                    u.id_usuario === user.id_usuario
                      ? { ...u, activo: nuevoEstado ? 1 : 0 }
                      : u
                  )
                );
              }
            } catch (err) {
              const msg = err.response?.data?.message || err.message || 'Error al cambiar estado';
              Alert.alert('Error', msg);
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  // Filtrado
  const usuariosFiltrados = usuarios.filter((u) => {
    // Filtro por rol
    const userRol = (u.rol_nombre || u.rol || 'cliente').toLowerCase();
    if (filterRole !== 'todos' && userRol !== filterRole) {
      return false;
    }

    // Filtro por búsqueda
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.nombre?.toLowerCase().includes(q) ||
      u.correo?.toLowerCase().includes(q) ||
      u.dni?.toLowerCase().includes(q)
    );
  });

  const renderBadgeRol = (rol) => {
    const r = (rol || '').toLowerCase();
    if (r === 'administrador') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Ionicons name="shield-checkmark" size={11} color="#F59E0B" style={{ marginRight: 3 }} />
          <Text style={[styles.roleText, { color: '#F59E0B' }]}>ADMIN</Text>
        </View>
      );
    }
    if (r === 'entrenador') {
      return (
        <View style={[styles.roleBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Ionicons name="fitness" size={11} color="#60A5FA" style={{ marginRight: 3 }} />
          <Text style={[styles.roleText, { color: '#60A5FA' }]}>COACH</Text>
        </View>
      );
    }
    return (
      <View style={[styles.roleBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
        <Ionicons name="person" size={11} color={colors.secondary} style={{ marginRight: 3 }} />
        <Text style={[styles.roleText, { color: colors.secondary }]}>SOCIO</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const isActivo = item.activo?.data
      ? item.activo.data[0] === 1
      : (item.activo === 1 || item.activo === true || item.activo === '1');
    const isProcessing = actionLoadingId === item.id_usuario;
    const userRole = (item.rol_nombre || item.rol || 'cliente').toLowerCase();

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.nombre ? item.nombre.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>

          {/* Info básica */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>{item.nombre}</Text>
            </View>
            <Text style={styles.userEmail}>{item.correo}</Text>
            <Text style={styles.userMeta}>
              DNI: {item.dni || 'Sin DNI'} • Tel: {item.telefono || 'Sin tel.'}
            </Text>
          </View>

          {/* Badges */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {renderBadgeRol(userRole)}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActivo ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isActivo ? colors.secondary : colors.danger },
                ]}
              >
                {isActivo ? 'ACTIVO' : 'INACTIVO'}
              </Text>
            </View>
          </View>
        </View>

        {/* Acciones de Administración */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            disabled={isProcessing}
            onPress={() => openRoleModal(item)}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnSecondaryText}>Cambiar Rol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtnOutline,
              { borderColor: isActivo ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)' },
            ]}
            disabled={isProcessing}
            onPress={() => handleToggleEstado(item)}
          >
            <Ionicons
              name={isActivo ? 'power' : 'checkmark-circle-outline'}
              size={14}
              color={isActivo ? colors.danger : colors.secondary}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.actionBtnOutlineText,
                { color: isActivo ? colors.danger : colors.secondary },
              ]}
            >
              {isActivo ? 'Desactivar' : 'Activar'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tagRow}>
          <Ionicons name="people" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={styles.tagText}>ADMINISTRACIÓN DE ACCESOS</Text>
        </View>
        <Text style={styles.title}>Usuarios y Roles</Text>
        <Text style={styles.subtitle}>
          Control de membresías, permisos y ascenso de socios a entrenadores
        </Text>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, correo o DNI..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros por Rol */}
      <View style={styles.filtersRow}>
        {['todos', 'cliente', 'entrenador', 'administrador'].map((r) => {
          const isSelected = filterRole === r;
          const label =
            r === 'todos'
              ? 'Todos'
              : r === 'cliente'
              ? 'Socios'
              : r === 'entrenador'
              ? 'Coaches'
              : 'Admins';
          return (
            <TouchableOpacity
              key={r}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setFilterRole(r)}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista de Usuarios */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando usuarios...</Text>
        </View>
      ) : (
        <FlatList
          data={usuariosFiltrados}
          keyExtractor={(item) => item.id_usuario.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-remove-outline" size={48} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No se encontraron usuarios</Text>
              <Text style={styles.emptySubtitle}>Intenta con otro término o filtro de rol.</Text>
            </View>
          }
        />
      )}

      {/* MODAL PARA CAMBIO DE ROL */}
      <Modal
        visible={roleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cambiar Rol de Usuario</Text>
            <Text style={styles.modalDesc}>
              Selecciona el nuevo perfil de permisos para{' '}
              <Text style={{ fontWeight: '800', color: colors.textPrimary }}>
                {selectedUser?.nombre}
              </Text>
              .
            </Text>

            <View style={{ gap: 8, marginVertical: 14 }}>
              {[
                { id: 'cliente', label: 'Socio / Cliente', desc: 'Reserva clases y asiste a entrenamientos' },
                { id: 'entrenador', label: 'Entrenador / Coach', desc: 'Imparte clases, toma asistencia y programa sesiones' },
                { id: 'administrador', label: 'Administrador / Dueño', desc: 'Control total de KPIs, roles y finanzas' },
              ].map((r) => {
                const isSelected = newRoleSelection === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
                    onPress={() => setNewRoleSelection(r.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleOptionTitle, isSelected && { color: colors.primary }]}>
                        {r.label}
                      </Text>
                      <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRoleModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmRoleChange}
              >
                <Text style={styles.modalConfirmBtnText}>Guardar Cambio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  card: {
    marginVertical: 6,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  userMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 7,
  },
  actionBtnSecondaryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 87, 34, 0.08)',
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roleOptionDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  modalConfirmBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
