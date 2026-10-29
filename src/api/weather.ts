import * as Location from 'expo-location';
import type { WeatherCondition, WeatherStatus } from '../types';

interface OpenMeteoCurrentWeatherResponse {
  current_weather: {
    temperature: number;
    weathercode: number;
  };
}

const FALLBACK_WEATHER: WeatherCondition = {
  temperature: 20,
  condition: 'Güneşli',
  isRainy: false,
  weatherCode: 0,
  locationLabel: 'İstanbul · varsayılan',
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getWeatherStatus(weatherCode: number): WeatherStatus {
  if (weatherCode === 0 || weatherCode === 1) {
    return 'Güneşli';
  }
  if (weatherCode === 2 || weatherCode === 3 || weatherCode === 45 || weatherCode === 48) {
    return 'Bulutlu';
  }
  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return 'Yağmurlu';
  }
  if (
    (weatherCode >= 71 && weatherCode <= 77) ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return 'Karlı';
  }
  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return 'Fırtınalı';
  }

  throw new Error(`Open-Meteo bilinmeyen bir weathercode döndürdü: ${weatherCode}`);
}

function isRainyWeatherCode(weatherCode: number): boolean {
  return (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    weatherCode === 95 ||
    weatherCode === 96 ||
    weatherCode === 99
  );
}

function isOpenMeteoResponse(value: unknown): value is OpenMeteoCurrentWeatherResponse {
  if (!isRecord(value) || !isRecord(value.current_weather)) {
    return false;
  }

  const { temperature, weathercode } = value.current_weather;
  return (
    typeof temperature === 'number' &&
    Number.isFinite(temperature) &&
    typeof weathercode === 'number' &&
    Number.isInteger(weathercode)
  );
}

export async function getLiveWeather(): Promise<WeatherCondition> {
  try {
    const permission = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      15_000,
      'Konum izni isteği',
    );
    if (!permission.granted) {
      throw new Error('Canlı hava durumu için konum izni verilmedi.');
    }

    const location = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      12_000,
      'Cihaz konumu',
    );
    const { latitude, longitude } = location.coords;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Cihaz geçerli bir konum koordinatı döndürmedi.');
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
      `&longitude=${longitude}&current_weather=true`;
    const response = await withTimeout(fetch(url), 10_000, 'Hava durumu isteği');
    if (!response.ok) {
      throw new Error(`Open-Meteo isteği başarısız oldu (HTTP ${response.status}).`);
    }

    const payload: unknown = await response.json();
    if (!isOpenMeteoResponse(payload)) {
      throw new Error('Open-Meteo yanıtı beklenen hava durumu verilerini içermiyor.');
    }

    const { temperature, weathercode } = payload.current_weather;
    return {
      temperature,
      condition: getWeatherStatus(weathercode),
      isRainy: isRainyWeatherCode(weathercode),
      weatherCode: weathercode,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.warn(
      '[weather] Canlı hava durumu alınamadı; İstanbul için varsayılan hava durumu kullanılıyor:',
      message,
    );
    return FALLBACK_WEATHER;
  }
}
