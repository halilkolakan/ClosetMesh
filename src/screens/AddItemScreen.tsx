import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Image as ImageIcon, PlusCircle, Sparkles } from 'lucide-react-native';
import { analyzeClothingImage } from '../api/gemini';
import { addClothingItem, uploadClothingImage } from '../api/wardrobe';
import { useAuth } from '../context/AuthContext';
import type { RootTabParamList } from '../navigation/types';
import type { AIExtractedAttributes, ClothingCategory, Season, StyleVibe } from '../types';

type Props = BottomTabScreenProps<RootTabParamList, 'AddItem'>;

const colors = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  ink: '#1C211B',
  muted: '#85877F',
  line: '#E8E8E1',
  accent: '#D5F277',
  dark: '#252B24',
  lavender: '#EAE5FB',
  danger: '#C74B42',
};

const categories: { label: string; value: ClothingCategory }[] = [
  { label: 'Üst giyim', value: 'ust_giyim' },
  { label: 'Alt giyim', value: 'alt_giyim' },
  { label: 'Ayakkabı', value: 'ayakkabi' },
  { label: 'Aksesuar', value: 'aksesuar' },
];
const seasons: { label: string; value: Season }[] = [
  { label: 'İlkbahar', value: 'ilkbahar' },
  { label: 'Yaz', value: 'yaz' },
  { label: 'Sonbahar', value: 'sonbahar' },
  { label: 'Kış', value: 'kis' },
  { label: 'Tüm mevsimler', value: 'tum_mevsimler' },
];
const vibes: { label: string; value: StyleVibe }[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Smart casual', value: 'smart_casual' },
  { label: 'Streetwear', value: 'streetwear' },
  { label: 'Formal', value: 'formal' },
  { label: 'Sport', value: 'sport' },
];

const initialAttributes: AIExtractedAttributes = {
  category: 'ust_giyim',
  subcategory: '',
  color: '',
  seasons: ['tum_mevsimler'],
  vibe: 'casual',
};

const fallbackAttributes: AIExtractedAttributes = {
  category: 'ust_giyim',
  subcategory: 'Kıyafet',
  color: 'Belirtilmedi',
  seasons: ['tum_mevsimler'],
  vibe: 'casual',
};

export default function AddItemScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<AIExtractedAttributes>(initialAttributes);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const selectImage = useCallback(async (source: 'camera' | 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'İzin gerekli',
          source === 'camera'
            ? 'Fotoğraf çekebilmek için kamera izni vermen gerekiyor.'
            : 'Fotoğraf seçebilmek için galeri izni vermen gerekiyor.',
        );
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
          });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
        setAttributes(initialAttributes);
        setNotice('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Görsel seçilemedi.';
      Alert.alert('Görsel açılamadı', message);
    }
  }, []);

  const analyzeImage = useCallback(async () => {
    if (!imageUri) {
      return;
    }
    setAnalyzing(true);
    setNotice('');
    try {
      const result = await analyzeClothingImage(imageUri);
      setAttributes(result);
      const isFallbackResult =
        result.category === fallbackAttributes.category &&
        result.subcategory === fallbackAttributes.subcategory &&
        result.color === fallbackAttributes.color &&
        result.vibe === fallbackAttributes.vibe &&
        result.seasons.length === 1 &&
        result.seasons[0] === 'tum_mevsimler';
      if (isFallbackResult) {
        setNotice('Yapay zekâ servisi anlık yoğun; etiketleri kontrol edip doğrudan kaydedebilirsiniz.');
        Alert.alert(
          'Analiz şu an kullanılamıyor',
          'Yapay zekâ servisi anlık yoğun; etiketleri kontrol edip doğrudan kaydedebilirsiniz.',
        );
      } else {
        setNotice('Analiz tamamlandı. Bilgileri istersen düzenleyebilirsin.');
      }
    } catch (error) {
      setAttributes(fallbackAttributes);
      setNotice('Yapay zekâ servisi anlık yoğun; etiketleri kontrol edip doğrudan kaydedebilirsiniz.');
      console.warn(
        '[add-item] AI analizi başarısız; düzenlenebilir varsayılan etiketlerle devam ediliyor:',
        error instanceof Error ? error.message : String(error),
      );
      Alert.alert(
        'Analiz şu an kullanılamıyor',
        'Yapay zekâ servisi anlık yoğun; etiketleri kontrol edip doğrudan kaydedebilirsiniz.',
      );
    } finally {
      setAnalyzing(false);
    }
  }, [imageUri]);

  const toggleSeason = useCallback((season: Season) => {
    setAttributes((current) => {
      const selected = current.seasons.includes(season);
      if (season === 'tum_mevsimler') {
        return { ...current, seasons: selected ? [] : ['tum_mevsimler'] };
      }
      const next = current.seasons.filter((entry) => entry !== 'tum_mevsimler');
      return {
        ...current,
        seasons: selected ? next.filter((entry) => entry !== season) : [...next, season],
      };
    });
  }, []);

  const saveItem = useCallback(async () => {
    if (!imageUri) {
      Alert.alert('Görsel ekle', 'Gardıroba kaydetmeden önce bir kıyafet görseli seç.');
      return;
    }
    if (!attributes.subcategory.trim() || !attributes.color.trim() || attributes.seasons.length === 0) {
      Alert.alert('Bilgileri tamamla', 'Alt kategori, renk ve en az bir mevsim seçmelisin.');
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadClothingImage(imageUri, user.id);
      const savedItem = await addClothingItem({
        ...attributes,
        subcategory: attributes.subcategory.trim(),
        color: attributes.color.trim(),
        user_id: user.id,
        image_url: imageUrl,
      });
      setImageUri(null);
      setAttributes(initialAttributes);
      setNotice('');
      const isTemporaryGuestItem = savedItem.user_id === 'local-guest';
      Alert.alert(
        isTemporaryGuestItem ? 'Bu cihazda geçici olarak kaydedildi' : 'Gardırobuna eklendi',
        isTemporaryGuestItem
          ? 'Supabase oturumu yok; parça uygulama açık kaldığı sürece bu cihazda görünür.'
          : 'Yeni parçan artık kombinlerinde kullanılabilir.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('Wardrobe') }],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Parça kaydedilemedi.';
      Alert.alert('Kaydedilemedi', message);
    } finally {
      setSaving(false);
    }
  }, [attributes, imageUri, navigation, user.id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <View style={styles.brandMark}><PlusCircle size={18} stroke={colors.ink} /></View>
          <Text style={styles.eyebrow}>YENİ PARÇA</Text>
        </View>
        <Text style={styles.title}>Gardırobuna ekle</Text>
        <Text style={styles.subtitle}>Bir fotoğraf seç, stil detaylarını birlikte tamamlayalım.</Text>

        <View style={styles.photoCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <View style={styles.photoIcon}><ImageIcon size={28} stroke={colors.ink} /></View>
              <Text style={styles.photoTitle}>Parçanın fotoğrafı</Text>
              <Text style={styles.photoCaption}>Daha iyi analiz için sade bir arka plan seç.</Text>
            </View>
          )}
        </View>

        <View style={styles.sourceRow}>
          <Pressable style={styles.sourceButton} onPress={() => void selectImage('camera')}>
            <Camera size={17} stroke={colors.ink} />
            <Text style={styles.sourceText}>Kamerayla çek</Text>
          </Pressable>
          <Pressable style={styles.sourceButton} onPress={() => void selectImage('library')}>
            <ImageIcon size={17} stroke={colors.ink} />
            <Text style={styles.sourceText}>Galeriden seç</Text>
          </Pressable>
        </View>

        {imageUri && (
          <Pressable
            disabled={analyzing}
            style={[styles.aiButton, analyzing && styles.disabledButton]}
            onPress={() => void analyzeImage()}
          >
            {analyzing ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Sparkles size={18} stroke={colors.ink} />
            )}
            <Text style={styles.aiButtonText}>
              {analyzing ? 'Parçan inceleniyor...' : 'AI ile tara ve analiz et'}
            </Text>
          </Pressable>
        )}
        {notice.length > 0 && <Text style={styles.notice}>{notice}</Text>}

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Parça detayları</Text>
          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipWrap}>
            {categories.map((category) => {
              const selected = attributes.category === category.value;
              return (
                <Pressable
                  key={category.value}
                  onPress={() => setAttributes((current) => ({ ...current, category: category.value }))}
                  style={[styles.chip, selected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, selected && styles.selectedChipText]}>{category.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Alt kategori</Text>
          <TextInput
            value={attributes.subcategory}
            onChangeText={(subcategory) => setAttributes((current) => ({ ...current, subcategory }))}
            placeholder="Örn. Oversize hoodie"
            placeholderTextColor="#A6A79F"
            style={styles.input}
            accessibilityLabel="Alt kategori"
          />
          <Text style={styles.label}>Renk</Text>
          <TextInput
            value={attributes.color}
            onChangeText={(color) => setAttributes((current) => ({ ...current, color }))}
            placeholder="Örn. Füme"
            placeholderTextColor="#A6A79F"
            style={styles.input}
            accessibilityLabel="Renk"
          />

          <Text style={styles.label}>Mevsim</Text>
          <View style={styles.chipWrap}>
            {seasons.map((season) => {
              const selected = attributes.seasons.includes(season.value);
              return (
                <Pressable
                  key={season.value}
                  onPress={() => toggleSeason(season.value)}
                  style={[styles.chip, selected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, selected && styles.selectedChipText]}>{season.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Stil</Text>
          <View style={styles.chipWrap}>
            {vibes.map((vibe) => {
              const selected = attributes.vibe === vibe.value;
              return (
                <Pressable
                  key={vibe.value}
                  onPress={() => setAttributes((current) => ({ ...current, vibe: vibe.value }))}
                  style={[styles.chip, selected && styles.selectedChip]}
                >
                  <Text style={[styles.chipText, selected && styles.selectedChipText]}>{vibe.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          disabled={saving}
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={() => void saveItem()}
        >
          {saving ? <ActivityIndicator color={colors.surface} /> : <Check size={18} stroke={colors.surface} />}
          <Text style={styles.saveButtonText}>{saving ? 'Gardırobuna kaydediliyor...' : 'Gardıroba kaydet'}</Text>
        </Pressable>
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
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 20 },
  photoCard: { height: 250, overflow: 'hidden', borderRadius: 25, backgroundColor: '#E9E9E1' },
  preview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  photoIcon: {
    width: 58, height: 58, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  photoTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  photoCaption: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  sourceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sourceButton: {
    flex: 1, height: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sourceText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  aiButton: {
    height: 52, borderRadius: 17, backgroundColor: colors.lavender, marginTop: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
  },
  aiButtonText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.65 },
  notice: { color: '#526D24', fontSize: 12, marginTop: 9, marginLeft: 3 },
  formCard: {
    backgroundColor: colors.surface, borderRadius: 23, padding: 17, marginTop: 20,
    borderWidth: 1, borderColor: colors.line,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginBottom: 18 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 9, marginTop: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  selectedChip: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  selectedChipText: { color: colors.surface },
  input: {
    height: 48, borderRadius: 13, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.background, paddingHorizontal: 13, color: colors.ink, fontSize: 13,
  },
  saveButton: {
    height: 55, borderRadius: 17, backgroundColor: colors.dark, marginTop: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
  },
  saveButtonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
});
