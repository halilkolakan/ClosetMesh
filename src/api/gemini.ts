import { GoogleGenerativeAI } from '@google/generative-ai';
import { File } from 'expo-file-system';
import type {
  AIExtractedAttributes,
  ClothingCategory,
  ClothingItem,
  OutfitRecommendation,
  Season,
  StyleVibe,
  WeatherCondition,
} from '../types';

const categories: readonly ClothingCategory[] = [
  'ust_giyim',
  'alt_giyim',
  'ayakkabi',
  'aksesuar',
];
const seasons: readonly Season[] = [
  'ilkbahar',
  'yaz',
  'sonbahar',
  'kis',
  'tum_mevsimler',
];
const vibes: readonly StyleVibe[] = [
  'casual',
  'formal',
  'smart_casual',
  'streetwear',
  'sport',
];

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-pro',
  'gemini-3-flash-preview',
] as const;

const FALLBACK_CLOTHING_ATTRIBUTES: AIExtractedAttributes = {
  category: 'ust_giyim',
  subcategory: 'Kıyafet',
  color: 'Belirtilmedi',
  seasons: ['tum_mevsimler'],
  vibe: 'casual',
};

class GeminiModelPoolError extends Error {
  constructor(
    message: string,
    readonly allModelsTransient: boolean,
  ) {
    super(message);
    this.name = 'GeminiModelPoolError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getModels() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'EXPO_PUBLIC_GEMINI_API_KEY tanımlı değil. Gemini API anahtarını Expo ortam değişkenlerine ekleyin.',
    );
  }

  const client = new GoogleGenerativeAI(apiKey);

  return MODELS.map((modelName) => ({
    modelName,
    model: client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    }),
  }));
}

function isTransientError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const status =
    isRecord(error) && typeof error.status === 'number' ? error.status : undefined;

  return (
    status === 503 ||
    /\b503\b|service unavailable|temporarily unavailable|overloaded|network|fetch failed|connection|timed? out|timeout|econnreset|enotfound/i.test(
      message,
    )
  );
}

async function requestWithModelFallback<T>(
  request: (model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>) => Promise<T>,
): Promise<T> {
  const models = getModels();
  const failures: string[] = [];
  let allModelsTransient = true;

  for (const { modelName, model } of models) {
    try {
      return await request(model);
    } catch (error) {
      const message = getErrorMessage(error);
      allModelsTransient = allModelsTransient && isTransientError(error);
      failures.push(`${modelName}: ${message}`);
      console.warn(
        `[gemini] ${modelName} modeli ${isTransientError(error) ? 'geçici hata verdi' : 'başarısız oldu'}; yedek model deneniyor:`,
        message,
      );
    }
  }

  throw new GeminiModelPoolError(
    `Gemini modellerinin hiçbiri yanıt vermedi. ${failures.join(' | ')}`,
    allModelsTransient,
  );
}

function cleanJson(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function parseModelJson(text: string): unknown {
  return JSON.parse(cleanJson(text)) as unknown;
}

function isStyleVibe(value: unknown): value is StyleVibe {
  return typeof value === 'string' && vibes.some((vibe) => vibe === value);
}

function isClothingCategory(value: unknown): value is ClothingCategory {
  return typeof value === 'string' && categories.some((category) => category === value);
}

function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && seasons.some((season) => season === value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function parseExtractedAttributes(value: unknown): AIExtractedAttributes {
  if (!isRecord(value)) {
    throw new Error('Gemini kıyafet analizi geçerli bir JSON nesnesi döndürmedi.');
  }

  const { category, subcategory, color, seasons: itemSeasons, vibe } = value;
  if (
    !isClothingCategory(category) ||
    typeof subcategory !== 'string' ||
    typeof color !== 'string' ||
    !Array.isArray(itemSeasons) ||
    !itemSeasons.every(isSeason) ||
    !isStyleVibe(vibe)
  ) {
    throw new Error('Gemini kıyafet analizi beklenen alanları veya değerleri içermiyor.');
  }

  return {
    category,
    subcategory,
    color,
    seasons: itemSeasons,
    vibe,
  };
}

function isClothingItem(value: unknown): value is ClothingItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.image_url === 'string' &&
    typeof value.created_at === 'string' &&
    isClothingCategory(value.category) &&
    typeof value.subcategory === 'string' &&
    typeof value.color === 'string' &&
    Array.isArray(value.seasons) &&
    value.seasons.every(isSeason) &&
    isStyleVibe(value.vibe)
  );
}

function getImageMimeType(imageUri: string): string {
  const path = imageUri.split(/[?#]/, 1)[0].toLowerCase();
  const extension = path.split('.').pop();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const mimeType = extension ? mimeTypes[extension] : undefined;

  if (!mimeType) {
    throw new Error('Görsel biçimi desteklenmiyor. JPEG, PNG, WebP veya HEIC görseli kullanın.');
  }
  return mimeType;
}

export async function analyzeClothingImage(
  imageUri: string,
): Promise<AIExtractedAttributes> {
  try {
    if (!imageUri.trim()) {
      throw new Error('Kıyafet görseli URI değeri boş olamaz.');
    }

    const imageBase64 = await new File(imageUri).base64();
    if (!imageBase64) {
      throw new Error('Görsel dosyası boş veya okunamıyor.');
    }

    const prompt = `Sen profesyonel bir moda ve giyim analiz uzmanısın. Gönderilen kıyafet görselini incele ve SADECE geçerli bir JSON objesi döndür. Markdown backtick (\`\`\`json) veya ekstra hiçbir açıklama ekleme.
Dönecek JSON formatı:
{
  "category": "ust_giyim" | "alt_giyim" | "ayakkabi" | "aksesuar",
  "subcategory": "ör: Oversize Hoodie, Slim Chino, Sneaker",
  "color": "ör: Füme, Bej, Siyah",
  "seasons": ["ilkbahar", "yaz", "sonbahar", "kis", "tum_mevsimler"],
  "vibe": "casual" | "formal" | "smart_casual" | "streetwear" | "sport"
}`;
    const imagePart = {
      inlineData: { data: imageBase64, mimeType: getImageMimeType(imageUri) },
    };

    return await requestWithModelFallback(async (model) => {
      const result = await model.generateContent([prompt, imagePart]);
      return parseExtractedAttributes(parseModelJson(result.response.text()));
    });
  } catch (error) {
    const message = getErrorMessage(error);
    if (error instanceof GeminiModelPoolError && error.allModelsTransient) {
      console.warn(
        '[gemini] Tüm modeller başarısız; kıyafet formunda düzenlenebilir varsayılan özellikler kullanılıyor:',
        message,
      );
      return { ...FALLBACK_CLOTHING_ATTRIBUTES };
    }
    console.error('[gemini] Kıyafet görseli analiz edilemedi:', message);
    throw new Error(`Kıyafet görseli analiz edilemedi: ${message}`);
  }
}

export async function generateOutfitMesh(
  wardrobe: ClothingItem[],
  weather: WeatherCondition,
  preferredVibe?: StyleVibe,
): Promise<OutfitRecommendation> {
  try {
    if (!wardrobe.every(isClothingItem)) {
      throw new Error('Gardırop listesinde geçersiz veya eksik kıyafet verisi var.');
    }
    if (preferredVibe !== undefined && !isStyleVibe(preferredVibe)) {
      throw new Error('Seçilen stil tercihi desteklenen bir değer değil.');
    }
    if (!Number.isFinite(weather.temperature) || typeof weather.condition !== 'string') {
      throw new Error('Hava durumu bilgisi geçersiz.');
    }

    const wardrobeForPrompt = wardrobe.map(
      ({ id, category, subcategory, color, seasons: itemSeasons, vibe }) => ({
        id,
        category,
        subcategory,
        color,
        seasons: itemSeasons,
        vibe,
      }),
    );
    const preference = preferredVibe ?? 'tercih belirtilmedi';
    const prompt = `Aşağıda kullanıcının gardırobundaki kıyafetlerin listesi ve bugünün hava durumu verilmiştir.
Kullanıcı için en uyumlu, mevsime ve tarza tam oturan 1 adet üst giyim, 1 adet alt giyim, 1 adet ayakkabı (varsa opsiyonel 1 aksesuar) seç.
Kullanıcının gardırobu: ${JSON.stringify(wardrobeForPrompt)}
Bugünün hava durumu: ${weather.temperature}°C, ${weather.condition}
Yağış durumu: ${weather.isRainy ? 'yağışlı' : 'yağış yok'}
Kullanıcının tercih ettiği tarz: ${preference}
SADECE geçerli bir JSON objesi döndür:
{
  "selectedItemIds": ["id1", "id2", "id3"],
  "stylistNote": "Bugün hava serin ve rüzgarlı olduğu için füme hoodie ile siyah pantolonu eşleştirdik...",
  "vibe": "casual",
  "matchScore": 92
}`;

    return await requestWithModelFallback(async (model) => {
      const result = await model.generateContent(prompt);
      const parsedResponse = parseModelJson(result.response.text());
      if (!isRecord(parsedResponse)) {
        throw new Error('Gemini stil önerisi geçerli bir JSON nesnesi döndürmedi.');
      }

      const { selectedItemIds, stylistNote, vibe, matchScore } = parsedResponse;
      if (
        !Array.isArray(selectedItemIds) ||
        selectedItemIds.length === 0 ||
        !selectedItemIds.every(isString) ||
        typeof stylistNote !== 'string' ||
        stylistNote.trim().length === 0 ||
        !isStyleVibe(vibe) ||
        typeof matchScore !== 'number' ||
        !Number.isFinite(matchScore) ||
        matchScore < 0 ||
        matchScore > 100
      ) {
        throw new Error('Gemini stil önerisi beklenen alanları veya değerleri içermiyor.');
      }

      const itemsById = new Map(wardrobe.map((item) => [item.id, item]));
      const selectedItems = selectedItemIds.map((id) => {
        const item = itemsById.get(id);
        if (!item) {
          throw new Error(`Gemini gardıropta bulunmayan bir kıyafet ID'si döndürdü: ${id}`);
        }
        return item;
      });
      if (new Set(selectedItemIds).size !== selectedItemIds.length) {
        throw new Error('Gemini stil önerisinde yinelenen kıyafet ID’leri var.');
      }

      return {
        items: selectedItems,
        stylistNote,
        vibe,
        matchScore,
      };
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[gemini] Kombin önerisi oluşturulamadı:', message);
    throw new Error(`Kombin önerisi oluşturulamadı: ${message}`);
  }
}
