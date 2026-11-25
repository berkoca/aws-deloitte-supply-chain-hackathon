# OptiSupply dijital ikiz kullanım rehberi

Kaynak: OptiSupply dijital ikiz (Pınar Et) proje dosyaları.

OptiSupply · Pınar Et
Dijital ikiz: nasıl çalışır, nerede ne var?
Dijital ikiz, fabrikanın ekrandaki canlı kopyasıdır. Aynı siparişlerle iki plan yan yana çalışır: OptiSupply planı ve bugünkü plan . Aradaki fark, OptiSupply’ın ne kazandırdığını gösterir.
Mantık Üst bar Canlı fabrika Onay kartı Plan ve fiyat Kalite Kazanç Yönetim ekranı Daha fazla Asistan 5 dakikalık demo Kısayollar
Tek cümlede mantık
1 · Sipariş gelir
Taze et, sucuk, salam ve köfte siparişleri saat saat gelir.
2 · Asistanlar plan yapar
8 yapay zekâ asistanı kaç hayvan kesileceğini, parçaların nereye gideceğini ve fiyatı konuşur, tek plan çıkarır.
3 · İnsan onaylar
Plan onay kartıyla gelir. Onaylarsınız, reddedersiniz ya da sonraya bırakırsınız.
4 · Fark ölçülür
Aynı veriyle bugünkü plan da arkada çalışır; ekranlar ikisini karşılaştırır.
Ana ekranın haritası
1 Üst bar: saat · OptiSupply / Bugünkü plan · Demoyu oynat · Duraklat · Bildirim · Menü
2 Sekmeler: Canlı fabrika · Plan ve fiyat · Kalite · Kazanç · Yönetim ekranı · Daha fazla ▾
3 4 gösterge: Boşa giden parça · Karşılanan sipariş · Karşılanamayan sipariş · Kâr
4 4 sürpriz düğmesi: Biftek siparişi · Kurban · Karantina · Depo arızası
5 3B fabrika Kamera düğmeleri sağ üstte · soğuk zincir sensörleri sol altta
6 Asistanlar paneli “Neden bu karar?” · asistanlar ne konuşuyor
1 Üst bar Saat simülasyonun saatidir (hafta, gün, saat). OptiSupply planı / Bugünkü plan düğmesi 3B fabrikada hangi planın gösterileceğini seçer. Demoyu oynat 8 adımlık otomatik gösterimi başlatır. Duraklat zamanı durdurur. Zil, alarmları ve onay bekleyen planları toplar. Menü de hız (1×, 2×, 4×), sunum modu, açık zemin, tam ekran, Excel’e aktarma, rehber ve sıfırlama var.
2 Sekmeler Beş ana sayfa ve “Daha fazla” altında üç ek sayfa: Soğuk zincir ve ret, Geçmiş, Veri raporu.
3 Göstergeler Son 24 saatte iki planın sonucu yan yana: solda OptiSupply (mavi), sağda bugünkü plan (turuncu). Üstteki ▲ / ▼ fark yazısı hangisinin önde olduğunu söyler. Alttaki çizgi son saatlerin seyridir.
4 Sürpriz düğmeleri Gerçek hayatta olabilecek bir olayı başlatır. Asistanlar hemen konuşmaya başlar ve yeni planı onaya getirir. Klavyede 1 – 4 ile de basılır.
5 3B fabrika Hayvan nakil aracından kabul, kesim, parçalama, soğuk depo, sucuk-salam-köfte hatları ve kamyonla sevkiyata kadar akış. Fareyle sürükleyip döndürün, tekerlekle yakınlaşın. Sağ üstte Genel · Tedarik · Depo · Hatlar · Kamera turu . Sol altta taze depo ve dondurucu sıcaklıkları; sınır aşılırsa kırmızıya döner.
6 Asistanlar Yuvarlak kısaltmalar 8 asistandır (OR = koordinatör, TA = talep, FY = fiyat …). Konuşan asistan mavi yanar. “Asistanlar ne konuşuyor?” akışında her mesajın altında Neden? var. Neden bu karar? o saatin kararını hangi veri, hangi sınır ve hangi seçenekle verdiğini açar.
Onay kartı
Bir sürpriz olunca göstergelerin altında sarı bir şerit çıkar: “OptiSupply’ın yeni planı onayınızı bekliyor” .
A Onay kartını aç Planın gerekçesi, yapılacak işler ve beklenen etkisi (sipariş, kâr, kayıp) görünür.
B Onayla ve uygula Plan devreye girer, fabrika yeni plana göre dengelenir.
C Reddet Hangi öneriyi neden istemediğinizi seçersiniz. Asistan bunu aklında tutar ve planı yeniden kurar. Bu, “son kararı insan verir” mesajının canlı kanıtıdır.
D Telefonda gör Aynı onayın yöneticinin telefonuna (Teams) nasıl düşeceğini gösterir.
Plan ve fiyat
Ya şöyle olursa?
Üç kaydırıcı: karkas alış fiyatı, toplam talep ve soğuk depo kapasitesi. Kaydırdığınız anda iki plan yeniden hesaplanır.
Akıllı fiyat
Her parçanın önerilen fiyatı. Fazla olan parçada fiyat iner, az olanda çıkar; normalde ±%8 aralıkta kalır. Bugünkü planda fiyat sabittir.
Parça durumu
Karkas haritası üzerinde hangi parçanın yettiği, hangisinin fazla ya da eksik olduğu renkle görünür.
Kalite
Hijyen ve sıcaklık kontrol noktaları
Kabulden sucuk hattına 7 kritik nokta (HACCP). Her birinin sınırı, anlık değeri ve durumu. Örnek: karkas iç sıcaklığı en fazla 7 °C.
Sevkiyata hazır partiler
Paketlenen her parti burada onay bekler. Serbest bırak ya da Beklet . Sorunlu saatin partisi otomatik bekletilir.
Kim neyi onaylar?
Hangi kararı kimin onayladığı (üretim, satış, kalite) ve bekleyen onay sayısı. Paketleme temposu “göster” bağlantısının altında.
Kazanç
OptiSupply ne kazandırdı?
Bugünkü plana göre ek kâr ve bu kârın nereden geldiği: daha çok karşılanan sipariş, daha az boşa giden parça, fiyat etkisi.
Gelir ve gider
Son 24 saatin gelir-gider tablosu, iki plan yan yana. Fiyatlar örnektir.
Yönetim ekranı
Üst sağda dönem seçilir: Dün · Önceki gün · Bu hafta · Geçen hafta · 30 gün . Ekran içinde Özet / Ayrıntı ve OptiSupply / Bugünkü plan seçimi var.
Ö Özet Giren canlı hayvan, çıkan ürün, karşılanan sipariş, kâr, boşa giden parça, karşılanamayan sipariş ve OptiSupply’ın ek kârı. Altta giren-çıkan ürün grafiği ve hedef / OptiSupply / bugünkü plan kâr grafiği. Her kartta “plana göre” sapma yazar.
A Ayrıntı Hangi kanala ne gitti (market, otel-restoran, ihracat, online), ek kâr nereden geldi ve parça başına kâr tablosu.
Daha fazla ▾
Soğuk zincir ve ret
Son 48 saatin depo sıcaklık grafiği, alarm kayıtları, bölümlere giren-çıkan ürün ve karşılanamayan / reddedilen ürün.
Geçmiş
Son 30 günün gün gün ek kâr takvimi (güne tıklayın), biriken ek kâr ve haftalık özet. Excel’e aktarılabilir.
Veri raporu
Ocak–Eylül 2026 dana ürünleri verisinden: hat doluluğu, sipariş-plan-sevk, et stoku ve en çok açık sipariş olan ürünler (2 katına çıkarılmış veri).
Asistan (sağ alt köşedeki robot)
Tıklayınca sohbet penceresi açılır. Hazır sorulardan birine basın ya da yazın: “Antrikot neden eksik?” , “Bu hafta ne kazandık?” . Cevaplar ikizin o anki verisinden hazırlanır.
5 dakikalık demo akışı
İsterseniz Demoyu oynat ile 8 adımı otomatik izletin. Elle sunmak için önerilen sıra:
Canlı fabrika · Kamera turu Fabrikayı tanıtın: hayvan girer, kesilir, parçalanır, depoya ve hatlara gider, kamyonla çıkar. “Bu, fabrikamızın canlı kopyası. Aynı siparişlerle iki plan yan yana çalışıyor.”
Göstergeler 4 göstergede mavi ve turuncu rakamları gösterin. “Mavi OptiSupply, turuncu bugünkü yöntemimiz. Boşa giden parçaya bakın: mavi rakam turuncunun çok altında.”
Sürpriz 1 · Restoranlardan biftek siparişi Düğmeye basın; asistanlar konuşmaya başlar, sarı onay şeridi çıkar. “Ani bir sipariş geldi. Asistanlar birkaç saniyede yeni plan hazırladı ve bize soruyor.”
Onay kartı · Neden? · Reddet Kartı açın, gerekçeyi gösterin, bir öneriyi reddedip neden seçin, sonra yeni planı onaylayın. “Sistem öneriyor, karar bizim. Reddettiğimiz şeyi de öğreniyor.”
Bugünkü plan’a geçin Üst bardan “Bugünkü plan”a basın; depoda biriken parçaları gösterin, sonra geri dönün.
Sürpriz 4 · Soğuk depo arızası → Kalite Sensör kırmızıya döner; Kalite sekmesinde partinin bekletildiğini gösterin. “Sıcaklık sınırı aşıldı; o saatin partisi sevkiyattan önce durdu.”
Yönetim ekranı · 30 gün Ay sonunda ne planladık, ne oldu, ne kazandık. “Bir ayda aynı hayvan ve aynı makineyle daha çok sipariş ve daha çok kâr.”
Asistan Robot düğmesinden bir soru sorun ve kapatın.
Klavye kısayolları
Tuş Ne yapar
Boşluk Oynat / duraklat
1 – 4 Sürpriz düğmeleri
M OptiSupply planı ↔ bugünkü plan
T Kamera turu
Bilmeniz gerekenler
İnternet gerekir. 3B fabrika ve Excel’e aktarma, açılışta internetten yükleniyor. İnternet yoksa göstergeler ve asistanlar çalışır, 3B sahne görünmez. Sunumdan önce aynı bilgisayar ve aynı ağda bir kez deneyin.
Rakamlar deneme hesabıdır. Miktar, kapasite ve verimler Pınar Et verisinden (2 katına çıkarılmış); fiyatlar ve asistan mesajları örnektir.
Sıfırlamak için Menü → Sıfırla. Simülasyon başa döner.
