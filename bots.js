// Uygulamayı gerçek kullanıcılar olmadan denemek için sohbet botları.
// Botlar seni her zaman geri beğenir, selam verir, sorularına cevap verir,
// sırası gelince kendileri soru sorar ve 5 soru dolunca fotoğraf onayı verir.
const fs = require('fs');
const path = require('path');

const PROFILES = [
  {
    key: 'zeynep', name: 'Zeynep', age: 25, gender: 'kadin',
    hometown: 'İstanbul', occupation: 'Grafik Tasarımcı',
    look: { skin: '#f1c7a5', hair: '#3b2219', shirt: '#e85d75', style: 'long' },
    city: "İstanbul'da, Kadıköy'de yaşıyorum. Moda sahilinde yürümeye bayılırım.",
    job: 'Grafik tasarımcıyım, bir ajansta marka kimlikleri tasarlıyorum.',
    music: 'Indie ve biraz da eski Türkçe pop. Sezen Aksu her zaman kalbimde.',
    food: 'Mantı! Bir de iyi bir lahmacuna asla hayır diyemem.',
    film: 'Son olarak "Aşk Tesadüfleri Sever"i tekrar izledim, hâlâ ağlattı 😅',
    travel: 'Hayalim Japonya. Kiraz çiçekleri zamanı gitmek istiyorum.',
    pet: 'Kedi insanıyım, Pamuk adında tekir bir kedim var 🐱',
    morning: 'Gece kuşuyum, en yaratıcı saatlerim gece yarısından sonra.',
    laugh: 'Absürt mizah. Kötü kelime esprileri bile beni güldürür.',
    weekend: 'Hafta sonları sergi gezerim, bir de kahve dükkanlarında çizim yaparım.',
    lookingFor: 'Sohbeti güzel, meraklı ve beni güldürebilecek biri.',
  },
  {
    key: 'elif', name: 'Elif', age: 27, gender: 'kadin',
    hometown: 'İzmir', occupation: 'Veteriner',
    look: { skin: '#e8b48f', hair: '#6b3e26', shirt: '#4caf8e', style: 'bun' },
    city: "İzmir'de yaşıyorum, Alsancak'ta. Kordon'da gün batımı gibisi yok.",
    job: 'Veterinerim. Her gün bir sürü tüylü dostla uğraşıyorum 🐶',
    music: 'Akustik ne varsa. Son zamanlarda çok Norah Jones dinliyorum.',
    food: 'Boyoz ve gevrek! İzmirli olmanın şartı 😄',
    film: 'Belgesel bağımlısıyım, en son bir okyanus belgeseli izledim.',
    travel: 'Norveç fiyortları. Doğanın içinde kaybolmak istiyorum.',
    pet: 'İki köpeğim var: Paşa ve Fıstık. Tabii ki köpek!',
    morning: 'Sabah insanıyım, 6\'da kalkıp koşuya çıkarım.',
    laugh: 'Hayvanların saçma videoları. Saatlerce izleyebilirim.',
    weekend: 'Köpeklerle doğa yürüyüşü, akşamları da arkadaşlarla rakı-balık.',
    lookingFor: 'Hayvanları seven, doğada vakit geçirmekten keyif alan biri.',
  },
  {
    key: 'defne', name: 'Defne', age: 23, gender: 'kadin',
    hometown: 'Ankara', occupation: 'Psikoloji Öğrencisi',
    look: { skin: '#f6d2b8', hair: '#c98a3c', shirt: '#7b6cf6', style: 'long' },
    city: "Ankara'dayım, Çankaya'da öğrenci evinde yaşıyorum.",
    job: 'Psikoloji son sınıf öğrencisiyim, bir yandan da kafede çalışıyorum.',
    music: 'K-pop ve lo-fi. Ders çalışırken lo-fi şart.',
    food: 'Kumpir ve sushi. Garip bir ikili biliyorum 😄',
    film: '"Dark" dizisini bitirdim, hâlâ kafamda kurguyu çözmeye çalışıyorum.',
    travel: 'Kapadokya\'da balona binmek listemin başında.',
    pet: 'Kedi! Ama evde beslemem yasak, sokak kedilerini besliyorum.',
    morning: 'Kesinlikle gece kuşu. Sabah derslerim işkence.',
    laugh: 'Stand-up izlemeye bayılırım, Cem Yılmaz klasiklerini ezbere bilirim.',
    weekend: 'Hafta sonları kitap okurum, bir de arkadaşlarla kutu oyunu oynarız.',
    lookingFor: 'Derin sohbet edebileceğim, dinlemeyi bilen biri.',
  },
  {
    key: 'selin', name: 'Selin', age: 29, gender: 'kadin',
    hometown: 'Antalya', occupation: 'Yoga Eğitmeni',
    look: { skin: '#c99272', hair: '#1f1512', shirt: '#f2a541', style: 'short' },
    city: "Antalya'da yaşıyorum, denize beş dakika mesafede.",
    job: 'Yoga eğitmeniyim, kendi küçük stüdyom var 🧘‍♀️',
    music: 'Sabahları mantra müzikleri, akşamları Tarkan. Dengeliyim 😄',
    food: 'Vejetaryenim, en sevdiğim zeytinyağlı enginar.',
    film: '"Yeme, Dua Et, Sev" — klişe biliyorum ama çok severim.',
    travel: 'Bali! Hem yoga hem sörf, daha ne olsun.',
    pet: 'Köpek severim ama şu an bir kaplumbağam var, adı Hızlı 🐢',
    morning: 'Sabah insanıyım, gün doğumunda yoga yaparım.',
    laugh: 'Kendime gülmeyi severim, hayatı çok ciddiye almam.',
    weekend: 'Sörf yaparım ya da Likya yolunda yürüyüşe çıkarım.',
    lookingFor: 'Pozitif, huzurlu, hayattan keyif almayı bilen biri.',
  },
  {
    key: 'ece', name: 'Ece', age: 31, gender: 'kadin',
    hometown: 'Eskişehir', occupation: 'Yazılım Geliştirici',
    look: { skin: '#f0c19c', hair: '#8a2f1d', shirt: '#2f80ed', style: 'long' },
    city: "Eskişehir'de yaşıyorum, Porsuk kenarında bisiklete binmek favorim.",
    job: 'Yazılım geliştiriciyim, uzaktan çalışıyorum 💻',
    music: 'Rock! Duman konserlerini kaçırmam.',
    food: 'Çiğ börek, Eskişehir\'e gelen herkes denemeli.',
    film: 'Bilim kurgu hastasıyım, "Interstellar"ı belki 10 kere izledim.',
    travel: 'İzlanda\'da kuzey ışıklarını görmek.',
    pet: 'Kedim var, adı Bug 🐛 (yazılımcı esprisi 😄)',
    morning: 'Ortası: ne çok erken ne çok geç. Kahve olduktan sonra her saat iyi.',
    laugh: 'İnternet mizahı ve iyi bir meme.',
    weekend: 'Bisiklet, bir de evde yeni tarifler denemek.',
    lookingFor: 'Zeki, meraklı ve teknolojiye korkmadan yaklaşan biri.',
  },
  {
    key: 'can', name: 'Can', age: 28, gender: 'erkek',
    hometown: 'İstanbul', occupation: 'Aşçı',
    look: { skin: '#e3ad86', hair: '#2a1a12', shirt: '#264653', style: 'beard' },
    city: "İstanbul'da, Beşiktaş'ta yaşıyorum.",
    job: 'Aşçıyım, Karaköy\'de bir restoranda sous-chef olarak çalışıyorum 👨‍🍳',
    music: 'Caz ve funk. Mutfakta hep müzik çalar.',
    food: 'Annemin içli köftesi. Hiçbir restoranda o tadı bulamadım.',
    film: '"The Bear" dizisini izledim, bizim mutfak aynen öyle 😅',
    travel: 'İtalya\'yı baştan sona yiyerek gezmek.',
    pet: 'Köpek! Golden retriever hayalim var.',
    morning: 'İşim gereği gece kuşuyum, servis geç bitiyor.',
    laugh: 'İyi bir sohbet ve beklenmedik espriler.',
    weekend: 'Pazar sabahları balık pazarına gider, akşam arkadaşlara yemek yaparım.',
    lookingFor: 'Yemek yemeyi seven, sofrada uzun sohbet edebileceğim biri.',
  },
  {
    key: 'emre', name: 'Emre', age: 26, gender: 'erkek',
    hometown: 'Bursa', occupation: 'Mimar',
    look: { skin: '#f2c9a8', hair: '#5a3825', shirt: '#e76f51', style: 'short' },
    city: "Bursa'da yaşıyorum, Uludağ manzaralı bir evde.",
    job: 'Mimarım, şu an bir kütüphane projesi üzerinde çalışıyorum.',
    music: 'Elektronik ve biraz klasik. Çizim yaparken Ludovico Einaudi.',
    food: 'İskender, Bursa\'dayım sonuçta 😄',
    film: 'Wes Anderson filmlerini çok severim, simetri hastasıyım.',
    travel: 'Barselona — Gaudí\'nin yapılarını yerinde görmek.',
    pet: 'Kedi. Bağımsızlıklarına saygı duyuyorum.',
    morning: 'Sabah insanıyım, en iyi fikirler ilk kahvede gelir.',
    laugh: 'Kuru mizah. Bir de arkadaşlarımın bitmeyen şakaları.',
    weekend: 'Kışın kayak, yazın bisiklet. Arada eski yapıları fotoğraflarım.',
    lookingFor: 'Estetik zevki olan, birlikte şehirler keşfedebileceğim biri.',
  },
  {
    key: 'burak', name: 'Burak', age: 30, gender: 'erkek',
    hometown: 'İzmir', occupation: 'Fotoğrafçı',
    look: { skin: '#c68a64', hair: '#111111', shirt: '#2a9d8f', style: 'curly' },
    city: "İzmir'de, Urla'da yaşıyorum. Bağların arasında küçük bir ev.",
    job: 'Fotoğrafçıyım, düğün ve doğa fotoğrafları çekiyorum 📷',
    music: 'Barış Manço ve Cem Karaca. Anadolu rock benim için her şey.',
    food: 'Deniz ürünleri, özellikle ızgara ahtapot.',
    film: '"Babam ve Oğlum" — her izlediğimde ağlarım.',
    travel: 'Patagonya. Fotoğraf makinemle aylarca kaybolmak isterim.',
    pet: 'Köpeğim var, adı Zeytin. Her çekime benimle gelir.',
    morning: 'Gün doğumu fotoğrafları için sabahçı oldum mecburen 😄',
    laugh: 'Zeytin\'in fotoğraf çekimlerini mahvetmesi 😂',
    weekend: 'Sahilde kamp, kamp ateşinde gitar.',
    lookingFor: 'Maceraya açık, doğayı seven ve anı yaşayan biri.',
  },
  {
    key: 'mert', name: 'Mert', age: 24, gender: 'erkek',
    hometown: 'Ankara', occupation: 'Müzisyen',
    look: { skin: '#f4cfb2', hair: '#a0612b', shirt: '#9b5de5', style: 'long' },
    city: "Ankara'da yaşıyorum, Tunalı'da.",
    job: 'Müzisyenim, bir grupta bas çalıyorum. Gündüzleri de gitar dersi veriyorum 🎸',
    music: 'Her şey! Ama en çok Arctic Monkeys ve Pinhani.',
    food: 'Gece yarısı tostu. Prova sonrası en iyisi.',
    film: '"Whiplash". Müzisyen olup da sevmeyen yoktur.',
    travel: 'Londra, oradaki küçük konser mekanlarını gezmek.',
    pet: 'Kedi, provada sessiz kalan tek dinleyici onlar 😄',
    morning: 'Gece kuşu, konserler gece bitiyor.',
    laugh: 'Grup arkadaşlarımın sahnede yaptığı hatalar.',
    weekend: 'Konser, konser, konser. Boş kalırsam beste yaparım.',
    lookingFor: 'Müziği seven, konserlere benimle gelecek biri.',
  },
  {
    key: 'kerem', name: 'Kerem', age: 32, gender: 'erkek',
    hometown: 'Trabzon', occupation: 'Tarih Öğretmeni',
    look: { skin: '#dba27c', hair: '#3d2b1f', shirt: '#457b9d', style: 'beard' },
    city: "Trabzon'dayım, yaylaya yakın yaşamak paha biçilemez.",
    job: 'Tarih öğretmeniyim, lise öğrencilerine anlatıyorum.',
    music: 'Kemençe ve Karadeniz türküleri, bir de Kazım Koyuncu.',
    food: 'Hamsi tava ve kuymak. Başka soru? 😄',
    film: 'Tarihi filmler; "Gladyatör" favorim.',
    travel: 'Roma ve Atina, tarih öğretmeni olarak hacı olmam lazım 😄',
    pet: 'Köpek. Yayladaki çoban köpeklerimizi çok severim.',
    morning: 'Sabah insanıyım, okul alışkanlığı.',
    laugh: 'Öğrencilerin sınav kağıtlarına yazdıkları yaratıcı cevaplar 😂',
    weekend: 'Yayla yürüyüşleri ve horon. Bir de satranç.',
    lookingFor: 'Samimi, sohbeti derin, ailesine bağlı biri.',
  },
];

const TOPICS = [
  [/kaç yaş|yaşın kaç|yaşında/, (p) => `${p.age} yaşındayım 🙂`],
  [/nere|şehir|memleket|yaşıyor|oturuyor/, (p) => p.city],
  [/\biş|meslek|çalış|ne yapıyorsun|okul|okuyor/, (p) => p.job],
  [/müzik|şarkı|dinle|grup|sanatçı|konser/, (p) => p.music],
  [/yemek|yemeğ|mutfak|tatlı|kahvaltı|yersin|yiyecek/, (p) => p.food],
  [/film|dizi|sinema|izle/, (p) => p.film],
  [/tatil|seyahat|gez|ülke|gitmek|deniz/, (p) => p.travel],
  [/hayvan|kedi|köpek/, (p) => p.pet],
  [/sabah|gece|uyu/, (p) => p.morning],
  [/güldür|komik|mizah|gül/, (p) => p.laugh],
  [/hafta ?sonu|boş zaman|hobi|keyif|vakit/, (p) => p.weekend],
  [/ilişki|aradığın|arıyorsun|ideal|partner|beklenti|neden burada/, (p) => p.lookingFor],
  [/sev|favori|en iyi/, (p) => p.weekend],
];

const GENERIC_ANSWERS = [
  'Güzel soru! Açıkçası hiç düşünmemiştim ama sanırım cevabım "anına göre değişir" 😄',
  'Hmm, zor soru. Kısaca: küçük şeylerden mutlu olan biriyim, bu da onlardan biri 🙂',
  'Bunu yüz yüze anlatsam daha iyi olur bence 😉 Ama kısaca evet, severim!',
];

const BOT_QUESTIONS = [
  'Hafta sonları genelde ne yaparsın?',
  'En sevdiğin yemek ne?',
  'Hayalindeki tatil nerede?',
  'Kedi mi köpek mi? 🐱🐶',
  'Son izleyip sevdiğin film ya da dizi ne?',
  'Seni en çok ne güldürür?',
  'Sabah insanı mısın, gece kuşu mu?',
  'Ne iş yapıyorsun?',
  'Hangi müzikleri dinlersin?',
];

const ANSWER_REACTIONS = [
  'Ooo güzelmiş 😊',
  'Haha, bunu sevdim!',
  'Vay, hiç tahmin etmezdim 😄',
  'Aynı fikirdeyiz bence!',
  'Çok tatlı bir cevap 🙂',
  'Bunu not ettim 😄',
];

const CHAT_RULES = [
  [/^(selam|merhaba|mrb|slm|hey|sa\b|selamlar|merhabalar)/, ['Selam! 😊 Nasılsın?', 'Merhaba! Eşleştiğimize sevindim 🙂', 'Selaam! Nasıl gidiyor?']],
  [/nasılsın|naber|nasıl gidiyor|ne haber/, ['İyiyim, teşekkürler! Sen nasılsın? 🙂', 'Gayet iyi, seninle konuşunca daha iyi 😄']],
  [/iyiyim|iyi(?:dir)?\b|harika|süper/, ['Sevindim 🙂', 'Ne güzel! 😊']],
  [/teşekkür|sağ ol|sağol/, ['Rica ederim 😊', 'Ne demek 🙂']],
  [/fotoğraf|foto|resim|yüz/, ['Fotoğraflar 5 sorudan sonra açılıyor, sabırlı ol 😄', 'Merak ediyorum ben de! Soruları tamamlayalım 😉']],
  [/haha|hah|😂|🤣|lol/, ['😄😄', 'Haha 😂']],
];

const CHAT_FALLBACK = [
  'Anlat biraz daha!',
  'Hmm, ilginç 🤔',
  'Bence de 🙂',
  'Seninle konuşmak keyifli 😊',
  'Haha, çok tatlısın 😄',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lower = (s) => s.toLocaleLowerCase('tr');

// ---------- avatar çizimleri ----------

function hairShapes(style, color) {
  switch (style) {
    case 'long':
      return `<path d="M88 132c0-48 26-74 62-74s62 26 62 74v118h-26v-90h-72v90H88z" fill="${color}"/>`;
    case 'bun':
      return `<circle cx="150" cy="58" r="22" fill="${color}"/><path d="M98 132c0-40 20-62 52-62s52 22 52 62c-12-22-30-30-52-30s-40 8-52 30z" fill="${color}"/>`;
    case 'curly':
      return [0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${102 + i * 16}" cy="${92 - Math.sin((i / 6) * Math.PI) * 16}" r="18" fill="${color}"/>`).join('');
    case 'beard':
      return `<path d="M100 122c0-36 20-56 50-56s50 20 50 56c-10-14-28-20-50-20s-40 6-50 20z" fill="${color}"/><path d="M108 150c4 34 20 48 42 48s38-14 42-48c-8 14-24 18-42 18s-34-4-42-18z" fill="${color}"/>`;
    default: // short
      return `<path d="M100 126c0-38 20-60 50-60s50 22 50 60c-6-18-24-28-50-28s-44 10-50 28z" fill="${color}"/>`;
  }
}

function avatarSvg(p, variant) {
  const { skin, hair, shirt, style } = p.look;
  const backgrounds = [
    ['#ffd6e0', '#ffeef2'],
    ['#cde7ff', '#eef6ff'],
    ['#ffe8b8', '#fff6e2'],
  ];
  const [bg1, bg2] = backgrounds[variant % backgrounds.length];
  const scenery =
    variant === 2
      ? `<circle cx="240" cy="70" r="26" fill="#ffc94a"/><path d="M0 300l70-60 60 40 70-70 100 90v100H0z" fill="#9fd8a8" opacity=".8"/>`
      : variant === 1
        ? `<circle cx="50" cy="60" r="10" fill="#fff" opacity=".7"/><circle cx="250" cy="110" r="14" fill="#fff" opacity=".6"/><circle cx="70" cy="190" r="8" fill="#fff" opacity=".6"/>`
        : '';
  const eyes =
    variant === 1
      ? `<rect x="114" y="130" width="30" height="18" rx="7" fill="#1d1d1d"/><rect x="156" y="130" width="30" height="18" rx="7" fill="#1d1d1d"/><rect x="142" y="136" width="16" height="4" fill="#1d1d1d"/>`
      : `<circle cx="132" cy="140" r="5" fill="#2b1d16"/><circle cx="168" cy="140" r="5" fill="#2b1d16"/>`;
  const back = style === 'long' ? hairShapes(style, hair) : '';
  const front = style === 'long'
    ? `<path d="M104 130c4-34 22-52 46-52s42 18 46 52c-14-20-28-28-46-28s-32 8-46 28z" fill="${hair}"/>`
    : hairShapes(style, hair);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="600" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#g)"/>
  ${scenery}
  ${back}
  <path d="M60 400c0-80 40-120 90-120s90 40 90 120z" fill="${shirt}"/>
  <rect x="134" y="186" width="32" height="40" rx="12" fill="${skin}"/>
  <ellipse cx="150" cy="146" rx="48" ry="58" fill="${skin}"/>
  ${front}
  ${eyes}
  <path d="M134 170q16 14 32 0" stroke="#8a3b2e" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="120" cy="160" r="8" fill="#ff8fa3" opacity=".35"/><circle cx="180" cy="160" r="8" fill="#ff8fa3" opacity=".35"/>
</svg>`;
}

// ---------- motor ----------

function createBots({ db, io, uploadDir, actions, requiredQuestions }) {
  const timers = new Map();
  const profileOf = (botId) => PROFILES.find((p) => `bot-${p.key}` === botId);

  function seed() {
    for (const p of PROFILES) {
      const botId = `bot-${p.key}`;
      const photos = [0, 1, 2].map((i) => `${botId}-${i + 1}.svg`);
      photos.forEach((file, i) => {
        const full = path.join(uploadDir, file);
        if (!fs.existsSync(full)) fs.writeFileSync(full, avatarSvg(p, i));
      });
      db.data.users[botId] = {
        swipes: {},
        createdAt: new Date().toISOString(),
        ...db.data.users[botId],
        id: botId,
        isBot: true,
        name: p.name,
        age: p.age,
        gender: p.gender,
        interestedIn: 'herkes',
        hometown: p.hometown,
        occupation: p.occupation,
        photos,
      };
    }
    db.save();
  }

  // Bot sohbetin o anki durumuna bakıp yapacağı bir sonraki işi seçer.
  function nextAction(conv, bot) {
    const human = conv.users.find((u) => u !== bot.id);
    const p = profileOf(bot.id);
    const answered = conv.questions.filter((q) => q.answer).length;
    const pending = conv.questions.find((q) => !q.answer);
    const last = [...conv.messages].reverse().find((m) => m.type !== 'system');

    if (pending && pending.askerId === human) {
      return { delay: 2500, run: () => actions.answerQuestion(conv, bot, pending.id, answerFor(p, pending.text)) };
    }
    if (!last) {
      return { delay: 1500, run: () => actions.sendChat(conv, bot, `Selam! Ben ${p.name} 😊 Önce birbirimizi tanıyalım, istersen ilk soruyu sen sor!`) };
    }
    if (last.senderId === human && last.type === 'answer') {
      const askMore = answered < requiredQuestions && !pending;
      const text = pick(ANSWER_REACTIONS) + (askMore ? ' Şimdi sıra sende, bana bir şey sor 😉' : '');
      return { delay: 1500, run: () => actions.sendChat(conv, bot, text) };
    }
    if (last.senderId === human && last.type === 'chat') {
      return { delay: 1800, run: () => actions.sendChat(conv, bot, chatReply(conv, last.text, answered, pending)) };
    }
    if (answered >= requiredQuestions && !conv.approvals[bot.id]) {
      return { delay: 3000, run: () => actions.approvePhotos(conv, bot) };
    }
    if (last.senderId === bot.id && last.type === 'answer' && answered < requiredQuestions && !pending) {
      const asked = new Set(conv.questions.map((q) => q.text));
      const question = BOT_QUESTIONS.find((q) => !asked.has(q) && Math.random() < 0.6) ||
        BOT_QUESTIONS.find((q) => !asked.has(q)) || 'Kendini üç kelimeyle anlatır mısın?';
      return { delay: 2200, run: () => actions.askQuestion(conv, bot, question) };
    }
    return null;
  }

  function answerFor(p, question) {
    const q = lower(question);
    const topic = TOPICS.find(([re]) => re.test(q));
    return topic ? topic[1](p) : pick(GENERIC_ANSWERS);
  }

  function chatReply(conv, text, answered, pending) {
    const t = lower(text);
    if (t.includes('?') && answered < requiredQuestions && !pending) {
      return 'Güzel soru 😄 "❓ Soru sor" ile sorarsan cevaplarım, hem fotoğraflara bir adım yaklaşırız!';
    }
    const rule = CHAT_RULES.find(([re]) => re.test(t));
    if (rule) return pick(rule[1]);
    if (conv.questions.length === 0 && Math.random() < 0.5) {
      return 'Hadi soru soralım 😊 5 soru tamamlanınca fotoğraflar açılıyor!';
    }
    return pick(CHAT_FALLBACK);
  }

  // Sohbet her değiştiğinde çağrılır. Botun yazması gereken bir şey varsa
  // kısa bir "yazıyor..." gecikmesiyle sıraya koyar.
  function react(conv) {
    const bot = conv.users.map((u) => db.data.users[u]).find((u) => u?.isBot);
    if (!bot || timers.has(conv.id)) return;
    const plan = nextAction(conv, bot);
    if (!plan) return;
    const human = conv.users.find((u) => u !== bot.id);
    const typing = (on) => io.to(`user:${human}`).emit('typing', { conversationId: conv.id, typing: on });
    const delay = plan.delay + Math.random() * 1500;
    typing(true);
    timers.set(
      conv.id,
      setTimeout(() => {
        timers.delete(conv.id);
        typing(false);
        // Bekleme sırasında durum değişmiş olabilir; kararı yeniden ver.
        const fresh = db.data.conversations[conv.id];
        const current = fresh && nextAction(fresh, bot);
        if (current) current.run();
        else if (fresh) react(fresh);
      }, delay)
    );
  }

  return {
    seed,
    react,
    // Botlar kendilerini beğenen herkesi geri beğenir.
    onLiked(bot, user) {
      if (bot.isBot) bot.swipes[user.id] = true;
    },
    resumeAll() {
      for (const conv of Object.values(db.data.conversations)) react(conv);
    },
  };
}

module.exports = { createBots, PROFILES, avatarSvg };
