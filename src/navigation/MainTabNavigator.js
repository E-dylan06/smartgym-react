import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Pantallas Comunes y Clientes
import HomeScreen from '../screens/home/HomeScreen';
import ClasesScreen from '../screens/clases/ClasesScreen';
import DetalleClaseScreen from '../screens/clases/DetalleClaseScreen';
import MisReservasScreen from '../screens/reservas/MisReservasScreen';

// Pantallas de Perfil
import ProfileScreen from '../screens/perfil/ProfileScreen';
import EditProfileScreen from '../screens/perfil/EditProfileScreen';
import UpdatePasswordScreen from '../screens/perfil/UpdatePasswordScreen';
import PreferencesScreen from '../screens/perfil/PreferencesScreen';
import MetricasProgresoScreen from '../screens/perfil/MetricasProgresoScreen';

// Pantallas de Entrenador
import TrainerClasesScreen from '../screens/entrenador/TrainerClasesScreen';
import AlumnosClaseScreen from '../screens/entrenador/AlumnosClaseScreen';

// Pantallas de Administrador y Programación
import AdminUsuariosScreen from '../screens/admin/AdminUsuariosScreen';
import CrearHorarioScreen from '../screens/horarios/CrearHorarioScreen';
import AdminReportesScreen from '../screens/admin/AdminReportesScreen';
import AdminBloqueosScreen from '../screens/admin/AdminBloqueosScreen';
import AdminDisciplinasScreen from '../screens/admin/AdminDisciplinasScreen';

// Pantalla de Notificaciones
import NotificacionesScreen from '../screens/notificaciones/NotificacionesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenDefaultOptions = {
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontWeight: '700',
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background,
  },
};

// Pila de Inicio y Módulos Ejecutivos / Notificaciones
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={screenDefaultOptions}>
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notificaciones"
        component={NotificacionesScreen}
        options={{ title: 'Bandeja de Notificaciones' }}
      />
      <Stack.Screen
        name="AdminReportes"
        component={AdminReportesScreen}
        options={{ title: 'Reportes y Liquidación' }}
      />
      <Stack.Screen
        name="AdminBloqueos"
        component={AdminBloqueosScreen}
        options={{ title: 'Feriados y Cierres' }}
      />
      <Stack.Screen
        name="AdminDisciplinas"
        component={AdminDisciplinasScreen}
        options={{ title: 'Catálogo de Disciplinas' }}
      />
    </Stack.Navigator>
  );
}

// Pila de Clases y Detalle
function ClasesStack() {
  return (
    <Stack.Navigator screenOptions={screenDefaultOptions}>
      <Stack.Screen
        name="ClasesList"
        component={ClasesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetalleClase"
        component={DetalleClaseScreen}
        options={{ title: 'Detalle de la Sesión' }}
      />
      <Stack.Screen
        name="AlumnosClase"
        component={AlumnosClaseScreen}
        options={{ title: 'Asistencia de Alumnos' }}
      />
      <Stack.Screen
        name="CrearHorario"
        component={CrearHorarioScreen}
        options={{ title: 'Programar Clase' }}
      />
    </Stack.Navigator>
  );
}

// Pila de Entrenador (Mis Clases, Alumnos y Asistencias)
function TrainerStack() {
  return (
    <Stack.Navigator screenOptions={screenDefaultOptions}>
      <Stack.Screen
        name="TrainerClasesList"
        component={TrainerClasesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AlumnosClase"
        component={AlumnosClaseScreen}
        options={{ title: 'Asistencia de Alumnos' }}
      />
      <Stack.Screen
        name="CrearHorario"
        component={CrearHorarioScreen}
        options={{ title: 'Programar Nueva Clase' }}
      />
      <Stack.Screen
        name="Notificaciones"
        component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }}
      />
    </Stack.Navigator>
  );
}

// Pila de Perfil y Ajustes
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenDefaultOptions}>
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Mi Perfil' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Editar Datos' }}
      />
      <Stack.Screen
        name="UpdatePassword"
        component={UpdatePasswordScreen}
        options={{ title: 'Seguridad' }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{ title: 'Preferencias' }}
      />
      <Stack.Screen
        name="MetricasProgreso"
        component={MetricasProgresoScreen}
        options={{ title: 'Progreso y Métricas' }}
      />
      <Stack.Screen
        name="Notificaciones"
        component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  const { user } = useAuth();
  const userRole = (user?.rol_nombre || user?.rol || 'cliente').toLowerCase();
  const isAdmin = userRole === 'administrador';
  const isTrainer = userRole === 'entrenador';

  const tabNavigatorScreenOptions = ({ route }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.tabBarBg,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 8,
      paddingTop: 8,
    },
    tabBarActiveTintColor: colors.tabBarActive,
    tabBarInactiveTintColor: colors.tabBarInactive,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '700',
    },
    tabBarIcon: ({ focused, color }) => {
      let iconName;

      switch (route.name) {
        case 'InicioTab':
          iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          break;
        case 'TrainerClasesTab':
          iconName = focused ? 'fitness' : 'fitness-outline';
          break;
        case 'UsuariosTab':
          iconName = focused ? 'people' : 'people-outline';
          break;
        case 'ProgramarTab':
          iconName = focused ? 'add-circle' : 'add-circle-outline';
          break;
        case 'ClasesTab':
          iconName = focused ? 'barbell' : 'barbell-outline';
          break;
        case 'ReservasTab':
          iconName = focused ? 'calendar' : 'calendar-outline';
          break;
        case 'PerfilTab':
          iconName = focused ? 'person' : 'person-outline';
          break;
        default:
          iconName = 'apps-outline';
      }

      return <Ionicons name={iconName} size={22} color={color} />;
    },
  });

  // VISTA 1: ADMINISTRADOR / DUEÑO
  if (isAdmin) {
    return (
      <Tab.Navigator screenOptions={tabNavigatorScreenOptions}>
        <Tab.Screen
          name="InicioTab"
          component={HomeStack}
          options={{ tabBarLabel: 'Dashboard' }}
        />
        <Tab.Screen
          name="UsuariosTab"
          component={AdminUsuariosScreen}
          options={{ tabBarLabel: 'Usuarios' }}
        />
        <Tab.Screen
          name="ProgramarTab"
          component={CrearHorarioScreen}
          options={{ tabBarLabel: 'Programar' }}
        />
        <Tab.Screen
          name="ClasesTab"
          component={ClasesStack}
          options={{ tabBarLabel: 'Clases' }}
        />
        <Tab.Screen
          name="PerfilTab"
          component={ProfileStack}
          options={{ tabBarLabel: 'Perfil' }}
        />
      </Tab.Navigator>
    );
  }

  // VISTA 2: ENTRENADOR / COACH
  if (isTrainer) {
    return (
      <Tab.Navigator screenOptions={tabNavigatorScreenOptions}>
        <Tab.Screen
          name="TrainerClasesTab"
          component={TrainerStack}
          options={{ tabBarLabel: 'Mis Clases' }}
        />
        <Tab.Screen
          name="ProgramarTab"
          component={CrearHorarioScreen}
          options={{ tabBarLabel: 'Programar' }}
        />
        <Tab.Screen
          name="ClasesTab"
          component={ClasesStack}
          options={{ tabBarLabel: 'Explorar' }}
        />
        <Tab.Screen
          name="PerfilTab"
          component={ProfileStack}
          options={{ tabBarLabel: 'Perfil' }}
        />
      </Tab.Navigator>
    );
  }

  // VISTA 3: CLIENTE / SOCIO
  return (
    <Tab.Navigator screenOptions={tabNavigatorScreenOptions}>
      <Tab.Screen
        name="InicioTab"
        component={HomeStack}
        options={{ tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="ClasesTab"
        component={ClasesStack}
        options={{ tabBarLabel: 'Clases' }}
      />
      <Tab.Screen
        name="ReservasTab"
        component={MisReservasScreen}
        options={{ tabBarLabel: 'Reservas' }}
      />
      <Tab.Screen
        name="PerfilTab"
        component={ProfileStack}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}
