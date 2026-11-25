# Onay matrisi, şok aksiyonları ve red gerekçeleri

Kaynak: OptiSupply dijital ikiz (Pınar Et) proje dosyaları.

Son kararı insan verir. Ajanlar öneri hazırlar; onay kartında yönetici onaylar, reddeder ya da sonraya bırakır. Reddedilen aksiyon gerekçesiyle hafızaya yazılır ve plan o aksiyon olmadan yeniden kurulur.

## Kim neyi onaylar?
| Karar | Onaylayan | Ajanın rolü |
|---|---|---|
| Parçalama giriş planı | Üretim planlama müdürü | Siparişten giriş miktarı önerir |
| Şarküteri hat planı | Üretim müdürü | Kapasite ve siparişi eşleştirir |
| Fiyat koridoru dışı fiyat | Ticari direktör | Etkiyi hesaplar, onaya sunar |
| Dış parça alımı | Satın alma + kalite | Tedarikçi riskini puanlar |
| Parti serbest bırakma | Kalite güvence | KKN kayıtlarını kontrol eder |
| Karantina ve imha | Kalite güvence + veteriner hekim | Sensör ve KKN sapmasını işaretler |
| Ambalaj ve etiket değişikliği | Kalite + pazarlama | — |

# Şoklara göre önerilebilecek aksiyonlar
## Şok: HoReCa biftek talebi
- Sınırlı antrikot ve kontrfile parça alımı (sorumlu: Tedarik Ajanı; aksiyon kodu partBuy)
- Sucuk ve döner hattında ek vardiya (sorumlu: Ürün Karması Ajanı; aksiyon kodu lineBoost)
- Fiyat koridorunu ±%15’e aç: kıt parçada artış, fazla parçada indirim (sorumlu: Fiyat Ajanı; aksiyon kodu pricing)
- Fazla parça için PınarOnline kampanyası (sorumlu: Ticari Ajan; aksiyon kodu campaign)

## Şok: Kurban'a 3 hafta
- Ek soğuk depo kapasitesi kirala (sorumlu: Lojistik Ajanı; aksiyon kodu storage)
- İşlenmiş ürünü erken üret (ek vardiya) (sorumlu: Ürün Karması Ajanı; aksiyon kodu lineBoost)
- Sezon fiyat koridoru ±%15 (sorumlu: Fiyat Ajanı; aksiyon kodu pricing)

## Şok: Bölgesel karantina
- Alımı alternatif besicilere kaydır (sorumlu: Tedarik Ajanı; aksiyon kodu altSupplier)
- Eksik premium parçayı parça olarak al (sorumlu: Tedarik Ajanı; aksiyon kodu partBuy)
- Kıt parçalarda fiyatı koridor içinde artır (sorumlu: Fiyat Ajanı; aksiyon kodu pricing)

## Şok: Soğuk depo arızası
- Rotamen ile diğer depoya transfer (sorumlu: Lojistik Ajanı; aksiyon kodu storage)
- Raf ömrü kısa partileri hatta çek (sorumlu: Ürün Karması Ajanı; aksiyon kodu lineBoost)
- Fazla stokta hızlı indirim (±%15) (sorumlu: Fiyat Ajanı; aksiyon kodu pricing)
- Hızlı dönen kanala kampanya (sorumlu: Ticari Ajan; aksiyon kodu campaign)

## Standart red gerekçeleri
- partBuy: Dış parça alımında kalite riski var
- storage: Ek depo maliyeti onaylı değil
- campaign: Bu hafta kampanya bütçesi yok
- altSupplier: Alternatif besici henüz denetlenmedi
- lineBoost: Hatlarda ek vardiya açılamaz
- pricing: Fiyat koridoru ±%8’i aşmamalı

## Fiyat kuralı
Fazla olan parçada fiyat iner, az olanda çıkar; normalde ±%8 koridorda kalır. Koridoru ±%15’e açmak insan onayı gerektirir. Bugünkü planda fiyat sabittir.
