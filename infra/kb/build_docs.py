"""Bedrock Knowledge Base belgelerini iki kaynak HTML dosyasından üretir.

Yalnızca dosyalarda yazılı olan bilgiler kullanılır (rehber metni, HACCP kontrol noktaları,
onay matrisi, aksiyon tanımları, Ocak–Eylül 2026 veri raporu, model varsayımları).
Kullanım: python3 infra/kb/build_docs.py
Not: iki kaynak HTML dosyası repoda yoktur; yeniden üretmek için proje köküne koyun.
Üretilmiş belgeler infra/kb/docs/ altında hazırdır.
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'infra' / 'kb' / 'docs'
MAIN = (ROOT / 'OptiSupply_Dijital_Ikiz.html').read_text(encoding='utf-8')
GUIDE = (ROOT / 'OptiSupply_Dijital_Ikiz_Rehberi.html').read_text(encoding='utf-8')
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*.md'): old.unlink()


def text_of(fragment: str) -> str:
    fragment = re.sub(r'<(style|script)[\s\S]*?</\1>', ' ', fragment)
    fragment = re.sub(r'<br\s*/?>|</(p|li|h1|h2|h3|tr|div|section)>', '\n', fragment)
    fragment = re.sub(r'<[^>]+>', ' ', fragment)
    lines = [re.sub(r'[ \t]+', ' ', html.unescape(l)).strip() for l in fragment.split('\n')]
    return '\n'.join(l for l in lines if l)


def write(name: str, title: str, body: str):
    (OUT / name).write_text(f'# {title}\n\nKaynak: OptiSupply dijital ikiz (Pınar Et) proje dosyaları.\n\n{body.strip()}\n', encoding='utf-8')


# 1) Kullanım rehberi
body = GUIDE[GUIDE.find('<body'):]
write('01_rehber.md', 'OptiSupply dijital ikiz kullanım rehberi', text_of(body))

# 2) HACCP kritik kontrol noktaları
ccp_src = re.search(r'var CCPS=\[([\s\S]*?)\];', MAIN).group(1)
rows = []
for m in re.finditer(r"\{id:'([^']+)',node:'[^']*',ad:'([^']+)',teh:'([^']+)',lim:'([^']+)',izl:'([^']+)',src:'([^']+)'", ccp_src):
    rows.append(f'| {m.group(1)} | {m.group(2)} | {m.group(3)} | {m.group(4)} | {m.group(5)} | {m.group(6)} |')
note = text_of(re.search(r'KKN-2 ve KKN-3 limitleri[\s\S]*?Codex CXC 1-1969\.', MAIN).group(0))
write('02_haccp_kontrol_noktalari.md', 'HACCP kritik kontrol noktaları (KKN)',
      'Kabulden sucuk hattına 7 kritik kontrol noktası izlenir. Sınır aşılırsa ilgili saatin partisi sevkiyattan önce otomatik bekletilir.\n\n'
      '| Kod | Nokta | Tehlike | Kritik limit | İzleme | Kaynak |\n|---|---|---|---|---|---|\n' + '\n'.join(rows) + '\n\n' + note)

# 3) Onay matrisi, aksiyonlar ve red gerekçeleri
appr = re.findall(r"\['([^']+)','([^']+)','([^']+)',(?:env\.pending|String|')", MAIN[MAIN.find("var A=[['Parçalama"):MAIN.find("var at=document.getElementById('apprT')")])
shocks = re.search(r'var SHOCKS = \{([\s\S]*?)\n\};', MAIN).group(1)
acts = []
for sm in re.finditer(r"(\w+):\{title:'([^']+)'[\s\S]*?plan:\[([\s\S]*?)\]\}", shocks):
    items = re.findall(r"\{id:'(\w+)',t:'([^']+)',a:'([^']+)'\}", sm.group(3))
    acts.append(f"## Şok: {sm.group(2).replace(chr(8217), chr(39))}\n" + '\n'.join(f'- {t} (sorumlu: {a}; aksiyon kodu {i})' for i, t, a in items))
reasons = re.findall(r"(\w+):'([^']+)'", re.search(r'var FLAG_REASONS = \{([\s\S]*?)\};', MAIN).group(1))
write('03_onay_ve_aksiyonlar.md', 'Onay matrisi, şok aksiyonları ve red gerekçeleri',
      'Son kararı insan verir. Ajanlar öneri hazırlar; onay kartında yönetici onaylar, reddeder ya da sonraya bırakır. '
      'Reddedilen aksiyon gerekçesiyle hafızaya yazılır ve plan o aksiyon olmadan yeniden kurulur.\n\n'
      '## Kim neyi onaylar?\n| Karar | Onaylayan | Ajanın rolü |\n|---|---|---|\n' + '\n'.join(f'| {a} | {b} | {c} |' for a, b, c in appr) +
      '\n\n# Şoklara göre önerilebilecek aksiyonlar\n' + '\n\n'.join(acts) +
      '\n\n## Standart red gerekçeleri\n' + '\n'.join(f'- {k}: {v}' for k, v in reasons) +
      '\n\n## Fiyat kuralı\nFazla olan parçada fiyat iner, az olanda çıkar; normalde ±%8 koridorda kalır. Koridoru ±%15’e açmak insan onayı gerektirir. Bugünkü planda fiyat sabittir.')

# 4) Veri raporu (Ocak–Eylül 2026) — her bölüm ayrı belge, aramada tek parça dönsün
real = json.loads(re.search(r'var REAL=(\{.*?\});\n', MAIN).group(1))
head = 'Dana içerikli ürünler, Ocak–Eylül 2026, ton. Veri 2 katına çıkarılmıştır.'
write('04_veri_raporu_ozet.md', 'Veri raporu özeti: dana ürünleri Ocak–Eylül 2026',
      head + f"\nSKU sayısı: {real['skuN']}. Kırmızı et stokunda donuk payı: %{real['kmDonukPay']}.\n\n## Tahmin hatası (WMAPE, %)\n" +
      '\n'.join(f'- {k}: %{v}' for k, v in real['wmape'].items()))
write('04_acik_siparis_ve_stok.md', 'En çok açık sipariş ve en yüksek stok olan ürünler (Ocak–Eylül 2026)',
      head + '\n\n## En çok açık sipariş olan ürünler (9 ay toplamı, ton)\n' +
      '\n'.join(f'{i+1}. {b} ({a}): {c} t açık sipariş' for i, (a, b, c) in enumerate(real['acikTop'][:12])) +
      '\n\n## En yüksek Eylül sonu stoku olan ürünler (ton)\n' +
      '\n'.join(f'{i+1}. {b} ({a}): {c} t stok' for i, (a, b, c) in enumerate(real['stokTop'][:12])))
for n, (fam, d) in enumerate(real['fam'].items()):
    t = [f'| Ay | Satış tahmini | Plan | Üretim | Sipariş | Sevk | Ay sonu stok |', '|---|---|---|---|---|---|---|']
    for i, ay in enumerate(real['ay']):
        g = lambda k: d.get(k, [None] * 9)[i]
        t.append(f"| {ay} | {g('tahmin')} | {g('plan')} | {g('uretim')} | {g('siparis')} | {g('sevk')} | {g('aysonu')} |")
    tot = {k: round(sum(x for x in d.get(k, []) if x is not None), 1) for k in ('tahmin', 'plan', 'uretim', 'siparis', 'sevk')}
    write(f'04_rapor_{n+1}_{re.sub(r"[^a-z]", "", fam.lower().replace("ı","i").replace("ş","s").replace("ğ","g").replace("ö","o").replace("ü","u").replace("ç","c"))}.md',
          f'Aylık rapor: {fam} (Ocak–Eylül 2026, ton)',
          head + f"\n\n9 ay toplamı: satış tahmini {tot['tahmin']} t, plan {tot['plan']} t, üretim {tot['uretim']} t, sipariş {tot['siparis']} t, sevk {tot['sevk']} t. Tahmin hatası (WMAPE) %{real['wmape'].get(fam,'-')}.\n\n" + '\n'.join(t))

# 5) Model varsayımları (ekranda ve kodda yazılı olanlar)
parts = re.findall(r"\{k:'\w+',\s*n:'([^']+)',\s*share:([\d.]+),\s*price:([\d.]+)", MAIN)
lines_src = re.findall(r"(\w+):\{n:'([^']+)', cap:(\d+), dem:([\d.]+), plan:([\d.]+)", MAIN)
opt_note = text_of(re.search(r'Optimizasyon her saat 25 üretim senaryosunu[\s\S]*?·sa\.', MAIN).group(0))
write('05_model_varsayimlari.md', 'Dijital ikiz model varsayımları',
      'Karkas ağırlığı 280 kg. Karkas/canlı verimi %55. Parçalama dağılımı (Pınar Et): satış %30, imalat %54,2, rendering %15,5, fire %0,3.\n'
      'Karkas bütün alınır: bir parçanın talebi için alınan hayvan diğer parçaları da üretir. Fazla parça sucuk, sosis-salam ve donuk burger-köfte hatlarına yönlendirilebilir.\n\n'
      '## Parça verimleri (karkas payı) ve göreli fiyat endeksi\n' + '\n'.join(f'- {n}: %{float(s)*100:.2f} pay, fiyat endeksi {p}' for n, s, p in parts) +
      '\n\n## Şarküteri hatları (kapasite = Pınar Et bildirimi, sipariş = 2026 Oca–Eyl ortalaması, kg/sa)\n' +
      '\n'.join(f'- {n}: kapasite {c} kg/sa, ortalama sipariş {d} kg/sa, geçmiş plan/sipariş oranı {p}' for _, n, c, d, p in lines_src) +
      '\n\n## Optimizasyon\n' + opt_note +
      '\nBugünkü (klasik) plan: toplam tonaj + %8 tampon ile alım, sabit fiyat. OptiSupply planı: talep, verim, hat kapasitesi, fiyat koridoru ve depo kısıtıyla puanlanan en iyi senaryo.\n'
      'Miktar, kapasite ve verimler Pınar Et verisinden (2 katına çıkarılmış); fiyatlar ve asistan mesajları örnektir.')

for f in sorted(OUT.iterdir()):
    print(f.name, f.stat().st_size)
