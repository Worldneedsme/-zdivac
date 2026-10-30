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
html, body { height: 100%; background: var(--bg); }
.screen { height: 100%; }
.demo-note { font-size: 12px; color: var(--muted); background: var(--accent-soft); border-radius: 10px; padding: 8px 10px; margin: 0 0 12px; text-align: center; }
`;

const html = read('public/index.html');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const page = [
  '<title>Kör Randevu</title>',
  `<style>\n${read('public/style.css')}\n${demoCss}</style>`,
  body
    .replace('<script src="/socket.io/socket.io.js"></script>', '')
    .replace('<script src="/app.js"></script>', '')
    .replace(
      '<div class="tabs">',
      '<p class="demo-note">Demo sürümü: botlarla sohbet edebilirsin. Hesabın ve mesajların sadece bu cihazda saklanır.</p>\n      <div class="tabs">'
    ),
  inlineScript(botsBundle),
  inlineScript(read('demo/mock-server.js')),
  inlineScript(read('public/app.js')),
].join('\n');

if (!head.includes('<title>')) throw new Error('index.html başlığı bulunamadı');
fs.writeFileSync(out, page);
console.log(`Demo yazıldı: ${out} (${Math.round(page.length / 1024)} KB)`);
