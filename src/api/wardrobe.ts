import { File } from 'expo-file-system';
import { supabase } from '../config/supabase';
import type { ClothingItem } from '../types';

const WARDROBE_BUCKET = 'wardrobe';
const LOCAL_GUEST_ID = 'local-guest';
const localWardrobeItems: ClothingItem[] = [];
let localItemSequence = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    const code = typeof error.code === 'string' ? ` (${error.code})` : '';
    return `${error.message}${code}`;
  }
  try {
    return JSON.stringify(error) ?? 'Bilinmeyen hata';
  } catch {
    return 'Hata ayrıntıları JSON biçimine dönüştürülemedi.';
  }
}

function isRowLevelSecurityError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  return error.code === '42501' || message.toLowerCase().includes('row-level security');
}

function withRlsGuidance(
  message: string,
  error: unknown,
  resource: 'clothing_items' | 'wardrobe' = 'clothing_items',
): string {
  if (!isRowLevelSecurityError(error)) {
    return message;
  }
  if (resource === 'wardrobe') {
    return `${message} Supabase Storage RLS politikasında wardrobe bucket’ına yükleme izni verin ve ilk klasörün auth.uid() ile eşleşmesini doğrulayın.`;
  }
  return `${message} Supabase RLS politikasında clothing_items.user_id için auth.uid() = user_id koşuluyla INSERT/SELECT izni tanımlayın; anonim oturumlar için de bu politikayı etkinleştirin.`;
}

async function resolveUserId(candidate?: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }

    const authenticatedUserId = data.user?.id;
    if (authenticatedUserId) {
      return authenticatedUserId;
    }
  } catch (error) {
    console.warn(
      '[wardrobe] Aktif Supabase kullanıcısı okunamadı; yerel misafir gardırobu kullanılacak:',
      getErrorMessage(error),
    );
  }

  if (!candidate?.trim() || candidate === LOCAL_GUEST_ID) {
    return LOCAL_GUEST_ID;
  }

  console.warn(
    '[wardrobe] Verilen kullanıcı ID’si için aktif Supabase oturumu yok; güvenlik için yerel misafir gardırobu kullanılacak.',
  );
  return LOCAL_GUEST_ID;
}

function isLocalGuest(userId: string): boolean {
  return userId === LOCAL_GUEST_ID;
}

function createLocalWardrobeItem(
  item: Omit<ClothingItem, 'id' | 'created_at'>,
): ClothingItem {
  const localItem: ClothingItem = {
    ...item,
    user_id: LOCAL_GUEST_ID,
    id: `local-item-${Date.now()}-${localItemSequence++}`,
    created_at: new Date().toISOString(),
  };
  localWardrobeItems.unshift(localItem);
  return localItem;
}

function getStoragePathFromPublicUrl(imageUrl: string): string {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error('Silinecek görsel URL’si geçerli bir URL değil.');
  }

  const publicObjectPrefix = `/storage/v1/object/public/${WARDROBE_BUCKET}/`;
  if (!url.pathname.startsWith(publicObjectPrefix)) {
    throw new Error('Görsel URL’si wardrobe bucket’ındaki bir public dosyayı göstermiyor.');
  }

  const encodedPath = url.pathname.slice(publicObjectPrefix.length);
  const pathSegments = encodedPath.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      throw new Error('Görsel URL’si geçersiz bir depolama yolu içeriyor.');
    }
  });

  if (
    pathSegments.length < 2 ||
    pathSegments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('Görsel URL’si geçerli bir depolama yolu içermiyor.');
  }

  return pathSegments.join('/');
}

export async function uploadClothingImage(
  imageUri: string,
  userId: string,
): Promise<string> {
  try {
    if (!imageUri.trim()) {
      throw new Error('Yüklenecek görsel URI değeri boş olamaz.');
    }
    const resolvedUserId = await resolveUserId(userId);
    if (isLocalGuest(resolvedUserId)) {
      console.warn(
        '[wardrobe] Yerel misafir oturumunda görsel Storage’a yüklenmedi; cihaz URI’si kullanılacak.',
      );
      return imageUri;
    }

    const file = new File(imageUri);
    if (!file.exists) {
      throw new Error('Yüklenecek görsel cihazda bulunamadı.');
    }

    const imageData = await file.arrayBuffer();
    if (imageData.byteLength === 0) {
      throw new Error('Yüklenecek görsel dosyası boş.');
    }

    const path = `${resolvedUserId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(WARDROBE_BUCKET).upload(path, imageData, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(WARDROBE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error('Görsel yüklendi ancak public URL oluşturulamadı.');
    }
    return data.publicUrl;
  } catch (error) {
    const message = withRlsGuidance(getErrorMessage(error), error, 'wardrobe');
    console.error('[wardrobe] Kıyafet görseli yüklenemedi:', message);
    throw new Error(`Kıyafet görseli yüklenemedi: ${message}`);
  }
}

export async function addClothingItem(
  item: Omit<ClothingItem, 'id' | 'created_at'>,
): Promise<ClothingItem> {
  try {
    if (!item.user_id?.trim()) {
      console.warn(
        '[wardrobe] Kayıtta user_id eksik; aktif oturum veya yerel misafir kimliği kullanılacak.',
      );
    }
    const userId = await resolveUserId(item.user_id);
    const normalizedItem = { ...item, user_id: userId };

    if (isLocalGuest(userId)) {
      const localItem = createLocalWardrobeItem(normalizedItem);
      console.warn(
        '[wardrobe] Kıyafet yerel misafir gardırobuna geçici olarak kaydedildi; Supabase’e gönderilmedi.',
      );
      return localItem;
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .insert(normalizedItem)
      .select('*')
      .single();
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    const message = withRlsGuidance(getErrorMessage(error), error);
    if (isRowLevelSecurityError(error)) {
      const localItem = createLocalWardrobeItem(item);
      console.warn(
        '[wardrobe] Supabase RLS kıyafet eklemeyi reddetti; veri kaybını önlemek için kayıt yalnızca bu oturumun yerel belleğinde tutuluyor:',
        message,
      );
      return localItem;
    }
    console.error('[wardrobe] Kıyafet kaydı oluşturulamadı:', message);
    throw new Error(`Kıyafet kaydı oluşturulamadı: ${message}`);
  }
}

export async function getWardrobeItems(userId: string): Promise<ClothingItem[]> {
  try {
    if (!userId?.trim()) {
      console.warn(
        '[wardrobe] Liste isteğinde user_id eksik; aktif oturum veya yerel misafir gardırobu kullanılacak.',
      );
    }
    const resolvedUserId = await resolveUserId(userId);

    if (isLocalGuest(resolvedUserId)) {
      return [...localWardrobeItems];
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .select('*')
      .eq('user_id', resolvedUserId)
      .order('created_at', { ascending: false });
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    const message = withRlsGuidance(getErrorMessage(error), error);
    if (isRowLevelSecurityError(error)) {
      console.warn(
        '[wardrobe] Supabase RLS gardırop listesini okumayı reddetti; yerel oturumdaki parçalar gösteriliyor:',
        message,
      );
      return [...localWardrobeItems];
    }
    console.error('[wardrobe] Gardırop listesi alınamadı:', message);
    throw new Error(`Gardırop listesi alınamadı: ${message}`);
  }
}

export async function deleteClothingItem(
  itemId: string,
  imageUrl?: string,
): Promise<void> {
  try {
    if (!itemId.trim()) {
      throw new Error('Silinecek kıyafet ID değeri boş olamaz.');
    }

    if (itemId.startsWith('local-item-')) {
      const localItemIndex = localWardrobeItems.findIndex((item) => item.id === itemId);
      const localItem = localWardrobeItems[localItemIndex];
      if (!localItem) {
        throw new Error(`Yerel gardıropta kıyafet bulunamadı: ${itemId}`);
      }
      if (imageUrl && localItem.image_url !== imageUrl) {
        throw new Error('Yerel kıyafet görseli eşleşmedi; silme işlemi iptal edildi.');
      }
      localWardrobeItems.splice(localItemIndex, 1);
      return;
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .delete()
      .eq('id', itemId)
      .select('id')
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error(`Silinecek kıyafet kaydı bulunamadı: ${itemId}`);
    }

    if (imageUrl) {
      const path = getStoragePathFromPublicUrl(imageUrl);
      const { error: storageError } = await supabase.storage
        .from(WARDROBE_BUCKET)
        .remove([path]);
      if (storageError) {
        throw new Error(
          `Kıyafet kaydı silindi ancak görsel depolamadan silinemedi: ${storageError.message}`,
        );
      }
    }
  } catch (error) {
    const message = withRlsGuidance(getErrorMessage(error), error);
    console.error('[wardrobe] Kıyafet silinemedi:', message);
    throw new Error(`Kıyafet silinemedi: ${message}`);
  }
}
