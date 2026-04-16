# Studio Agent

Bu belge IDEA standardını takip eder. Amaç, geliştirilen sistemin ne yaptığını değil, neden var olması gerektiğini ve hangi problemi çözdüğünü açıklamaktır.

---

## 1. Tez (Thesis)

Yapay zeka çağında içerik üretmek ucuzlamış, ancak bu içeriklerin doğruluğu ve güvenilirliği ciddi bir problem haline gelmiştir.

Gerçek değer artık “içerik üretmek” değil, **veriye bağlı, izlenebilir ve farklı formatlara dönüştürülebilen bilgi üretmektir.**

Studio Agent, bir bilgi kaynağını alıp onu farklı formatlarda (özet, analiz, eğitim materyali, sunum vb.) **halüsinasyonsuz ve kontrol edilebilir şekilde artifactlere dönüştüren bir sistemdir.**

---

## 2. Problem

Günümüzde bilgi işleme süreçlerinde şu problemler bulunmaktadır:

### 2.1 Hallucination Problemi

AI sistemleri çoğu zaman veride olmayan bilgileri üretir. Bu durum özellikle analiz ve karar destek süreçlerinde ciddi risk oluşturur.

### 2.2 Tek Format Problemi

Bir bilgi kaynağı genellikle tek formatta kalır (metin). Aynı veriden:

* sunum
* özet
* test
* analiz

üretmek manuel ve zaman alıcıdır.

### 2.3 İzlenebilirlik Eksikliği

Üretilen içeriklerin hangi veriye dayandığı çoğu zaman belirsizdir. Bu durum güvenilirliği düşürür.

### 2.4 Bilgi → Ürün Dönüşüm Eksikliği

Ham bilgi, çoğu zaman doğrudan kullanılabilir bir yapıya (artifact) dönüşmez.

---

## 3. Nasıl Çalışır (How It Works)

Studio Agent, klasik “chatbot” mantığından farklı olarak **pipeline tabanlı çalışır**:

```text
knowledge-base
→ fact extraction
→ fact layer
→ artifact generation
→ UI rendering
```

### Temel İçgörü 1 — Fact Layer

Sistem doğrudan metinden üretim yapmaz. Önce veriyi parçalar ve anlamlı bir fact layer oluşturur.

### Temel İçgörü 2 — Çoklu Artifact Üretimi

Aynı veri kaynağından:

* executive summary
* insight brief
* quiz
* FAQ
* worksheet
* slide deck

üretilir.

### Temel İçgörü 3 — Confidence Sistemi

Her üretilen bilgi için güvenilirlik hesaplanır:

* yüksek → sayısal veri
* orta → açık ifade
* düşük → zayıf çıkarım

### Temel İçgörü 4 — Traceability

Her çıktı, hangi veri bölümünden geldiğini belirtir.

---

## 4. Ne Yapmaz (What It Does Not Do)

* Veride olmayan bilgi üretmez
* Açık uçlu chatbot gibi davranmaz
* Rastgele içerik üretmez
* Kaynağı belirsiz analiz yapmaz

---

## 5. Neden Şimdi (Why Now)

* LLM’ler içerik üretimini ucuzlatmıştır
* Ancak güvenilirlik problemi artmıştır
* Bilgi → karar sürecinde doğruluk kritik hale gelmiştir

Bu nedenle:

> “kontrollü üretim sistemleri” önem kazanmıştır

---

## 6. Kimler Kullanır (Who Benefits)

* Öğrenciler → öğrenme materyali üretimi
* Girişimciler → fikir analizi
* Analistler → veri yorumlama
* Karar vericiler → hızlı özet ve içgörü

---

## 7. Özet (Summary)

Studio Agent, bir bilgi kaynağını alıp onu farklı kullanım senaryolarına uygun artifactlere dönüştüren, veriye bağlı çalışan ve güvenilirliği ön planda tutan bir sistemdir.

Amaç, bilgiyi sadece depolamak değil, onu **kullanılabilir ve anlamlı hale getirmektir.**
