# Kör Randevu 🙈

Önce sohbet, sonra fotoğraf. Tinder benzeri ama farklı bir flört uygulaması:

1. **Keşfet** — Kartlarda sadece **isim, yaş, memleket ve meslek** görünür. Sağa kaydır (♥) ya da sola (✕).
2. **Eşleşme** — İki taraf da beğenirse sohbet açılır.
3. **5 soru** — Sohbette serbestçe yazışabilir, ayrıca "❓ Soru sor" ile soru sorabilirsiniz.
   Bir soru cevaplanmadan yenisi sorulamaz. 5 soru cevaplanınca onay aşaması açılır.
4. **Karşılıklı onay** — İkiniz de "Fotoğrafları açmayı onayla" derseniz profil fotoğrafları görünür.

Fotoğraflar sunucu tarafında korunur: `/photos/...` adresi sadece fotoğrafın sahibine ve
karşılıklı onay vermiş eşleşmelere açılır (diğer herkese 403).

## Çalıştırma

```bash
npm install
npm start          # http://localhost:3000
```

Veriler `data/db.json`, fotoğraflar `uploads/` klasöründe tutulur.

## Teknoloji

- Node.js + Express 5, Socket.io (anlık mesajlar), Multer (fotoğraf yükleme)
- Arayüz: bağımlılıksız HTML/CSS/JS, mobil öncelikli

## Botlar

Gerçek kullanıcı olmadan denemek için sunucu açılışta 10 bot ekler (`bots.js`):
5 kadın, 5 erkek; her birinin kendi hikayesi ve çizilmiş 3 fotoğrafı var.
Botlar seni her zaman geri beğenir, selam verir, sorularına konuya göre cevap verir,
sırası gelince kendileri soru sorar ve 5 soru dolunca fotoğraf onayı verir.
Arayüzde 🤖 işaretiyle gösterilirler.

## Kurulumsuz demo (telefon için)

`node demo/build.js` arayüzü, botları ve tarayıcıda çalışan sahte bir sunucuyu
(`demo/mock-server.js`) tek bir HTML dosyasında birleştirir. Bu dosya sunucu olmadan
açılır; hesaplar ve mesajlar sadece o cihazın tarayıcısında saklanır.
`server.js`'teki kurallar değişirse `demo/mock-server.js` de güncellenmeli.
