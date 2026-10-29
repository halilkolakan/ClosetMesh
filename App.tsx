import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlusCircle, Shirt, Sparkles } from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import { createLocalGuestUser, signInAnonymously, getCurrentUser } from './src/api/auth';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import type { RootTabParamList } from './src/navigation/types';
import AddItemScreen from './src/screens/AddItemScreen';
import OutfitScreen from './src/screens/OutfitScreen';
import WardrobeScreen from './src/screens/WardrobeScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const colors = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  ink: '#1C211B',
  muted: '#85877F',
  line: '#E8E8E1',
  accent: '#D5F277',
  dark: '#252B24',
};

const SESSION_TIMEOUT_MS = 8_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Supabase yanıt vermedi; yerel misafir oturumu kullanılacak.')),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const startGuestSession = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await withTimeout(getCurrentUser(), SESSION_TIMEOUT_MS);
      if (currentUser) {
        setUser(currentUser);
        return;
      }

      const guest = await withTimeout(signInAnonymously(), SESSION_TIMEOUT_MS);
      setUser(guest);
    } catch (error) {
      console.warn(
        '[app] Sunucu oturumu başlatılamadı; yerel misafir oturumu açılıyor:',
        error instanceof Error ? error.message : String(error),
      );
      setUser(createLocalGuestUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void startGuestSession();
  }, [startGuestSession]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {loading ? (
        <View style={styles.startup}>
          <View style={styles.startupMark}><Sparkles size={24} stroke={colors.ink} /></View>
          <ActivityIndicator size="small" color={colors.ink} />
          <Text style={styles.startupText}>Kendi stil alanın hazırlanıyor...</Text>
        </View>
      ) : user ? (
        <AuthProvider initialUser={user}>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.ink,
                tabBarInactiveTintColor: colors.muted,
                tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
                tabBarStyle: {
                  height: 68,
                  paddingTop: 7,
                  backgroundColor: colors.surface,
                  borderTopColor: colors.line,
                  elevation: 0,
                },
              }}
            >
              <Tab.Screen
                name="Wardrobe"
                component={WardrobeScreen}
                options={{
                  title: 'Dolabım',
                  tabBarIcon: ({ color, size }) => <Shirt stroke={color} size={size} />,
                }}
              />
              <Tab.Screen
                name="Outfit"
                component={OutfitScreen}
                options={{
                  title: 'Kombin',
                  tabBarIcon: ({ color, size }) => <Sparkles stroke={color} size={size} />,
                }}
              />
              <Tab.Screen
                name="AddItem"
                component={AddItemScreen}
                options={{
                  title: 'Ekle',
                  tabBarIcon: ({ color, size }) => <PlusCircle stroke={color} size={size} />,
                }}
              />
            </Tab.Navigator>
          </NavigationContainer>
        </AuthProvider>
      ) : (
        <View style={styles.startup}>
          <View style={styles.startupMark}><Sparkles size={24} stroke={colors.ink} /></View>
          <ActivityIndicator size="small" color={colors.ink} />
          <Text style={styles.startupText}>Yerel misafir oturumu hazırlanıyor...</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  startup: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  startupMark: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  startupText: { color: colors.muted, fontSize: 13, marginTop: 12 },
});
