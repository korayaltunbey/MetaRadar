# MetaRadar Gizlilik Politikası

Son güncelleme: 5 Ekim 2026

## Genel Bakış

MetaRadar, temel sayfa içi SEO ve metadata bilgilerini inceleyen bir Manifest V3 Chrome eklentisidir. Popup'ını açtığınızda veya yeniden kontrol istediğinizde aktif web sayfasının seçili bilgilerini cihazınızda yerel olarak işler.

## MetaRadar Ne Yapar?

MetaRadar mevcut sayfanın seçili bilgilerini okur ve anlaşılır kontrol sonuçlarını popup'ında gösterir. Arka planda gezinmeyi izlemez ve sayfayı değiştirmez.

## Yerel Olarak İşlenen Bilgiler

Bir kontrol sırasında MetaRadar şunları okuyabilir:

- Sayfayı tanımlamak ve göreli canonical URL'lerini çözümlemek için aktif sayfanın URL'si ve belgenin base URI'si.
- Sayfa başlığı, meta description, H1 metni, canonical bağlantıları, meta robots yönergeleri ve HTML dil attribute'u.
- Görsel sayıları ve görsellerde alt attribute'u bulunup bulunmadığı; alt metnini okumaz ve görselleri indirmez.
- Open Graph metadata'sı (`og:title`, `og:description` ve `og:image`) ile hreflang dil ve bağlantı değerleri.

Bu bilgiler ve kontrol sonuçları yerel bellekte geçici olarak işlenir. Kalıcı olarak kaydedilmez, geliştiriciye veya harici bir sunucuya gönderilmez ve üçüncü taraflarla paylaşılmaz. Sayfa metinleri veya URL'leri kişisel bilgiler içerebilir; bu seçili alanlarda bulunan bilgiler de aynı yerel ve geçici işleme kapsamındadır.

MetaRadar bu bilgileri yalnızca sayfa inceleme işlevini sağlamak için kullanır. Chrome API'leri üzerinden erişilen bilgilerin kullanımı, Limited Use gereksinimleri dahil Chrome Web Store User Data Policy kurallarına uygundur.

## Saklanan Bilgiler

Tek kalıcı kullanıcı tercihi, `chrome.storage.local` içindeki `themePreference` değeridir. System, Light veya Dark seçimini temsil eder (`system`, `light` veya `dark` olarak saklanır) ve popup görünümünü belirler. `chrome.storage.sync` kullanılarak senkronize edilmez.

## Toplamadığımız veya Saklamadığımız Bilgiler

MetaRadar tarama geçmişi, ziyaret edilen siteler listesi veya sayfa metadata'sı ya da kontrol sonuçlarının geçmişini tutmaz. Kullanıcı hesabı veya login sistemi yoktur; kimlik, sağlık, ödeme, kimlik doğrulama, kişisel iletişim veya konum bilgilerini ayrı veri alanları olarak istemez.

Çerezleri, form girdilerini veya sayfanın tüm HTML'ini okumaz; tıklamaları, tuş vuruşlarını, fare hareketlerini veya kaydırmayı kaydetmez. Bu sınırlar, bir web sitesinin yukarıda açıklanan seçili sayfa alanlarına yerleştirebileceği kişisel bilgileri kapsam dışında bırakmaz.

## Ağ İstekleri ve Üçüncü Taraflar

Eklenti harici ağ isteği yapmaz; backend, harici API, analytics, telemetry, tracking, reklam veya uzaktan barındırılan çalıştırılabilir kod içermez. Metadata URL'leri metin olarak incelenir, bu adreslere istek yapılmaz. MetaRadar kişisel bilgileri veya diğer kullanıcı verilerini satmaz ve üçüncü taraflarla paylaşmaz.

## Chrome İzinleri

- `activeTab`: MetaRadar'ı çalıştırmanızın ardından aktif sayfaya geçici erişim.
- `scripting`: seçili sayfa bilgilerini yerel olarak almak için paketteki salt okunur sayfa okuyucusunu çalıştırma.
- `storage`: yalnızca tema tercihini saklama.

MetaRadar host permission veya `tabs`, `history`, `cookies`, `webRequest` izni istemez.

## Veri Saklama Süresi

Sayfa bilgileri ve sonuçlar yalnızca popup oturumu boyunca tutulur ve popup kapandığında bırakılır; kalıcı kayıt oluşturulmaz. Tema tercihi değiştirilene, eklentinin yerel depolaması temizlenene veya eklenti kaldırılana kadar saklanır. System, Light ve Dark düğmeleriyle değiştirebilirsiniz.

## Güvenlik

MetaRadar dar kapsamlı izinler, paketlenmiş kod ve sayfa değerlerinin yalnızca metin olarak gösterilmesini kullanır. Sayfa bilgilerini dışarı yüklemez. Bu önlemler maruziyeti azaltır ancak mutlak güvenliği garanti etmez.

## Çocukların Gizliliği

MetaRadar çocuklara yönelik değildir. Yaş kaydı veya hesap sistemi yoktur. Aynı yerel işleme ve saklama uygulamaları tüm kullanıcılar için geçerlidir.

## Bu Politikadaki Değişiklikler

MetaRadar'ın veri uygulamaları değişirse bu politika güncellenecektir. Yukarıdaki tarih son revizyonu gösterir. Veri işlemedeki önemli değişiklikler belirgin biçimde açıklanacak ve Chrome Web Store politikalarının gerektirdiği onay, değişen işleme başlamadan önce alınacaktır.

## İletişim

Bu politika hakkındaki sorularınız için iletişim: altunbeykoray07@gmail.com
