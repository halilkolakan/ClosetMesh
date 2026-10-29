import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LogOut, RefreshCw, Shirt, Trash2 } from 'lucide-react-native';
import { deleteClothingItem, getWardrobeItems } from '../api/wardrobe';
import { useAuth } from '../context/AuthContext';
import type { RootTabParamList } from '../navigation/types';
import type { ClothingCategory, ClothingItem, StyleVibe } from '../types';

type Props = BottomTabScreenProps<RootTabParamList, 'Wardrobe'>;
type CategoryFilter = ClothingCategory | 'all';

const colors = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  ink: '#1C211B',
  muted: '#85877F',
  line: '#E8E8E1',
  accent: '#D5F277',
  dark: '#252B24',
  danger: '#C74B42',
};

const filters: { label: string; value: CategoryFilter }[] = [
  { label: 'Tümü', value: 'all' },
  { label: 'Üst Giyim', value: 'ust_giyim' },
  { label: 'Alt Giyim', value: 'alt_giyim' },
  { label: 'Ayakkabı', value: 'ayakkabi' },
  { label: 'Aksesuar', value: 'aksesuar' },
];

const vibeLabels: Record<StyleVibe, string> = {
  casual: 'Casual',
  formal: 'Formal',
  smart_casual: 'Smart casual',
  streetwear: 'Streetwear',
  sport: 'Sport',
};

export default function WardrobeScreen({ navigation }: Props) {
  const { user, isLocalGuest, resetGuestSession } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWardrobe = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (isLocalGuest) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const wardrobe = await getWardrobeItems(user.id);
      setItems(wardrobe);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gardırop yüklenemedi.';
      Alert.alert('Bir sorun oluştu', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLocalGuest, user.id]);

  useFocusEffect(
    useCallback(() => {
      void loadWardrobe();
    }, [loadWardrobe]),
  );

  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.category === filter)),
    [filter, items],
  );

  const confirmDelete = useCallback((item: ClothingItem) => {
    Alert.alert('Parçayı sil', `${item.subcategory} gardırobundan kaldırılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteClothingItem(item.id, item.image_url);
              setItems((current) => current.filter((entry) => entry.id !== item.id));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Parça silinemedi.';
              Alert.alert('Silinemedi', message);
            }
          })();
        },
      },
    ]);
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert('Misafir oturumunu yenile', 'Mevcut misafir oturumundan çıkmak istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Oturumu yenile',
        onPress: () => {
          void resetGuestSession().then(
            () => setItems([]),
            (error: unknown) => {
              const message = error instanceof Error ? error.message : 'Oturum kapatılamadı.';
              Alert.alert('Bir sorun oluştu', message);
            },
          );
        },
      },
    ]);
  }, [resetGuestSession]);

  const renderItem = useCallback(({ item }: { item: ClothingItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.subcategory} parçasını sil`}
          style={styles.deleteButton}
          onPress={() => confirmDelete(item)}
        >
          <Trash2 size={16} stroke={colors.danger} />
        </Pressable>
      </View>
      <Text style={styles.itemName} numberOfLines={1}>{item.subcategory}</Text>
      <Text style={styles.itemColor} numberOfLines={1}>{item.color}</Text>
      <View style={styles.vibeBadge}>
        <Text style={styles.vibeText}>{vibeLabels[item.vibe]}</Text>
      </View>
    </View>
  ), [confirmDelete]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWardrobe(true)}
            tintColor={colors.ink}
            colors={[colors.ink]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topline}>
              <View style={styles.brandMark}><Shirt size={18} stroke={colors.ink} /></View>
              <Text style={styles.eyebrow}>CLOSETMESH</Text>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gardırobu yenile"
                  onPress={() => void loadWardrobe(true)}
                  style={styles.iconButton}
                >
                  <RefreshCw size={18} stroke={colors.ink} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Misafir oturumunu yenile"
                  onPress={handleSignOut}
                  style={styles.iconButton}
                >
                  <LogOut size={18} stroke={colors.ink} />
                </Pressable>
              </View>
            </View>
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.title}>Dolabım</Text>
                <Text style={styles.subtitle}>Bugün ne giyeceğine birlikte bakalım.</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>{items.length}</Text>
                <Text style={styles.countLabel}>PARÇA</Text>
              </View>
            </View>
            <FlatList
              horizontal
              data={filters}
              keyExtractor={(item) => item.value}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item: category }) => {
                const active = filter === category.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(category.value)}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.ink} />
              <Text style={styles.emptyCaption}>Gardırobun hazırlanıyor...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Shirt size={28} stroke={colors.ink} /></View>
              <Text style={styles.emptyTitle}>
                {items.length === 0 ? 'Dolabın henüz boş' : 'Burada henüz parça yok'}
              </Text>
              <Text style={styles.emptyCaption}>
                {items.length === 0
                  ? 'İlk parçanı ekle, sana özel kombinler oluşturalım.'
                  : 'Bu kategorideki parçalar burada görünecek.'}
              </Text>
              {items.length === 0 && (
                <Pressable style={styles.emptyAction} onPress={() => navigation.navigate('AddItem')}>
                  <Text style={styles.emptyActionText}>İlk parçanı ekle</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 },
  topline: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 32, height: 32, borderRadius: 11, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  headerActions: { flexDirection: 'row', marginLeft: 'auto', gap: 8 },
  iconButton: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '700', letterSpacing: -1.2 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 5 },
  countBadge: {
    minWidth: 60, height: 60, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  countNumber: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  countLabel: { color: colors.ink, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  filters: { gap: 8, paddingVertical: 22 },
  filterPill: {
    paddingHorizontal: 15, paddingVertical: 10, backgroundColor: colors.surface,
    borderRadius: 30, borderWidth: 1, borderColor: colors.line,
  },
  filterPillActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: colors.surface },
  column: { gap: 12, marginBottom: 14 },
  itemCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 22, padding: 9,
    borderWidth: 1, borderColor: colors.line,
  },
  imageWrap: { position: 'relative', overflow: 'hidden', borderRadius: 16 },
  itemImage: { width: '100%', aspectRatio: 0.88, backgroundColor: '#ECECE5' },
  deleteButton: {
    position: 'absolute', top: 8, right: 8, width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFFE8',
  },
  itemName: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 11, marginHorizontal: 3 },
  itemColor: { color: colors.muted, fontSize: 12, marginTop: 3, marginHorizontal: 3 },
  vibeBadge: {
    alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 9, backgroundColor: '#F2F4EC',
  },
  vibeText: { color: colors.ink, fontSize: 10, fontWeight: '600' },
  loadingState: { flex: 1, minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  emptyCaption: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 7, lineHeight: 19 },
  emptyAction: { paddingHorizontal: 19, paddingVertical: 12, borderRadius: 15, backgroundColor: colors.dark, marginTop: 18 },
  emptyActionText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
});
