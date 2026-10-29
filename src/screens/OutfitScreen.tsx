import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Check, CloudSun, Shirt, Sparkles } from 'lucide-react-native';
import { generateOutfitMesh } from '../api/gemini';
import { getWardrobeItems } from '../api/wardrobe';
import { getLiveWeather } from '../api/weather';
import { useAuth } from '../context/AuthContext';
import type { RootTabParamList } from '../navigation/types';
import type { ClothingCategory, ClothingItem, OutfitRecommendation, StyleVibe, WeatherCondition } from '../types';

type Props = BottomTabScreenProps<RootTabParamList, 'Outfit'>;

const colors = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  ink: '#1C211B',
  muted: '#85877F',
  line: '#E8E8E1',
  accent: '#D5F277',
  dark: '#252B24',
  lavender: '#EAE5FB',
  orange: '#FAE4CC',
};

const vibes: { label: string; value: StyleVibe }[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Smart casual', value: 'smart_casual' },
  { label: 'Streetwear', value: 'streetwear' },
  { label: 'Formal', value: 'formal' },
  { label: 'Sport', value: 'sport' },
];

const categoryLabels: Record<ClothingCategory, string> = {
  ust_giyim: 'Üst giyim',
  alt_giyim: 'Alt giyim',
  ayakkabi: 'Ayakkabı',
  aksesuar: 'Aksesuar',
};

const FALLBACK_STYLIST_NOTE =
  'AI yoğunluğu nedeniyle gardırobunuzdan en uyumlu parçalar eşleştirildi.';

function isTransientAiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b503\b|service unavailable|temporarily unavailable|overloaded|high demand|network|fetch failed|connection|timed? out|timeout|econnreset|enotfound/i.test(
    message,
  );
}

function createWardrobeFallback(
  wardrobe: ClothingItem[],
  vibe: StyleVibe,
): OutfitRecommendation | null {
  const categories: ClothingCategory[] = ['ust_giyim', 'alt_giyim', 'ayakkabi'];
  const items = categories.flatMap((category) => {
    const options = wardrobe.filter((item) => item.category === category);
    if (options.length === 0) {
      return [];
    }
    return [options[Math.floor(Math.random() * options.length)]];
  });

  if (items.length === 0) {
    return null;
  }

  return {
    items,
    stylistNote: FALLBACK_STYLIST_NOTE,
    vibe,
    matchScore: 80,
  };
}

export default function OutfitScreen(_props: Props) {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState('');
  const [preferredVibe, setPreferredVibe] = useState<StyleVibe>('casual');
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError('');
    try {
      setWeather(await getLiveWeather());
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : 'Hava durumu alınamadı.');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getLiveWeather()
      .then((currentWeather) => {
        if (active) {
          setWeather(currentWeather);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setWeatherError(error instanceof Error ? error.message : 'Hava durumu alınamadı.');
        }
      })
      .finally(() => {
        if (active) {
          setWeatherLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const generate = useCallback(async () => {
    if (!weather) {
      Alert.alert('Hava durumu gerekli', 'Kombin oluşturmak için önce hava durumunu yükle.');
      return;
    }

    setGenerating(true);
    try {
      const wardrobe = await getWardrobeItems(user.id);
      if (wardrobe.length === 0) {
        Alert.alert('Dolabın henüz boş', 'Önce gardırobuna birkaç parça ekle.');
        return;
      }

      try {
        const outfit = await generateOutfitMesh(wardrobe, weather, preferredVibe);
        setRecommendation(outfit);
      } catch (error) {
        if (!isTransientAiError(error)) {
          throw error;
        }

        const fallback = createWardrobeFallback(wardrobe, preferredVibe);
        if (!fallback) {
          throw new Error('Gardıropta kombin oluşturabilecek bir parça bulunamadı.');
        }
        console.warn(
          '[outfit] AI geçici olarak kullanılamıyor; gardırop parçalarından yerel kombin oluşturuldu:',
          error instanceof Error ? error.message : String(error),
        );
        setRecommendation(fallback);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kombin oluşturulamadı.';
      Alert.alert('Kombin oluşturulamadı', message);
    } finally {
      setGenerating(false);
    }
  }, [preferredVibe, user.id, weather]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <View style={styles.brandMark}><Sparkles size={18} stroke={colors.ink} /></View>
          <Text style={styles.eyebrow}>TODAY’S MESH</Text>
        </View>
        <Text style={styles.title}>Bugünün kombini</Text>
        <Text style={styles.subtitle}>Hava durumuna ve ruh haline göre, sana özel.</Text>

        <View style={styles.weatherCard}>
          <View style={styles.weatherIcon}><CloudSun size={23} stroke={colors.ink} /></View>
          <View style={styles.weatherCopy}>
            <Text style={styles.weatherLabel}>BUGÜNÜN HAVASI</Text>
            {weatherLoading ? (
              <View style={styles.weatherLoading}>
                <ActivityIndicator size="small" color={colors.ink} />
                <Text style={styles.weatherCondition}>Hava durumu alınıyor...</Text>
              </View>
            ) : weather ? (
              <>
                <Text style={styles.weatherCondition}>{weather.temperature}°C · {weather.condition}</Text>
                <Text style={styles.weatherPlace}>
                  {weather.locationLabel ?? 'Canlı konumundan alındı'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.weatherCondition}>Hava durumu kullanılamıyor</Text>
                <Text style={styles.weatherPlace}>{weatherError}</Text>
              </>
            )}
          </View>
          {!weatherLoading && !weather && (
            <Pressable onPress={() => void loadWeather()} style={styles.retryButton}>
              <Text style={styles.retryText}>Yenile</Text>
            </Pressable>
          )}
          {weather?.isRainy && <Text style={styles.rainTag}>YAĞIŞ VAR</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bugün hangi tarz?</Text>
          <Text style={styles.optional}>BİRİNİ SEÇ</Text>
        </View>
        <View style={styles.vibeGrid}>
          {vibes.map((vibe) => {
            const active = preferredVibe === vibe.value;
            return (
              <Pressable
                key={vibe.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPreferredVibe(vibe.value)}
                style={[styles.vibePill, active && styles.vibePillActive]}
              >
                {active && <Check size={13} stroke={colors.accent} />}
                <Text style={[styles.vibeText, active && styles.vibeTextActive]}>{vibe.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={generating || weatherLoading}
          style={[styles.generateButton, (generating || weatherLoading) && styles.disabledButton]}
          onPress={() => void generate()}
        >
          {generating ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Sparkles size={19} stroke={colors.ink} />
          )}
          <Text style={styles.generateText}>{generating ? 'Mesh hazırlanıyor...' : 'Kombinimi oluştur'}</Text>
        </Pressable>

        {recommendation ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTop}>
              <View>
                <Text style={styles.resultEyebrow}>SANA ÖZEL EŞLEŞME</Text>
                <Text style={styles.resultTitle}>Bugünün mesh’i</Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.score}>{recommendation.matchScore}%</Text>
                <Text style={styles.scoreCaption}>UYUM</Text>
              </View>
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.quoteMark}>“</Text>
              <Text style={styles.stylistNote}>{recommendation.stylistNote}</Text>
              <Text style={styles.stylistLabel}>AI STİLİSTİN</Text>
            </View>
            <View style={styles.outfitItems}>
              {recommendation.items.map((item) => (
                <View key={item.id} style={styles.outfitItem}>
                  <Image source={{ uri: item.image_url }} style={styles.outfitImage} resizeMode="cover" />
                  <Text style={styles.outfitCategory}>{categoryLabels[item.category]}</Text>
                  <Text style={styles.outfitName} numberOfLines={1}>{item.subcategory}</Text>
                </View>
              ))}
            </View>
            <View style={styles.outfitVibe}>
              <Shirt size={14} stroke={colors.ink} />
              <Text style={styles.outfitVibeText}>{vibes.find((vibe) => vibe.value === recommendation.vibe)?.label}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.hintCard}>
            <View style={styles.hintIcon}><Sparkles size={19} stroke={colors.ink} /></View>
            <View style={styles.hintCopy}>
              <Text style={styles.hintTitle}>İyi stil, doğru eşleşme.</Text>
              <Text style={styles.hintText}>Dolabındaki parçalar hava durumuyla buluşunca mesh’in burada.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  topline: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  brandMark: {
    width: 32, height: 32, borderRadius: 11, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '700', letterSpacing: -1, marginTop: 16 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 19 },
  weatherCard: {
    minHeight: 92, borderRadius: 22, backgroundColor: colors.accent, padding: 15,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  weatherIcon: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF80',
    alignItems: 'center', justifyContent: 'center',
  },
  weatherCopy: { flex: 1 },
  weatherLabel: { color: '#525D3B', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  weatherLoading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  weatherCondition: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 4 },
  weatherPlace: { color: '#64704D', fontSize: 10, marginTop: 3 },
  retryButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFFFFF90' },
  retryText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  rainTag: { color: colors.ink, fontSize: 8, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  optional: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibePill: {
    minHeight: 41, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center', flexDirection: 'row', gap: 6,
  },
  vibePillActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  vibeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  vibeTextActive: { color: colors.surface },
  generateButton: {
    height: 56, borderRadius: 18, backgroundColor: colors.accent, marginTop: 21,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
  },
  generateText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  hintCard: {
    backgroundColor: colors.surface, borderRadius: 21, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  hintIcon: {
    width: 42, height: 42, borderRadius: 15, backgroundColor: colors.lavender,
    alignItems: 'center', justifyContent: 'center',
  },
  hintCopy: { flex: 1 },
  hintTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  hintText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 16, marginTop: 18,
    borderWidth: 1, borderColor: colors.line,
  },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  resultTitle: { color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 5 },
  scoreBadge: {
    width: 64, height: 64, borderRadius: 21, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  score: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  scoreCaption: { color: colors.ink, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  noteCard: { backgroundColor: '#F5F4F0', borderRadius: 17, padding: 14, marginTop: 15 },
  quoteMark: { color: '#9AA981', fontSize: 33, lineHeight: 32, fontWeight: '800' },
  stylistNote: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '500', marginTop: 3 },
  stylistLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 10 },
  outfitItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  outfitItem: { width: '31%', flexGrow: 1 },
  outfitImage: { width: '100%', aspectRatio: 0.82, borderRadius: 14, backgroundColor: '#ECECE5' },
  outfitCategory: { color: colors.muted, fontSize: 9, marginTop: 7 },
  outfitName: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 3 },
  outfitVibe: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginTop: 14 },
  outfitVibeText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
});
