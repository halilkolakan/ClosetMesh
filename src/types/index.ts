export type ClothingCategory =
  | 'ust_giyim'
  | 'alt_giyim'
  | 'ayakkabi'
  | 'aksesuar';

export type Season =
  | 'ilkbahar'
  | 'yaz'
  | 'sonbahar'
  | 'kis'
  | 'tum_mevsimler';

export type StyleVibe =
  | 'casual'
  | 'formal'
  | 'smart_casual'
  | 'streetwear'
  | 'sport';

export type WeatherStatus =
  | 'Güneşli'
  | 'Bulutlu'
  | 'Yağmurlu'
  | 'Karlı'
  | 'Fırtınalı';

export interface WeatherCondition {
  temperature: number;
  condition: WeatherStatus;
  isRainy: boolean;
  weatherCode: number;
  locationLabel?: string;
}

export interface AIExtractedAttributes {
  category: ClothingCategory;
  subcategory: string;
  color: string;
  seasons: Season[];
  vibe: StyleVibe;
}

export interface ClothingItem extends AIExtractedAttributes {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
}

export interface OutfitRecommendation {
  items: ClothingItem[];
  stylistNote: string;
  vibe: StyleVibe;
  matchScore: number;
}
