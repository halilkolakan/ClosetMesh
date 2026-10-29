# 👗 ClosetMesh

> Gardırobunu dijitalleştir; yapay zekâ, bugünün havasına ve tarzına en uygun kombini saniyeler içinde çıkarsın.

![React Native](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo%20SDK-58-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20DB%20%7C%20Storage-3ECF8E?logo=supabase&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google-Gemini%203.8%20Flash-4285F4?logo=google&logoColor=white)
![Open-Meteo](https://img.shields.io/badge/Open--Meteo-No%20API%20Key-FF9800)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Temel Özellikler

- 📸 **Multimodal Kıyafet Analizi** – Fotoğraf çek veya galeriden seç; Gemini kategori, alt kategori, renk, mevsim ve stil bilgisini otomatik çıkarır. Sonuçlar düzenlenebilir formda gelir.
- 🌤️ **Canlı Hava Durumu** – `expo-location` + Open-Meteo (API anahtarı gerektirmez). WMO kodları Türkçe durumlara çevrilir (Güneşli, Yağmurlu, Karlı…).
- 🧠 **Akıllı Kombin Motoru** – Gardırop + sıcaklık + seçilen tarz (Casual, Smart Casual, Streetwear, Formal, Sport) → uyum skoru ve stilist notu içeren kombin.
- 🛟 **Çevrimdışı Dayanıklılık & Misafir Modu** – Ağ, GPS, izin ya da AI hatası uygulamayı asla kilitlemez; varsayılan hava durumu, yerel misafir kullanıcı ve rastgele-mantıklı kombin fallback'i devreye girer.
- 🛡️ **Global Error Boundary** – Render hatalarında hata metni ve component stack ekranda gösterilir, "Yeniden Dene" ile toparlanılır.

## 🏗️ Sistem ve Veri Akışı Mimarisi

```text
┌──────────────────────────────────────────────┐
│          UI (React Navigation Tabs)          │
│   Dolabım  │  Kombin  │  Ekle                │
└─────┬────────────┬────────────┬──────────────┘
      │            │            │
      │            │            ▼
      │            │   Expo ImagePicker / Camera
      │            │   (quality 0.5, 1:1 kırpma)
      │            │            │
      │            │            ▼
      │            │   ┌─────────────────────────┐
      │            │   │ Gemini 3.8 Flash        │◄── Model fallback zinciri
      │            │   │ (JSON çıktı, base64)    │    3.8-flash → 3.8-pro → 3-flash-preview
      │            │   └────────────┬────────────┘
      │            │                │ AIExtractedAttributes
      │            ▼                ▼
      │   ┌─────────────────┐  ┌────────────────────────────────┐
      │   │ Open-Meteo      │  │ Supabase                       │
      │   │ (hava durumu)   │  │  • Storage  (wardrobe bucket)  │
      │   └────────┬────────┘  │  • PostgreSQL + RLS            │
      │            │           │  • Auth (Anonymous / Email)    │
      │            ▼           └───────────────┬────────────────┘
      │   generateOutfitMesh(wardrobe, weather, vibe)          │
      └────────────────────────◄───────────────────────────────┘
```

**Akış:** Fotoğraf → sıkıştırma → Gemini analizi → form onayı → Storage'a yükleme → `clothing_items` kaydı → Kombin ekranında hava durumu + gardırop → Gemini → `OutfitRecommendation`.

## 💡 Mühendislik ve Tasarım Tercihleri

| Konu | Karar | Neden |
|------|-------|-------|
| **Strict TypeScript** | `any` yok; paylaşılan tipler `src/types`, Supabase `Database` generic'i | AI çıktısı ve DB satırları derleme zamanında doğrulanır; `npx tsc --noEmit` temiz geçer. |
| **Model Fallback Zinciri** | `gemini-3.8-flash → gemini-3.8-pro → gemini-3-flash-preview` | 503 / ağ kopması / 404 durumunda sıradaki modele geçilir. Tüm modeller geçici olarak başarısızsa güvenli varsayılan nitelikler döner; akış kesilmez. |
| **Görsel Sıkıştırma** | `quality: 0.5` + `aspect: [1, 1]` | Base64 boyutu ve istek süresi dramatik düşer; kullanıcı kırpma ile odaklanır. |
| **JSON Güvenliği** | `responseMimeType: application/json`, `maxOutputTokens: 1000`, `cleanJson` | Kesilmiş veya markdown'lı yanıtlardan kaynaklı parse hatalarını önler. |
| **RLS Güvenlik Politikaları** | Satır bazlı `auth.uid() = user_id` | İstemci anahtarı public olsa da kullanıcı yalnızca kendi verisine erişir. |
| **Misafir Dayanıklılığı** | Anonymous Auth + `local-guest` bellek içi fallback | Supabase erişilemezse bile arayüz açılır. |

### 🔐 Örnek RLS Politikaları

```sql
alter table public.clothing_items enable row level security;

create policy "own items select" on public.clothing_items
  for select using (auth.uid() = user_id);
create policy "own items insert" on public.clothing_items
  for insert with check (auth.uid() = user_id);
create policy "own items delete" on public.clothing_items
  for delete using (auth.uid() = user_id);

-- Storage: wardrobe bucket, ilk klasör = kullanıcı ID'si
create policy "own files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
```

Supabase panelinde **Authentication → Providers → Anonymous Sign-Ins** seçeneğini etkinleştirmeyi unutma.

> ⚠️ `EXPO_PUBLIC_*` değişkenleri uygulama paketine gömülür ve istemciden okunabilir. Üretimde Gemini çağrılarını bir sunucu/Edge Function proxy'si arkasına taşı.

## 📁 Modüler Klasör Yapısı

```text
ClosetMesh/
├── App.tsx                  # Giriş noktası, tab navigasyon, misafir bootstrap
├── src/
│   ├── api/                 # gemini.ts, weather.ts, auth.ts, wardrobe.ts
│   ├── components/          # ErrorBoundary
│   ├── config/              # supabase.ts (güvenli istemci)
│   ├── context/             # AuthContext
│   ├── navigation/          # Tab param tipleri
│   ├── screens/             # WardrobeScreen, OutfitScreen, AddItemScreen
│   └── types/               # Paylaşılan domain tipleri
├── .env.example
└── LICENSE
```

## 🚀 Kurulum ve Yerel Çalıştırma

```bash
# 1. Depoyu klonla
git clone https://github.com/<kullanici>/ClosetMesh.git
cd ClosetMesh

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini hazırla
cp .env.example .env        # Windows: copy .env.example .env
# .env içindeki Supabase ve Gemini değerlerini doldur

# 4. Başlat
npx expo start
```

Telefonda **Expo Go** ile QR kodu okut. Tip kontrolü: `npx tsc --noEmit`.

| Değişken | Açıklama |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'si |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) anahtarı |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google AI Studio API anahtarı |

> 🔒 `.env` dosyası `.gitignore` içindedir; gerçek anahtarları asla commit etme.

## 📄 Lisans

[MIT](./LICENSE) © ClosetMesh contributors
