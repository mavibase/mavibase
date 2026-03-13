<p align="center">
  <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-2D9nxBSTYc7DOWMDtGGLMGBTdHLLek.png" alt="Mavibase — Dakikalar icinde backend olusturun." width="100%" />
</p>

<h3 align="center">Acik kaynakli Backend as a Service platformu.</h3>
<p align="center">Veritabanlari · Kimlik Dogrulama · Gercek Zamanli · Edge Fonksiyonlari · Depolama</p>

<br />

<p align="center">
  <a href="https://github.com/mavibase/mavibase/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="Lisans: Apache 2.0" />
  </a>
  <img src="https://img.shields.io/badge/status-aktif%20gelistirme-blue" alt="Durum: Aktif Gelistirme" />
  <img src="https://img.shields.io/badge/TypeScript-5.3+-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white" alt="Node.js" />
</p>

---

> [English](./README.md) | Turkce

---

> **Not:** Mavibase su anda aktif gelistirme asamasindadir. Ozellikler ve API'ler degisebilir. Katkilar ve erken test kullanicilarini memnuniyetle karsiliyoruz.

---

## Mavibase Nedir?

Mavibase, kendi sunucunuzda barindirabildiginiz, acik kaynakli bir **Backend as a Service (BaaS)** platformudur — Supabase, Appwrite veya Firebase'e benzer sekilde — altyapi yonetimi olmadan dakikalar icinde uretim ortamina hazir backend'ler olusturmanizi saglar.

Kutudan cikan tam yigin bir backend platformu sunar: PostgreSQL tabanli guclu bir dokuman veritabani motoru, MFA destekli kimlik dogrulama, oturum yonetimi, takim ve proje organizasyonu, API anahtar yonetimi ve her seyi gorsel olarak yonetebileceginiz guzel bir web konsolu.

### Hizli Baglantilar

- **[Tam Dokumantasyon](./docs)** — Eksiksiz kilavuzlar ve API referansi
- **[Baslangic](./docs/getting-started/quickstart.mdx)** — Hizli baslangic kilavuzu
- **[API Referansi](./docs/api)** — Detayli API dokumantasyonu
- **[Kavramlar](./docs/concepts)** — Veri modelleri, izinler ve daha fazlasi hakkinda derin bilgiler

---

## Kontrol Paneli Onizleme

<img width="1901" height="1044" alt="image" src="https://github.com/user-attachments/assets/71701786-ca6e-40bd-9ecc-94d675ebc06c" />

---

## Ozellikler

### Veri Modeli
- **Veritabanlari** — Proje basina birden fazla izole veritabani olusturun ve yonetin
- **Koleksiyonlar** — Istege bagli sema zorlama ile esnek NoSQL koleksiyonlari
- **Dokumanlar** — Toplu destek ile tam CRUD islemleri
- **Dokuman Surumleme** — Her dokumanda otomatik surum gecmisi takibi

### Sema ve Dogrulama
- **12 Alan Tipi** — `string`, `number`, `integer`, `float`, `boolean`, `object`, `array`, `email`, `url`, `ip`, `datetime`, `enum`
- **Dogrulama Kurallari** — `required`, `unique`, `default`, `min`/`max`, `minLength`/`maxLength`, `regex`, enum listeleri
- **Iliskiler** — `oneToOne`, `oneToMany`, `manyToOne`, `manyToMany` silme islemlerinde `cascade` / `setNull` / `restrict`, istege bagli cift yonlu senkronizasyon

### Sorgulama
- **Sorgu Dili** — JSON tabanli operatorler: `equal`, `notEqual`, `lessThan`, `greaterThan`, `between`, `contains`, `startsWith`, `endsWith`, `search` (tam metin), `in`, `notIn`, `isNull`, `isNotNull`, `and`, `or`, `not`
- **Siralama ve Sayfalama** — `orderBy`, `limit`, `offset`
- **Agregasyonlar** — Koleksiyon verileri uzerinde agregasyon islemleri
- **Population** — Iliski alanlarini satir ici tam dokumanlara cozumleme

### Izinler ve Roller
- **Koleksiyon Duzeyinde Izinler** — Koleksiyon basina `read`, `create`, `update`, `delete` kurallari
- **Dokuman Duzeyinde Izinler** — Istege bagli dokuman bazinda izin gecersiz kilmalari
- **Izin Tipleri** — `any`, `user:{id}`, `role:{name}`, `owner`
- **Ozel Proje Rolleri** — Roller tanimlayin (orn. `moderator`, `analyst`) ve son kullanicilara atayin
- **Rol Atamalari** — Istege bagli son kullanma tarihi ile rol atama

### Indeksler
- **Alan Indeksleri** — Sorgu performansi icin herhangi bir koleksiyon alaninda indeks olusturun
- **Indeks Durum Takibi** — `pending` → `creating` → `active` / `failed` yasam dongusu

### Gozlemlenebilirlik
- **Denetim Gunlukleri** — Tum veritabani islemlerinde tam denetim izi
- **Yavas Sorgu Gunlukleri** — Optimizasyon onerileri ile yavas sorgularin otomatik tespiti ve kaydedilmesi, 30 gunluk saklama
- **Kullanim ve Kotalar** — Veritabani basina kota zorlama ve kullanim takibi
- **Boyut Takibi** — Veritabani ve koleksiyon boyut izleme

### Guvenlik
- **API Anahtar Kimlik Dogrulamasi** — Ince ayarli kapsam kontrolleri ile proje kapsamli API anahtarlari
- **Cok Kiracilik** — Tum verilerde tam takim + proje izolasyonu

### Konsol Arayuzu
- Acik tema, Koyu tema, Sistem temasi
- Kontrol panelinden eksiksiz veritabani yonetimi
- Veritabani yapisini, izinleri ve verileri dogrudan arayuzden yonetin

---

## Mimari

Istemciler (Web, Mobil, Sunucular) bir **Yuk Dengeleyici** araciligiyla **REST API** ve **Gercek Zamanli API**'ye baglanir, her ikisi de bir **Guvenlik Katmani** ile korunur. Istekler **Cache (Redis)** ve **Kuyruk (Redis)** tarafindan desteklenen **Yurutucu** tarafindan islenir. Bir **PostgreSQL Veritabani** birincil veri deposu olarak hizmet eder ve arka plan iscileri Build'leri, Denetimleri, Postalar, Webhook'lari, Fonksiyonlari ve daha fazlasini isler.

Bu, iki uygulama ve dort paylasilmis paket iceren bir **pnpm monorepo**'dur:

```
mavibase/
├── apps/
│   ├── server/          # Express.js API sunucusu
│   └── console/         # Next.js 15 web konsolu
│
├── packages/
│   ├── core/            # Paylasilmis TypeScript tipleri ve hata siniflari
│   ├── database/        # Veritabani motoru (sorgu, sema, islemler)
│   ├── api/             # REST controller'lar, rotalar, middleware
│   └── platform/        # Kimlik dogrulama, kullanicilar, takimlar, projeler, oturumlar, MFA
│
└── scripts/
    ├── migrate-platform.ts
    └── migrate-database.ts
```

---

## Teknoloji Yigini

### Backend
| | |
|---|---|
| Calisma Zamani | Node.js + Express |
| Dil | TypeScript |
| Kimlik Dogrulama | JWT + Argon2 / bcrypt, HTTP-only cerezler |
| Veritabani | PostgreSQL (`pg`) |
| Cache / Gercek Zamanli | Redis (`ioredis`) |
| E-posta | Nodemailer & Resend |
| Guvenlik | Helmet, CORS, `express-rate-limit` |
| Loglama | Winston |
| ID'ler | nanoid, uuid |

### Frontend
| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + shadcn/ui + Radix UI |
| Stillendirme | Tailwind CSS v4 |
| Ikonlar | HugeIcons & Lucide React |
| Animasyonlar | Framer Motion |
| Veri Cekme | SWR + Axios |
| Formlar | React Hook Form + Zod |
| Tablolar | TanStack Table |
| Grafikler | Recharts |

### Altyapi
| | |
|---|---|
| Veritabani | Proje basina izole semalarla cok kiracili PostgreSQL |
| Cache | Onbellekleme ve oturum yonetimi icin Redis |
| Migrasyon | Hem platform hem de veritabani semalari icin migrasyon sistemi |

---

## Baslarken

### On Kosullar

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Redis 6+

### Hizli Baslangic

```bash
# 1. Depoyu klonlayin
git clone https://github.com/mavibase/mavibase.git
cd mavibase

# 2. Tum bagimliliklari yukleyin
pnpm install

# 3. Ortam degiskenlerini yapilandirin
cp .env.example .env
# PostgreSQL ve Redis kimlik bilgilerinizi girin

# 4. Migrasyonlari calistirin
pnpm migrate

# 5. Gelistirme sunucularini baslatin
pnpm dev:all
```

- **API Sunucusu:** `http://localhost:5000`
- **Web Konsolu:** `http://localhost:3000`

Detayli kurulum ve yapilandirma talimatlari icin [Kurulum Kilavuzu](./docs/getting-started/installation.mdx)'na bakin.

---

## API Referansi

### Veritabani API — `/api/v1/db`

[Tam dokumantasyonu goruntule](./docs/api)

**Temel Islemler:**
- **Veritabanlari** — Veritabani olusturma, okuma, guncelleme, silme
- **Koleksiyonlar** — Istege bagli sema ile koleksiyon yonetimi
- **Dokumanlar** — Surumleme ve yazilimsal silme ile CRUD islemleri
- **Sorgulama** — 20+ operator ile gelismis sorgulama
- **Islemler** — ACID uyumlu atomik islemler
- **Indeksler** — Sorgu performansini optimize etme
- **Roller ve Izinler** — Ince ayarli erisim kontrolu

**Gozlemlenebilirlik:**
- **Yavas Sorgular** — Yavas sorgulari takip edin ve optimize edin
- **Denetim Gunlukleri** — Veritabani basina tam islem gecmisi

### Platform API — `/api/v1/platform`

[Tam dokumantasyonu goruntule](./docs/api)

**Kimlik Dogrulama ve Kullanicilar:**
- **Auth** — Kayit, giris, MFA, sifre sifirlama
- **Users** — Kullanici profil yonetimi
- **Sessions** — Oturum ve cikis yonetimi
- **Two-Factor** — 2FA etkinlestirme/devre disi birakma

**Organizasyon:**
- **Teams** — Takim yonetimi ve izinler
- **Projects** — Proje olusturma ve yapilandirma
- **API Keys** — Kapsamli API anahtarlari olusturma ve yonetme
- **Project Roles** — Ozel rol tanimlari ve atamalari

### Saglik Endpoint'leri

```
GET /health
GET /api/v1/db/health
GET /api/v1/platform/health
```

---

## Dokumantasyon

Kapsamli dokumantasyon `docs/` dizininde mevcuttur:

### Baslarken
- **[Hizli Baslangic](./docs/getting-started/quickstart.mdx)** — 5 dakikada calistirin
- **[Kurulum](./docs/getting-started/installation.mdx)** — Detayli kurulum talimatlari
- **[Kimlik Dogrulama](./docs/getting-started/authentication.mdx)** — Kimlik dogrulama akislarini ogrenin

### Kavramlar
- **[Veri Modeli](./docs/concepts/data-model.mdx)** — Veritabanlari, koleksiyonlar ve dokumanlari anlayin
- **[Izinler](./docs/concepts/permissions.mdx)** — Satir duzeyinde ve alan duzeyinde erisim kontrolu
- **[Cok Kiracilik](./docs/concepts/multi-tenancy.mdx)** — Cok kiracili SaaS uygulamalari olusturun
- **[Islemler](./docs/concepts/transactions.mdx)** — ACID uyumlu atomik islemler

### API Referansi
- **[Veritabanlari](./docs/api/databases.mdx)** — Veritabani islemleri
- **[Koleksiyonlar](./docs/api/collections.mdx)** — Koleksiyon yonetimi
- **[Dokumanlar](./docs/api/documents.mdx)** — Dokuman CRUD ve surumleme
- **[Sorgulama](./docs/api/querying.mdx)** — Sorgu sozdizimi ve operatorler
- **[Islemler](./docs/api/transactions.mdx)** — Islem endpoint'leri
- **[Indeksler](./docs/api/indexes.mdx)** — Sorgu optimizasyonu
- **[Roller](./docs/api/roles.mdx)** — Rol yonetimi
- **[Kimlik Dogrulama](./docs/api/auth.mdx)** — Auth endpoint'leri
- **[Kullanicilar](./docs/api/users.mdx)** — Kullanici yonetimi
- **[Takimlar](./docs/api/teams.mdx)** — Takim islemleri
- **[Projeler](./docs/api/projects.mdx)** — Proje yonetimi
- **[API Anahtarlari](./docs/api/api-keys.mdx)** — API anahtar yonetimi
- **[Oturumlar](./docs/api/sessions.mdx)** — Oturum yonetimi
- **[Iki Faktorlu](./docs/api/two-factor.mdx)** — MFA kurulumu ve dogrulama
- **[Yavas Sorgular](./docs/api/slow-queries.mdx)** — Performans izleme

### Kilavuzlar
- **[Sorgulama Kilavuzu](./docs/guides/querying.mdx)** — Sorgu dilinde ustalasin
- **[Hata Yonetimi](./docs/guides/error-handling.mdx)** — API hatalarini zarif sekilde yonetin
- **[En Iyi Uygulamalar](./docs/guides/best-practices.mdx)** — Uretim ortamina hazir kaliplar

---

## Gelistirme Komutlari

```bash
# Gelistirme
pnpm dev               # API sunucusunu baslat (hot reload)
pnpm dev:console       # Web konsolunu baslat (hot reload)
pnpm dev:all           # Her iki sunucuyu da es zamanli baslat

# Derleme
pnpm build             # Tum paketleri derle
pnpm clean             # Derleme artefaktlarini temizle

# Veritabani
pnpm migrate           # Tum migrasyonlari calistir
pnpm migrate:platform  # Platform sema migrasyonlari
pnpm migrate:database  # Veritabani motoru migrasyonlari

# Test ve Lint
pnpm test              # Test paketini calistir
pnpm lint              # Tum paketleri lint'le
```

---

## Proje Durumu

### Tamamlanan Ozellikler

- PostgreSQL ile dokuman veritabani motoru
- Sema dogrulama (12 alan tipi)
- Gelismis sorgu motoru (20+ operator)
- Dokuman surumleme ve gecmis
- ACID uyumlu islemler
- Kimlik dogrulama (JWT, Argon2, MFA)
- Cok kiracilik (takimlar ve projeler)
- Rol tabanli erisim kontrolu
- Satir duzeyinde guvenlik (RLS)
- Alan duzeyinde erisim kontrolu
- Kapsamli API anahtar yonetimi
- Web konsolu (Next.js 15)
- Denetim gunlukleri
- Yavas sorgu tespiti
- Kendi sunucunuzda barindirma destegi
- Kapsamli dokumantasyon

### Planlanan Ozellikler

- Gercek zamanli abonelikler (WebSocket)
- Edge Fonksiyonlari (FaaS)
- Dosya Depolama (S3 uyumlu)
- Resmi SDK'lar:
  - JavaScript/TypeScript
  - Python
  - Flutter
  - Go
- GraphQL API
- Gelismis analitik
- Webhook'lar

---

## Yol Haritasi

Proje ilerlemesini ve yaklasan ozellikleri [GitHub Issues](https://github.com/mavibase/mavibase/issues) uzerinden takip edin.

---

## Katki

Topluluktan katkilari memnuniyetle karsiliyoruz! Detaylar icin [Katki Kilavuzu](./CONTRIBUTING.md)'na bakin.

### Gelistirme Is Akisi

1. Depoyu fork'layin
2. Bir ozellik dali olusturun: `git checkout -b feature/ozelligim`
3. Degisikliklerinizi yapin ve commit'leyin: `git commit -m 'feat: ozelligimi ekle'`
4. Fork'unuza push'layin ve bir Pull Request olusturun
5. Tum testlerin gectiginden ve dokumantasyonun guncellendiginden emin olun

### Katki Alanlari

- Hata duzeltmeleri ve performans iyilestirmeleri
- Sorgu motoru icin yeni operatorler
- Dokumantasyon ve ornekler
- SDK gelistirme
- Test ve kalite guvence

---

## Topluluk

Bize katilin ve Mavibase hakkinda guncel kalin:

<p align="center">
  <a href="https://github.com/mavibase/mavibase/discussions"><img src="https://img.shields.io/badge/GitHub-Tartismalar-181717?logo=github&logoColor=white" alt="GitHub Tartismalar" /></a>
  &nbsp;
  <a href="https://t.me/Mavibase"><img src="https://img.shields.io/badge/Telegram-Topluluk-26A5E4?logo=telegram&logoColor=white" alt="Telegram" /></a>
  &nbsp;
  <a href="https://www.linkedin.com/company/mavibase"><img src="https://img.shields.io/badge/LinkedIn-Baglan-0A66C2?logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
</p>

### Destek

- **Sorunlar ve Hata Raporlari:** [GitHub Issues](https://github.com/mavibase/mavibase/issues)
- **Tartismalar:** [GitHub Discussions](https://github.com/mavibase/mavibase/discussions)
- **Guvenlik:** [Guvenlik Politikasi](./SECURITY.md)

---

## Lisans

Mavibase, [Apache License 2.0](./LICENSE) altinda lisanslanmis acik kaynakli bir yazilimdir.

---

<p align="center">Mavibase ekibi tarafindan ozenle gelistirildi.</p>
