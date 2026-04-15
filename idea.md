studio-agent
Wiki veya RAG üstünde derlenmiş bilgiyi, NotebookLM'deki Studio benzeri şekilde, tekrar tekrar üretilebilen artifact'lara dönüştürmek için bir örüntü. Hedef, sadece sorulara cevap veren bir sistem değil; kaynaklardan türeyen briefing, FAQ, checklist, slide outline, lesson plan, worksheet, podcast script, video outline, report, explainer, interactive mini-app spec ve benzeri "çalışılabilir çıktı"lar üreten bir ajan katmanı kurmaktır.
Bu bir idea file'dır. Kendi LLM ajanına (Claude Code, Codex, OpenCode veya benzeri) kopyala-yapıştır olarak verilmek üzere tasarlanmıştır. Amacı belirli bir uygulamayı değil, yüksek seviyede örüntüyü iletmektir. Spesifikleri sen ve ajanın birlikte, kendi ürününe ve bilgi alanına göre inşa edeceksiniz.
Çekirdek fikir
Çoğu bilgi sistemi iki uçta kalır.
Birinci uç, klasik soru-cevap katmanıdır. Kullanıcı bir şey sorar, sistem kaynakları okur, cevap üretir. Bu faydalıdır ama ephemeral'dır; her etkileşim bir anda olup biter. Aynı bilgi, ertesi gün farklı formatta yeniden istenirse süreç baştan kurulur.
İkinci uç, statik içerik üretim araçlarıdır. Bir rapor, bir sunum, bir özet veya bir podcast script'i tek seferlik üretilir. Kaynaklar güncellendiğinde artifact stale olur; hangi kaynaktan türediği zamanla kaybolur; aynı içerikten farklı artifact türleri üretmek için tekrar emek gerekir.
Buradaki fikir üçüncü bir yol: bilgi tabanının üstünde, artifact üretimini birinci sınıf vatandaş yapan bir studio-agent katmanı kurmak. Sistem önce ham kaynakları Karpathy tarzı derlenmiş bir wiki'ye dönüştürür. Sonra bu wiki üstünde çalışan studio-agent, aynı bilgi çekirdeğini farklı artifact biçimlerine dönüştürür. Artifact bir son ekran görüntüsü veya tek-shot cevap değildir; versiyonlu, yeniden üretilebilir, kaynağı bilinen ve güncellendiğinde tekrar derlenebilen bir üründür.
Anahtar fark budur: klasik chatbot cevap üretir, klasik content tool dosya üretir, studio-agent ise bilgiyi artifact ailesine kompile eder. Aynı wiki'den bir briefing, bir öğretmen notu, bir flashcard seti, bir müşteri FAQ'su, bir audio overview script'i, bir slide outline'ı ve bir etkileşimli mini deneyim spesifikasyonu çıkabilir. Bilgi bir kez derlenir; artifact'lar tekrar tekrar üretilir.
Bu farkın pratik sonuçları şunlardır. Bir artifact'ın kalitesi yalnız prompt'a değil, wiki'nin derinliğine ve artifact şablonunun disiplinine bağlı olur. Artifact'lar source-aware olur; hangi wiki sayfalarından ve hangi raw kaynaklardan türedikleri görünür olur. Kaynak değişince artifact'ın stale olduğu anlaşılır. Kullanıcı yalnız "bana bunu açıkla" demez; "bunu öğrenci çalışma kağıdına çevir", "bunu müşteri brifine çevir", "bunu 5 dakikalık audio overview'a çevir", "bunu yöneticilere tek sayfalık memo yap" der. Studio-agent, sorguyu bir cevap isteği olarak değil, bir artifact üretim görevi olarak ele alır.
Ne olduğu ve ne olmadığı
Bu ürün bir genel chatbot değildir. Bir not alma uygulaması değildir. Sadece bir export menüsü de değildir.
Bu ürün, bilgi tabanının üstünde duran bir artifact compiler'dır. Merkezinde tek bir şey vardır: aynı bilgi çekirdeğini, farklı bağlamlara uygun, yeniden üretilebilir artifact'lara dönüştürmek.
Bu ürünün wiki'si source of truth değildir; raw kaynaklar source of truth'tur. Wiki, onların LLM tarafından derlenmiş ve ilişkilendirilmiş çalışma katmanıdır. Studio-agent da bu wiki'nin üstünde çalışan üretim katmanıdır.
Bu ürün bir "tek promptla sunum üret" sihirbazı değildir. Eğer artifact üretimi tamamen prompt büyüsüne dayanıyorsa, birikim yoktur. Studio-agent'ın değeri, artifact üretimini schema, provenance, lint ve re-render disiplini içine almasıdır.
Başarının sade ölçüsü şudur: aynı bilgi tabanından, çok az ek insan emeğiyle, farklı hedefler için tutarlı ve işe yarar artifact'lar üretilebiliyor mu? Eğer onuncu artifact, ilk artifact kadar el emeği istiyorsa, örüntü çalışmıyordur. Eğer artifact'lar kaynak değişiminden habersizse, yine çalışmıyordur.
Mimari
Üç katman vardır.
Raw + wiki substrate
İlk katman, Karpathy tarzı bilgi tabanıdır.
Raw kaynaklar immutable'dır: PDF'ler, dökümanlar, transkriptler, ürün notları, araştırma raporları, ders materyalleri, müşteri brief'leri, veri tabloları, iç yazışmalar, web sayfaları.
Wiki ise LLM tarafından tutulan markdown ağacıdır: kavram sayfaları, entity sayfaları, özetler, karşılaştırmalar, prosedürler, zaman çizelgeleri, glossary, contradiction notes, open questions.
Bu katman artifact üretiminin yakıtıdır. Studio-agent ham chunk'lar üstünde değil, derlenmiş wiki üstünde çalışır. Retrieval hâlâ vardır ama zaten derlenmiş, çapraz referanslı ve bakım altında bir substrate üstünden yapılır.
Artifact schema katmanı
İkinci katman, hangi artifact türlerinin var olduğunu ve her birinin nasıl üretileceğini tanımlar.
Her artifact türü kendi kontratına sahiptir:
●	input beklentisi: hangi wiki sayfaları, hangi alt-alan, hangi kullanıcı amacı
●	output formatı: markdown, html, json, script, slide-outline, qa-bank, worksheet, memo, report, narration, timeline
●	kalite kuralları: ton, uzunluk, yapı, citation disiplini, red lines
●	human-in-loop rejimi: otomatik yayınlanabilir mi, örneklem onayı mı gerekir, her seferinde insan mı bakar
●	stale kuralları: hangi kaynak değişiklikleri artifact'ı yeniden üretmeyi zorunlu kılar
Bu katman, studio-agent'ın "hangi studio işi yapabildiğini" tanımlar. NotebookLM benzeri bir studio hissi, aslında bu artifact tiplerinin iyi tanımlanmış olmasından gelir. Aksi halde ürün yalnızca farklı prompt preset'leri gösteren bir panel olur.
Runtime
Üçüncü katman, artifact üretim motorudur.
Görevi: kullanıcı isteğini anlamak, doğru artifact türüne map etmek, wiki'den ilgili sayfaları seçmek, artifact taslağını üretmek, kurallara göre lint etmek, gerekirse insana eskale etmek, artifact'ı version'lamak ve paylaşılabilir hale getirmek.
Bu katman tek bir LLM çağrısı değildir. Tipik akış şu adımları içerir:
●	niyet sınıflandırma: istek bir soru mu (rag-wiki'ye yönlendir) yoksa artifact talebi mi (studio-agent'ta tut)
●	artifact routing: istenen şey briefing mi, deck outline mı, worksheet mi, audio script mi
●	context assembly: ilgili wiki sayfalarının seçimi
●	draft generation: ilk artifact taslağı
●	verification/lint: format, kapsam, tone, kaynak, güvenlik kontrolü
●	publish/writeback: artifact metadata'sı, sürümü, kaynak bağları, stale işaretleri
Runtime, artifact üretimini cevap üretiminden ayrı bir operasyon olarak ele alır. Bu ayrım korunmazsa sistem zamanla yine "uzun cevap veren chatbot"a geri düşer.
Operasyonlar
Artifact oluşturma
Ana operasyon budur. Kullanıcı açıkça bir artifact ister:
"Bunu yönetici özeti yap." "Bu kaynaklardan 10 soruluk quiz hazırla." "Bu konuyu podcast outline'ına çevir." "Bu ürünü yeni müşteri için onboarding brief'e dönüştür." "Bu araştırmadan slide deck skeleton çıkar."
Runtime önce bunun hangi artifact tipine düştüğünü belirler. Eğer tek bir tipe yüksek güvenle map edemiyorsa iki veya üç aday önerir. Emin değilken uydurmaz; kullanıcıya artifact niyetini netleştirtir.
Artifact compile
Artifact tipi seçilince runtime, ilgili wiki sayfalarını ve gerekiyorsa raw kaynaklara ait provenance metadatasını toplar. Bu aşamada yalnızca "en yakın metinleri" çekmek yetmez; artifact yapısına göre hangi kaynak türlerinin ağırlıklı olacağı da değişir.
Bir executive memo için synthesis ve risk sayfaları önceliklidir. Bir worksheet için tanım, örnek ve misconception sayfaları önceliklidir. Bir audio overview script'i için narrative flow ve comparison sayfaları önceliklidir. Bir slide outline için section hierarchy ve visualizable claims önceliklidir.
Studio-agent burada yalnız retrieval yapmaz; artifact-aware context assembly yapar.
Lint ve gate
Artifact üretildikten sonra hemen yayınlanmaz. Her artifact tipi kendi lint pass'inden geçer.
Yapı doğru mu? Hedef kitleye uygun ton kullanılmış mı? Kaynağı olmayan iddialar var mı? Artifact tipi için zorunlu bölümler eksik mi? Kapsam dışına taşmış mı? Riskli bir artifact türünde human review zorunlu mu?
Bu gate katmanı olmadan studio-agent çok hızlı içerik üretir ama bir "artifact factory" olur; güvenilir studio olmaz.
Publish ve versioning
Başarılı artifact bir dosya olarak kaydedilir. Ama önemli olan dosyanın kendisi kadar metadata'sıdır:
●	hangi artifact türü
●	hangi wiki sayfalarından türedi
●	hangi raw kaynak hash'lerine dayanıyor
●	hangi schema sürümüyle üretildi
●	son insan onayı var mı
●	ne zaman stale olur
Artifact, tek başına içerik değildir; lineage taşıyan bir build artifact'ıdır.
Re-render
Raw kaynak veya wiki değiştiğinde, daha önce üretilmiş artifact'ların hangilerinin stale olduğu otomatik anlaşılmalıdır. Studio-agent'ın güçlü olduğu yer burasıdır: artifact yeniden yazılmaz, yeniden derlenir. Böylece "geçen ay ürettiğimiz briefing'i yeni kaynaklarla güncelle" isteği ayrı bir insan emeği gerektirmez; sistem artifact'ın türediği bağımlılık grafiğini bildiği için kontrollü re-render yapabilir.
Writeback
Artifact üretimi sadece dışa dönük değildir; içe doğru da bir writeback etkisi vardır. Sık üretilen artifact tipleri, wiki'de hangi bilgi eksiklerinin olduğunu görünür kılar.
Sürekli quiz üretiminde boşluk çıkıyorsa misconception sayfaları zayıftır. Sürekli executive memo'da "riskler" bölümü uyduruluyorsa risk sayfaları eksiktir. Sürekli audio script'ler dağınıksa wiki'de narrative synthesis eksiktir.
Yani artifact kalitesi, wiki bakımının teşhis aracına dönüşür.
Artifact aileleri
Studio-agent tek tip artifact'a kilitlenmez. Gücü, aynı substrate'den artifact ailesi üretmesidir. Örnek aileler:
Öğrenme artifact'ları
●	çalışma notu
●	flashcard seti
●	quiz / answer key
●	worksheet
●	Socratic discussion guide
●	lesson plan
●	misconception sheet
Analiz artifact'ları
●	executive memo
●	one-page brief
●	contradiction report
●	timeline
●	comparison matrix
●	risk register
●	FAQ
Sunum ve anlatı artifact'ları
●	slide outline
●	talk track
●	audio overview script
●	video overview outline
●	demo script
●	onboarding brief
●	walkthrough narrative
Etkileşimli artifact'ları
●	mini app spec
●	interactive checklist
●	decision tree
●	guided form flow
●	HTML prototype spec
Buradaki nokta şudur: studio-agent her zaman nihai çıktıyı üretmek zorunda değildir. Bazen doğrudan artifact dosyasını üretir; bazen artifact bir sonraki üretim sisteminin girdisi olur. Örneğin slide outline doğrudan sunum olmayabilir, ama slides-agent için compile edilmiş girdi olabilir.
rag-wiki ile ilişki
rag-wiki, sorgu ve doğrulama katmanıdır. Studio-agent ise artifact üretim katmanıdır.
Kullanıcı "bu nedir?" diye sorduğunda rag-wiki devreye girer. Kullanıcı "bunu briefing'e çevir" dediğinde studio-agent devreye girer.
İkisi aynı wiki üstünde yaşar ama aynı işi yapmaz. rag-wiki güvenli cevap üretmeyi optimize eder. studio-agent yeniden üretilebilir artifact üretmeyi optimize eder.
Bir artifact üretimi sırasında studio-agent, ihtiyaç duyduğu doğrulama ve kaynak kontrolü için rag-wiki'nin verification servislerini çağırabilir. Ama mimari ayrım korunmalıdır: biri query motoru, diğeri compile motorudur.
NotebookLM benzeri studio hissi de tam burada doğar: sorgu paneli ayrı bir şeydir, studio paneli ayrı bir şeydir. Kullanıcı bilgiyle konuşabilir de, bilgiyi artifact'a dönüştürebilir de. Bu ikisini aynı textarea'ya sıkıştırmak, ürünün farkını bulanıklaştırır.
demo-wiki ve tour-agent ile ilişki
demo-wiki, belirli persona ve müşteriler için hangi anlatının önemli olduğunu derleyen katmandır. Studio-agent bu derlemeden çeşitli müşteri-facing artifact'lar üretebilir:
●	sales brief
●	account summary
●	persona-specific one-pager
●	narrated walkthrough outline
●	post-meeting recap
tour-agent ise artifact'ların canlı üründe render edildiği veya oynatıldığı komşu sistemdir. Studio-agent bir walkthrough script'i veya onboarding outline'ı üretir; tour-agent bunu gerçek ürün içinde deneyime dönüştürür.
Bu yüzden studio-agent, "artifact compiler" olarak, query motoru (rag-wiki) ve canlı deneyim motoru (tour-agent) arasında orta katman rolü oynar.
Çoklu alt-alan ve izolasyon
Tek bir studio-agent her şeyi aynı artifact şablonuyla üretmemelidir. Alt-alanlar farklıdır.
Eğitim alanındaki worksheet şeması ile hukuk alanındaki memo şeması aynı olamaz. Ürün onboarding brief'i ile klinik karar özeti aynı ton, aynı gate, aynı risk modeliyle yazılamaz.
Bu yüzden artifact schema'ları subdomain bazlı olmalıdır:
●	kendi wiki yolları
●	kendi lint kuralları
●	kendi output template'leri
●	kendi onay rejimleri
●	kendi eval set'leri
Alan izolasyonu, artifact üretiminin büyüdükçe saçmalamamasının tek garantisidir.
Human-in-loop
Tüm artifact'lar eşit risk taşımaz.
Düşük riskli artifact'lar: iç çalışma notu, kişisel flashcard, taslak checklist. Bunlar otomatik üretilebilir.
Orta riskli artifact'lar: müşteri brief'i, satış one-pager'ı, eğitim materyali. Bunlarda örneklem veya hafif review gerekir.
Yüksek riskli artifact'lar: hukuki özet, medikal açıklama, yöneticiye gidecek kritik memo, dışarı yayınlanacak resmî materyal. Bunlar human approval olmadan publish edilmemelidir.
Studio-agent'ın işi yalnız artifact üretmek değil, hangi artifact'ın hangi review rejimine girdiğini bilmektir. "Hepsini üret, sonra insanlar bakar" yaklaşımı ölçeklenmez. Review rejimi artifact şemasının parçası olmalıdır.
Değerlendirme
Bir değişikliğin iyi olup olmadığını anlamak için şu soruları sor:
Aynı bilgi tabanından daha fazla artifact türü, daha az prompt emeğiyle üretilebiliyor mu? Artifact'ların yapısal kalitesi tutarlı mı, yoksa her seferinde prompt'a göre savruluyor mu? Kaynak değişiklikleri artifact stale takibini doğru tetikliyor mu? Artifact üretimi, wiki'deki boşlukları görünür kılıyor mu? Düşük riskli artifact'lar otomatik akabiliyor, yüksek riskliler doğru yerde insana takılıyor mu? Aynı artifact tipi için ikinci, üçüncü, onuncu üretim ilkine göre ucuzladı mı?
Eşit koşullarda daha sade olan kazanır. On yeni artifact butonu eklemek ilerleme değildir; iki artifact tipini gerçekten güvenilir, yeniden üretilebilir ve provenance-aware hale getirmek ilerlemedir.
Neden işe yarar
Bilgi sistemlerinin en büyük kaybı, aynı bilginin farklı bağlamlar için tekrar tekrar elle paketlenmesidir. Bir araştırma notu ayrı hazırlanır, sunum ayrı yazılır, müşteri özeti ayrı yazılır, quiz ayrı hazırlanır, sesli anlatım ayrı düşünülür. Bilgi bir kez toplanır ama çıktılar tekrar tekrar el emeğiyle üretilir.
Studio-agent bu tekrarın büyük bölümünü compile problemine çevirir. Bilgi önce wiki'de derlenir. Sonra farklı artifact'lar bu bilgi çekirdeğinden üretilir. Artifact türleri ve şemaları netleştikçe sistem hızlanır; her yeni artifact, aynı zamanda bir sonraki artifact üretimini ucuzlatır.
Bu sayede bilgi tabanı sadece okunacak bir yer olmaktan çıkar; sürekli çalışan bir yayın ve üretim motoruna dönüşür. Soru cevaplama önemini korur, ama tek arayüz olmaktan çıkar. Asıl değer, bilginin kullanılabilir formlara dönüşmesindedir.
Not
Bu doküman kasıtlı olarak soyuttur. Artifact türlerinin tam listesi, schema formatı, publish API'si, HTML artifact render katmanı, slides veya audio pipeline entegrasyonu, stale detection mekanizması, provenance frontmatter şeması — bunların hepsi mevcut kod tabanına, altyapıya ve alan riskine bağlıdır.
Bu idea file, studio-agent'ın ne yapması gerektiğini ve ne olmaması gerektiğini hizalamak için vardır; tek bir uygulama reçetesi vermek için değil.
Bu dokümanı LLM ajanına ver, mevcut repo state'ini okumasını iste ve birlikte ilk küçük ama gerçek artifact ailesini seçin. Önce bir veya iki artifact tipini gerçekten doğru yapın. Merkez kaybolursa ürün, uzun cevap üreten bir chatbot'a döner. Merkez korunursa, wiki zamanla bir studio'ya dönüşür.


