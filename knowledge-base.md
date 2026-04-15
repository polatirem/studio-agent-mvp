# İstatistiksel Analiz Knowledge Base
# İstatistiksel Analiz Knowledge Base 
> **Kaynak:** 3 ayrı istatistiksel rapor (Tanımlayıcı, Bağımsız Tek Grup, 
Bağımlı Veri Analizi) 
> **Analiz Ortamı:** R programlama dili v4.5.0 
> **Normallik Testi:** Kolmogorov-Smirnov 
> **Anlamlılık Düzeyi:** p < 0.05 
> **Analiz Sorumlusu:** eistatistik.com üyesi istabot.com --- 
## 1. GENEL BİLGİLER 
### Örneklem - **n = 240** 
### Değişkenler 
| Değişken Adı | Tür | Açıklama | 
|---|---|---| 
| id | Nicel (Tanımlayıcı) | Katılımcı kimlik numarası (1–240) | 
| f1 | Nitel (Kategorik) | 4 düzeyli kategorik değişken (G1, G2, G3, G4) 
| 
| recoded_f1 | Nicel (Dönüştürülmüş) | f1'in yeniden kodlanmış sayısal 
versiyonu (1–4) | 
| dp1 | Nicel (Sürekli) | Bağımlı değişken / birincil ölçüm (Zaman 1) | 
| cov1 | Nicel (Sürekli) | Kovaryat / ikincil ölçüm (Zaman 2) | 
### Dağılım Bilgisi - **dp1:** Normal dağılıma **uymuyor** (non-parametrik testler 
uygulanmış) - **cov1:** Normal dağılıma **uyuyor** (parametrik testler uygulanmış) - **id:** Normal dağılıma **uymuyor** - **recoded_f1:** Normal dağılıma **uymuyor** --- 
## 2. TANIMLAYICI İSTATİSTİKLER (Rapor 1) 
### 2.1 Nicel Değişkenler 
| Değişken | n | Ortalama | Std. Sapma | Ortanca | Min | Maks | Q1 | Q3 | 
|---|---|---|---|---|---|---|---|---| 
| id | 240 | 120.5 | 69.426 | 120.5 | 1 | 240 | 60.75 | 180.25 | 
| recoded_f1 | 240 | 2.5 | 1.12 | 2.5 | 1 | 4 | 1.75 | 3.25 | 
| dp1 | 240 | 72.791 | 18.954 | 70.456 | 41.096 | 122.588 | 56.582 | 
87.769 | 
| cov1 | 240 | 35.025 | 8.128 | 35.047 | 18 | 60.283 | 29.275 | 40.163 | 
#### Öne Çıkan Bulgular - **dp1** geniş bir yayılım gösteriyor (aralık: 41.096 – 122.588, ~81.5 
birim) - **cov1** daha dar bir yayılıma sahip (aralık: 18 – 60.283, ~42.3 birim) - **dp1 ortalaması (72.791)** cov1 ortalamasının (35.025) yaklaşık **2.08 
katı** - dp1'de IQR = 31.187 (Q1:56.582 – Q3:87.769) - cov1'de IQR = 10.888 (Q1:29.275 – Q3:40.163) 
### 2.2 Nitel Değişkenler (f1) 
| Kategori | Frekans | Yüzde (%) | 
|---|---|---| 
| G1 | 60 | 25 | 
| G2 | 60 | 25 | 
| G3 | 60 | 25 | 
| G4 | 60 | 25 | 
#### Öne Çıkan Bulgular - 4 grup **eşit dağılmış** (her biri n=60, %25) - Dengeli tasarım (balanced design) --- 
## 3. BAĞIMSIZ TEK GRUP ANALİZİ (Rapor 2) 
### Referans Değer: 1 
### Test Seçim Kriterleri - Normal dağılıma **uymayan** değişkenler → **Runs Test** - Normal dağılıma **uyan** değişkenler → **T-test** 
### Analiz Sonuçları 
| Değişken | Referans | Ort ± SS | Ortanca (Min:Maks) | n | Test | Test 
İst. | p | EB (d) | %95 GA | 
|---|---|---|---|---|---|---|---|---|---| 
| id | 1 | 120.5 ± 69.426 | 120.5 (1:240) | 240 | Runs Test | 0.000 | 
1.000 | 0.000 | [-0.127 : 0.127] | 
| recoded_f1 | 1 | 2.5 ± 1.12 | 2.5 (1:4) | 240 | Runs Test | 0.000 | 
0.000 | 0.000 | [-0.127 : 0.127] | 
| dp1 | 1 | 72.791 ± 18.954 | 70.456 (41.096:122.588) | 240 | Runs Test | 
0.000 | 1.000 | 0.000 | [-0.127 : 0.127] | 
| cov1 | 1 | 35.025 ± 8.128 | 35.047 (18:60.283) | 240 | T-test | 64.852 
| <0.001 *** | 4.186 | [1.000 : 1.000] | 
### Etki Büyüklüğü Tablosu (Cohen's d) 
| Değişken | d değeri | Yorumu | 
|---|---|---| 
| id | 0.000 | Etki yok | 
| recoded_f1 | 0.000 | Etki yok | 
| dp1 | 0.000 | Etki yok | 
| cov1 | **4.186** | **Çok büyük etki** (d > 0.8 = büyük) | 
### Öne Çıkan Bulgular - **cov1** referans değer 1'den **istatistiksel olarak anlamlı şekilde 
farklıdır** (p<0.001) - cov1 için Cohen's d = **4.186** → Çok büyük etki büyüklüğü (huge 
effect) - cov1 ortalama değeri (35.025), referans değerden (1) **35 kat** fazla - Diğer üç değişken (id, recoded_f1, dp1) referans değerden anlamlı 
farklılık göstermiyor (tümü p=1.000) - Normal dağılmayan değişkenlerde Runs Test, normal dağılan cov1'de T
test kullanılmış --- 
 
## 4. BAĞIMLI VERİ ANALİZİ (Rapor 3) 
 
### Karşılaştırılan Ölçüm: Ankastre (dp1 vs cov1 — Zaman 1 vs Zaman 2) 
 
### Test: Wilcoxon İşaretli Sıralar Testi 
(Bağımlı, normal dağılıma uymayan veriler için) 
 
### Sonuçlar 
 
| Parametre | Zaman 1 | Zaman 2 | 
|---|---|---| 
| Ortanca | **70.456** | **35.047** | 
| Minimum | 41.096 | 18 | 
| Maksimum | 122.588 | 60.283 | 
| Sıra Ortalaması | 2 | 1 | 
 
| İstatistik | Değer | 
|---|---| 
| Korelasyon (r) | 0.236 | 
| Test İstatistiği (W) | 28920.000 | 
| p değeri | **< 0.001** | 
| Etki Büyüklüğü (r) | **-0.613** | 
| %95 GA (EB) | [-0.686 : -0.527] | 
 
### Etki Büyüklüğü Yorumu (Eşli Korelasyon r) 
 
| r aralığı | Yorum | 
|---|---| 
| 0.10 | Küçük etki | 
| 0.30 | Orta etki | 
| 0.50+ | Büyük etki | 
| **-0.613** | **Büyük negatif etki** | 
 
### Öne Çıkan Bulgular - Zaman 1'den Zaman 2'ye ortanca değer **%50.3 azalmış** (70.456 → 
35.047) - İki ölçüm arasındaki fark **istatistiksel olarak anlamlı** (p<0.001) - Etki büyüklüğü r = **-0.613** → **Büyük negatif etki** (değerler önemli 
ölçüde düşmüş) - İki zaman noktası arasındaki korelasyon **düşük** (r = 0.236) - Negatif yönlü etki: Zaman 2 değerleri sistematik olarak Zaman 1'den 
düşük - Güven aralığı [-0.686 : -0.527] tamamen negatif bölgede → tutarlı ve 
güvenilir düşüş 
 --- 
 
## 5. DEĞİŞKENLER ARASI İLİŞKİ HARİTASI 
 
``` 
dp1 (Zaman 1)  ──── Wilcoxon ────▶  cov1 (Zaman 2) 
  Ortanca: 70.456                     Ortanca: 35.047 
  Ort: 72.791                         Ort: 35.025 
                    ▼ 
              Δ = -35.409 (ortanca farkı) 
              %50.3 azalma 
              r = -0.613 (büyük etki) 
``` 
p < 0.001 --- 
## 6. KULLANILAN İSTATİSTİKSEL YÖNTEMLER ÖZETİ 
| Yöntem | Kullanım Amacı | Uygulanan Değişken(ler) | 
|---|---|---| 
| Kolmogorov-Smirnov | Normallik testi | Tüm nicel değişkenler | 
| Runs Test | Referans değerle karşılaştırma (non-parametrik) | id, 
recoded_f1, dp1 | 
| T-test (Tek Örneklem) | Referans değerle karşılaştırma (parametrik) | 
cov1 | 
| Wilcoxon İşaretli Sıralar | Bağımlı iki ölçüm karşılaştırma (non
parametrik) | dp1 vs cov1 (Ankastre) | 
### Gösterim Formatları - **Nicel (Tanımlayıcı):** Ortalama ± Standart Sapma, Ortanca (Min:Maks), 
Ortanca (Q1:Q3) - **Kategorik:** Frekans ve Yüzde (%) - **Bağımsız Test:** Cohen's d [%95 GA] - **Bağımlı Test:** Eşli Korelasyon r [%95 GA] --- 
## 7. İNFOGRAFİK / VISUAL ABSTRACT İÇİN ANAHTAR MESAJLAR 
1. **Dengeli Tasarım:** 240 katılımcı, 4 eşit grup (n=60) 
2. **Dramatik Düşüş:** Zaman 1→2 arasında ortanca değerde %50.3 azalma 
3. **Büyük Etki:** Bağımlı analizde r = -0.613 (büyük negatif etki) 
4. **cov1 Anomalisi:** Referans değer 1'den devasa sapma (d = 4.186) 
5. **Tutarlı Sonuç:** %95 GA tamamen negatif bölgede → güvenilir düşüş 
6. **Çift Yönlü Kanıt:** Hem bağımsız hem bağımlı analizler anlamlı sonuç 
(p<0.001) --- 
## 8. GÖRSEL ÖNERİLERİ 
| Veri / Bulgu | Uygun Görsel Tipi | 
|---|---| 
| Grup dağılımı (f1: G1-G4) | Pasta/Donut grafik | 
| dp1 vs cov1 dağılımları | Box plot (yan yana) | 
| Zaman 1 → Zaman 2 değişim | Ok diyagramı / Slope chart | 
| Etki büyüklükleri | Forest plot / Bar chart | 
| Değişken tanımlayıcıları | Özet tablo / Infographic panel | 
| Analiz akışı | Flowchart (test seçim süreci) | 
| %50.3 azalma | Büyük yüzde göstergesi (hero metric) |