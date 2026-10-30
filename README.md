# Kör Randevu 🙈

Önce sohbet, sonra fotoğraf. Tinder benzeri ama farklı bir flört uygulaması:

1. **Keşfet** — Kartlarda sadece **isim ve yaş** görünür. Sağa kaydır (♥) ya da sola (✕).
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
