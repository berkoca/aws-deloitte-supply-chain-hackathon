# Dijital ikiz model varsayımları

Kaynak: OptiSupply dijital ikiz (Pınar Et) proje dosyaları.

Karkas ağırlığı 280 kg. Karkas/canlı verimi %55. Parçalama dağılımı (Pınar Et): satış %30, imalat %54,2, rendering %15,5, fire %0,3.
Karkas bütün alınır: bir parçanın talebi için alınan hayvan diğer parçaları da üretir. Fazla parça sucuk, sosis-salam ve donuk burger-köfte hatlarına yönlendirilebilir.

## Parça verimleri (karkas payı) ve göreli fiyat endeksi
- Kıymalık: %21.05 pay, fiyat endeksi 1.00
- Ön parça: %16.84 pay, fiyat endeksi 1.10
- But: %18.52 pay, fiyat endeksi 1.20
- Döş: %8.42 pay, fiyat endeksi 0.90
- Kaburga: %8.42 pay, fiyat endeksi 1.00
- Antrikot: %5.05 pay, fiyat endeksi 2.40
- Kontrfile: %4.21 pay, fiyat endeksi 2.20
- Bonfile: %1.68 pay, fiyat endeksi 3.00

## Şarküteri hatları (kapasite = Pınar Et bildirimi, sipariş = 2026 Oca–Eyl ortalaması, kg/sa)
- Sucuk hattı: kapasite 750 kg/sa, ortalama sipariş 427.5 kg/sa, geçmiş plan/sipariş oranı 0.838
- Sosis-salam hattı: kapasite 889 kg/sa, ortalama sipariş 537.4 kg/sa, geçmiş plan/sipariş oranı 0.882
- Donuk burger-köfte hattı: kapasite 556 kg/sa, ortalama sipariş 310.4 kg/sa, geçmiş plan/sipariş oranı 0.962

## Optimizasyon
Optimizasyon her saat 25 üretim senaryosunu brüt kâra göre puanlar; fire ve atık ek ceza alır. Birim fiyatlar sentetik: karkas 400 ₺/kg, işleme 40 ₺/kg, lojistik 15 ₺/kg, depolama 0,4 ₺/kg·sa.
Bugünkü (klasik) plan: toplam tonaj + %8 tampon ile alım, sabit fiyat. OptiSupply planı: talep, verim, hat kapasitesi, fiyat koridoru ve depo kısıtıyla puanlanan en iyi senaryo.
Miktar, kapasite ve verimler Pınar Et verisinden (2 katına çıkarılmış); fiyatlar ve asistan mesajları örnektir.
