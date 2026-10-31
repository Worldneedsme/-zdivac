// public/ arayüzünü, bots.js'i ve tarayıcıdaki sahte sunucuyu tek bir
// HTML dosyasında birleştirir. Kurulum gerektirmeyen demo içindir.
//   node demo/build.js [çıktı-yolu]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const out = process.argv[2] || path.join(__dirname, 'kor-randevu-demo.html');

// </script> dizisi satır içi betiği erken kapatmasın.
const inlineScript = (code) => `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;

// bots.js CommonJS modülü; tarayıcıda fs/path gerekmediği için boş verilir.
const botsBundle = `window.BotsModule = (function () {
  const module = { exports: {} };
  const require = () => ({});
  ${read('bots.js')}
  return module.exports;
})();`;

const demoCss = `
/* Demo: artifact çerçevesinde tam ekran */
html, body { background: var(--bg); }
/* Claude uygulamasının üstteki kapat/menü butonları sayfanın üstüne biner. */
@media (pointer: coarse) { body { padding-top: 56px; } }

/* Simülatör: geniş ekranlarda uygulama bir telefon çerçevesinin içinde çalışır.
   transform, içerideki position:fixed öğeleri (modal, bildirim) çerçeveye hapseder. */
.sim-help { display: none; max-width: 300px; color: var(--text); }
.device { height: 100%; position: relative; transform: translateZ(0); overflow: hidden; }
@media (min-width: 700px) and (min-height: 560px) {
  body {
    display: flex; align-items: center; justify-content: center; gap: 48px;
    background: radial-gradient(circle at 30% 20%, #ffe3ea, #f4e9f7 60%, #e9eef8);
  }
  .device {
    width: 390px; height: min(844px, calc(100% - 48px)); flex-shrink: 0;
    border: 12px solid #1d1519; border-radius: 52px; padding-top: 38px;
    background: var(--bg); box-shadow: 0 30px 80px rgba(80, 20, 40, 0.28);
  }
  .device::before {
    content: ""; position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
    width: 110px; height: 30px; border-radius: 16px; background: #1d1519; z-index: 30;
  }
  .device::after {
    content: "9:41"; position: absolute; top: 14px; left: 34px;
    font-weight: 600; font-size: 14px; color: var(--text);
  }
  .screen { max-width: none; }
  .sim-help { display: block; }
}
.sim-help h2 { margin: 0 0 8px; font-size: 26px; color: var(--primary); }
.sim-help p { margin: 0 0 10px; color: var(--muted); line-height: 1.5; }
.sim-help ol { margin: 0; padding-left: 20px; line-height: 1.7; }
@media (max-width: 1000px) { .sim-help { display: none !important; } }
.demo-note { font-size: 12px; color: var(--muted); background: var(--accent-soft); border-radius: 10px; padding: 8px 10px; margin: 0 0 12px; text-align: center; }
`;

const html = read('public/index.html');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const page = [
  '<title>Kör Randevu</title>',
  `<style>\n${read('public/style.css')}\n${demoCss}</style>`,
  '<div class="device">',
  body
    .replace('<script src="/socket.io/socket.io.js"></script>', '')
    .replace('<script src="/profile-options.js"></script>', '')
    .replace('<script src="/app.js"></script>', '')
    .replace(
      '<div class="tabs">',
      '<p class="demo-note">Demo: botlarla sohbet et. Veriler sadece bu cihazda saklanır.</p>\n      <div class="tabs">'
    ),
  '</div>',
  `<aside class="sim-help">
    <h2>🙈 Kör Randevu</h2>
    <p>Önce sohbet, sonra fotoğraf. Telefon ekranındaki uygulamayı fareyle kullanabilirsin.</p>
    <ol>
      <li>Kayıt ol (bir fotoğraf seç)</li>
      <li>Kartı beğen ♥, bot eşleşir</li>
      <li>"❓ Soru" ile soru sor, gelen sorulara cevap ver</li>
      <li>5 soru dolunca "Onayla"</li>
      <li>İkiniz de onaylayınca fotoğraflar açılır 📸</li>
    </ol>
  </aside>`,
  inlineScript(botsBundle),
  inlineScript(read('public/profile-options.js')),
  inlineScript(read('demo/mock-server.js')),
  inlineScript(read('public/app.js')),
].join('\n');

if (!head.includes('<title>')) throw new Error('index.html başlığı bulunamadı');
fs.writeFileSync(out, page);
console.log(`Demo yazıldı: ${out} (${Math.round(page.length / 1024)} KB)`);
