// Telefonda kurulum olmadan denemek için: server.js'in API'sini tarayıcı
// içinde taklit eder. Veriler sadece bu cihazın localStorage'ında tutulur.
// Kurallar server.js ile aynı olmalı; orada bir şey değişirse burada da değiştir.
(function () {
  const { createBots, PROFILES, avatarSvg } = window.BotsModule;
  const { cleanProfile } = window.PROFILE_OPTIONS;
  const REQUIRED_QUESTIONS = 5;
  const MAX_PHOTOS = 6;
  // Anahtar değişince eski demo verileri yok sayılır (sıfırlama).
  const STORE_KEY = 'korRandevuDemo-v2';

  // ---------- veritabanı ----------

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.users) return saved;
    } catch {}
    return { users: {}, conversations: {}, photos: {}, currentUser: null };
  }

  const db = {
    data: load(),
    save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(db.data));
      } catch {
        // Kota dolduysa demo yine de bellekte çalışmaya devam eder.
      }
    },
  };

  // ---------- socket.io yerine ----------

  const listeners = {};
  window.io = () => ({
    on(event, fn) {
      (listeners[event] ||= []).push(fn);
    },
    disconnect() {
      for (const k of Object.keys(listeners)) delete listeners[k];
    },
  });

  const io = {
    to(room) {
      return {
        emit(event, payload) {
          if (room !== `user:${db.data.currentUser}`) return;
          setTimeout(() => (listeners[event] || []).forEach((fn) => fn(payload)), 0);
        },
      };
    },
  };

  // ---------- yardımcılar ----------

  const id = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
  const now = () => new Date().toISOString();
  const cleanText = (v, max = 1000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const botSvgCache = {};
  function photoUrl(file) {
    const bot = /^bot-(\w+)-(\d)\.svg$/.exec(file);
    if (bot) {
      if (!botSvgCache[file]) {
        const profile = PROFILES.find((p) => p.key === bot[1]);
        botSvgCache[file] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(profile, bot[2] - 1));
      }
      return botSvgCache[file];
    }
    return db.data.photos[file];
  }

  const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    age: u.age,
    hometown: u.hometown || '',
    occupation: u.occupation || '',
    profile: u.profile || {},
    isBot: !!u.isBot,
  });

  const ownProfile = (u) => ({
    ...publicUser(u),
    email: u.email,
    gender: u.gender,
    interestedIn: u.interestedIn,
    photos: u.photos.map(photoUrl),
    photoIds: u.photos,
  });

  const partnerOf = (conv, userId) => conv.users.find((u) => u !== userId);
  const isRevealed = (conv) => conv.users.every((u) => conv.approvals[u]);
  const answeredCount = (conv) => conv.questions.filter((q) => q.answer).length;

  function conversationView(conv, userId) {
    const partner = db.data.users[partnerOf(conv, userId)];
    const revealed = isRevealed(conv);
    const answered = answeredCount(conv);
    return {
      id: conv.id,
      partner: { ...publicUser(partner), photos: revealed ? partner.photos.map(photoUrl) : [] },
      messages: conv.messages,
      questions: conv.questions,
      answeredCount: Math.min(answered, REQUIRED_QUESTIONS),
      requiredQuestions: REQUIRED_QUESTIONS,
      canApprove: answered >= REQUIRED_QUESTIONS,
      pendingQuestion: conv.questions.find((q) => !q.answer) || null,
      myApproval: !!conv.approvals[userId],
      partnerApproval: !!conv.approvals[partner.id],
      revealed,
      lastMessage: conv.messages[conv.messages.length - 1] || null,
      createdAt: conv.createdAt,
    };
  }

  function pushConversation(conv) {
    for (const u of conv.users) io.to(`user:${u}`).emit('conversation', conversationView(conv, u));
  }

  function addMessage(conv, senderId, type, text, questionId = null) {
    conv.messages.push({ id: id(), senderId, type, text, questionId, at: now() });
  }

  // Fotoğrafları küçültüp data URL olarak saklar (localStorage küçük).
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        return reject(new Error('Sadece JPG, PNG, WEBP veya GIF yükleyebilirsin.'));
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
      img.src = url;
    });
  }

  async function storePhotos(files) {
    const ids = [];
    for (const f of files) {
      const photoId = id();
      db.data.photos[photoId] = await readPhoto(f);
      ids.push(photoId);
    }
    return ids;
  }

  // ---------- sohbet işlemleri ----------

  function commit(conv) {
    db.save();
    pushConversation(conv);
    bots.react(conv);
    return null;
  }

  const actions = {
    sendChat(conv, user, rawText) {
      const text = cleanText(rawText);
      if (!text) return 'Boş mesaj gönderilemez.';
      addMessage(conv, user.id, 'chat', text);
      return commit(conv);
    },
    askQuestion(conv, user, rawText) {
      const text = cleanText(rawText, 300);
      if (!text) return 'Soru boş olamaz.';
      if (answeredCount(conv) >= REQUIRED_QUESTIONS) return `${REQUIRED_QUESTIONS} soru zaten tamamlandı.`;
      if (conv.questions.some((q) => !q.answer)) return 'Önce bekleyen sorunun cevaplanması gerekiyor.';
      const question = { id: id(), askerId: user.id, text, answer: null, askedAt: now(), answeredAt: null };
      conv.questions.push(question);
      addMessage(conv, user.id, 'question', text, question.id);
      return commit(conv);
    },
    answerQuestion(conv, user, questionId, rawText) {
      const question = conv.questions.find((q) => q.id === questionId);
      if (!question) return 'Soru bulunamadı.';
      if (question.answer) return 'Bu soru zaten cevaplandı.';
      if (question.askerId === user.id) return 'Kendi sorunu cevaplayamazsın.';
      const text = cleanText(rawText);
      if (!text) return 'Cevap boş olamaz.';
      question.answer = text;
      question.answeredAt = now();
      addMessage(conv, user.id, 'answer', text, question.id);
      if (answeredCount(conv) === REQUIRED_QUESTIONS) {
        addMessage(conv, null, 'system', `${REQUIRED_QUESTIONS} soru tamamlandı! Artık ikiniz de fotoğrafları açmayı onaylayabilirsiniz.`);
      }
      return commit(conv);
    },
    approvePhotos(conv, user) {
      if (answeredCount(conv) < REQUIRED_QUESTIONS) return `Önce ${REQUIRED_QUESTIONS} sorunun cevaplanması gerekiyor.`;
      if (conv.approvals[user.id]) return null;
      conv.approvals[user.id] = now();
      addMessage(conv, null, 'system',
        isRevealed(conv) ? 'İkiniz de onay verdiniz. Fotoğraflar artık açık! 📸' : `${user.name} fotoğrafları açmayı onayladı.`);
      return commit(conv);
    },
  };

  const bots = createBots({ db, io, uploadDir: '', actions, requiredQuestions: REQUIRED_QUESTIONS });

  // Botları ekle (fotoğrafları SVG olarak anında çizilir).
  for (const p of PROFILES) {
    const botId = `bot-${p.key}`;
    db.data.users[botId] = {
      swipes: {},
      createdAt: now(),
      ...db.data.users[botId],
      id: botId,
      isBot: true,
      name: p.name,
      age: p.age,
      gender: p.gender,
      interestedIn: 'herkes',
      hometown: p.hometown,
      occupation: p.occupation,
      profile: p.card,
      photos: [1, 2, 3].map((i) => `${botId}-${i}.svg`),
    };
  }

  // Hazır demo hesabı: boş bir demoda oluşturulur ve otomatik giriş yapılır.
  const DEMO_ACCOUNT = { email: 'demo@korrandevu.com', password: '123456' };
  if (!Object.values(db.data.users).some((u) => !u.isBot)) {
    const look = { skin: '#eab896', hair: '#4a2c1d', shirt: '#3d5a80', style: 'short' };
    db.data.photos['demo-1'] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg({ look }, 0));
    db.data.photos['demo-2'] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg({ look }, 2));
    db.data.users['demo-user'] = {
      id: 'demo-user',
      name: 'Deniz',
      age: 26,
      hometown: 'İstanbul',
      occupation: 'Ürün Tasarımcısı',
      gender: 'diger',
      interestedIn: 'herkes',
      ...DEMO_ACCOUNT,
      profile: {
        bio: 'Yeni yerler keşfetmeyi, iyi kahveyi ve uzun sohbetleri severim. Önce tanışalım, gerisi gelir ☕',
        height: 175,
        education: 'Lisans',
        zodiac: 'Kova',
        exercise: 'Bazen',
        smoking: 'İçmiyor',
        drinking: 'Sosyal içici',
        relation: 'Uzun ilişki',
        interests: ['Seyahat', 'Kahve', 'Müzik', 'Sinema', 'Doğa'],
      },
      photos: ['demo-1', 'demo-2'],
      swipes: {},
      createdAt: now(),
    };
    db.data.currentUser = 'demo-user';
  }
  db.save();

  // Profil sekmesindeki "Demo'yu sıfırla": ilk dokunuş onay ister, ikincisi siler.
  const resetBtn = document.getElementById('btn-demo-reset');
  resetBtn?.addEventListener('click', () => {
    if (!resetBtn.classList.contains('armed')) {
      resetBtn.classList.add('armed');
      resetBtn.textContent = 'Emin misin? Tekrar dokun';
      return;
    }
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('lastSeen'); localStorage.removeItem('revealSeen'); } catch {}
    location.reload();
  });

  // ---------- API uçları ----------

  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const fail = (msg, status = 400) => {
    throw new HttpError(status, msg);
  };

  function me() {
    const user = db.data.users[db.data.currentUser];
    if (!user) fail('Giriş yapmalısın.', 401);
    return user;
  }

  function conversation(convId, user) {
    const conv = db.data.conversations[convId];
    if (!conv || !conv.users.includes(user.id)) fail('Sohbet bulunamadı.', 404);
    return conv;
  }

  function convResult(conv, user, error) {
    if (error) fail(error);
    return { conversation: conversationView(conv, user.id) };
  }

  const wantsGender = (seeker, other) => seeker.interestedIn === 'herkes' || seeker.interestedIn === other.gender;

  const routes = [
    ['POST', /^\/api\/register$/, async (_, form) => {
      const get = (k) => form.get(k);
      const name = cleanText(get('name'), 30);
      const email = cleanText(get('email'), 100).toLowerCase();
      const password = get('password') || '';
      const age = parseInt(get('age'), 10);
      const hometown = cleanText(get('hometown'), 40);
      const occupation = cleanText(get('occupation'), 40);
      const files = form.getAll('photos').filter((f) => f && f.size);
      if (!name) fail('İsim gerekli.');
      if (!hometown) fail('Nereli olduğunu yaz.');
      if (!occupation) fail('Ne iş yaptığını yaz.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Geçerli bir e-posta gir.');
      if (password.length < 6) fail('Şifre en az 6 karakter olmalı.');
      if (!(age >= 18 && age <= 99)) fail('Yaş 18 ile 99 arasında olmalı.');
      if (!['kadin', 'erkek', 'diger'].includes(get('gender'))) fail('Cinsiyet seç.');
      if (!['kadin', 'erkek', 'herkes'].includes(get('interestedIn'))) fail('Kimi aradığını seç.');
      if (!files.length) fail('En az bir fotoğraf yükle.');
      if (files.length > MAX_PHOTOS) fail(`En fazla ${MAX_PHOTOS} fotoğraf olabilir.`);
      if (Object.values(db.data.users).some((u) => u.email === email)) fail('Bu e-posta zaten kayıtlı.');
      const user = {
        id: id(), name, email, age, hometown, occupation,
        gender: get('gender'), interestedIn: get('interestedIn'),
        password, // demo: sadece bu cihazda saklanır
        photos: await storePhotos(files), swipes: {}, createdAt: now(),
      };
      db.data.users[user.id] = user;
      db.data.currentUser = user.id;
      db.save();
      return { user: ownProfile(user) };
    }],
    ['POST', /^\/api\/login$/, (body) => {
      const email = cleanText(body.email, 100).toLowerCase();
      const user = Object.values(db.data.users).find((u) => u.email === email);
      if (!user || user.isBot || user.password !== body.password) fail('E-posta veya şifre hatalı.');
      db.data.currentUser = user.id;
      db.save();
      return { user: ownProfile(user) };
    }],
    ['POST', /^\/api\/logout$/, () => {
      db.data.currentUser = null;
      db.save();
      return { ok: true };
    }],
    ['GET', /^\/api\/me$/, () => ({ user: ownProfile(me()) })],
    ['PATCH', /^\/api\/me$/, (body) => {
      const user = me();
      const hometown = cleanText(body.hometown, 40);
      const occupation = cleanText(body.occupation, 40);
      if (!hometown || !occupation) fail('Memleket ve meslek boş olamaz.');
      const { profile, error } = cleanProfile(body.profile);
      if (error) fail(error);
      Object.assign(user, { hometown, occupation, profile });
      db.save();
      return { user: ownProfile(user) };
    }],
    ['POST', /^\/api\/me\/photos$/, async (_, form) => {
      const user = me();
      const files = form.getAll('photos').filter((f) => f && f.size);
      if (user.photos.length + files.length > MAX_PHOTOS) fail(`En fazla ${MAX_PHOTOS} fotoğraf olabilir.`);
      user.photos.push(...(await storePhotos(files)));
      db.save();
      return { user: ownProfile(user) };
    }],
    ['DELETE', /^\/api\/me\/photos\/([^/]+)$/, (_, __, [file]) => {
      const user = me();
      if (!user.photos.includes(file)) fail('Fotoğraf bulunamadı.', 404);
      if (user.photos.length === 1) fail('En az bir fotoğrafın kalmalı.');
      user.photos = user.photos.filter((f) => f !== file);
      delete db.data.photos[file];
      db.save();
      return { user: ownProfile(user) };
    }],
    ['GET', /^\/api\/discover$/, () => {
      const user = me();
      const candidates = Object.values(db.data.users)
        .filter((u) => u.id !== user.id && !(u.id in user.swipes))
        .filter((u) => wantsGender(user, u) && wantsGender(u, user))
        .filter((u) => u.swipes[user.id] !== false)
        .map(publicUser);
      return { candidates };
    }],
    ['POST', /^\/api\/swipe$/, (body) => {
      const user = me();
      const target = db.data.users[body.targetId];
      if (!target || target.id === user.id) fail('Kullanıcı bulunamadı.', 404);
      const like = !!body.like;
      user.swipes[target.id] = like;
      if (like) bots.onLiked(target, user);
      let conversation = null;
      if (like && target.swipes[user.id] === true) {
        const conv = { id: id(), users: [user.id, target.id], messages: [], questions: [], approvals: {}, createdAt: now() };
        db.data.conversations[conv.id] = conv;
        conversation = conversationView(conv, user.id);
        bots.react(conv);
      }
      db.save();
      return { match: !!conversation, conversation };
    }],
    ['GET', /^\/api\/conversations$/, () => {
      const user = me();
      const key = (c) => c.lastMessage?.at || c.createdAt;
      const conversations = Object.values(db.data.conversations)
        .filter((c) => c.users.includes(user.id))
        .map((c) => conversationView(c, user.id))
        .sort((a, b) => key(b).localeCompare(key(a)));
      return { conversations };
    }],
    ['GET', /^\/api\/conversations\/([^/]+)$/, (_, __, [convId]) => {
      const user = me();
      return convResult(conversation(convId, user), user);
    }],
    ['POST', /^\/api\/conversations\/([^/]+)\/messages$/, (body, _, [convId]) => {
      const user = me();
      const conv = conversation(convId, user);
      return convResult(conv, user, actions.sendChat(conv, user, body.text));
    }],
    ['POST', /^\/api\/conversations\/([^/]+)\/questions$/, (body, _, [convId]) => {
      const user = me();
      const conv = conversation(convId, user);
      return convResult(conv, user, actions.askQuestion(conv, user, body.text));
    }],
    ['POST', /^\/api\/conversations\/([^/]+)\/questions\/([^/]+)\/answer$/, (body, _, [convId, qid]) => {
      const user = me();
      const conv = conversation(convId, user);
      return convResult(conv, user, actions.answerQuestion(conv, user, qid, body.text));
    }],
    ['POST', /^\/api\/conversations\/([^/]+)\/approve$/, (_, __, [convId]) => {
      const user = me();
      const conv = conversation(convId, user);
      return convResult(conv, user, actions.approvePhotos(conv, user));
    }],
  ];

  const realFetch = window.fetch.bind(window);
  window.fetch = async (path, opts = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/api/')) return realFetch(path, opts);
    const method = opts.method || 'GET';
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    for (const [m, re, handler] of routes) {
      const match = method === m && re.exec(path);
      if (!match) continue;
      try {
        const form = opts.body instanceof FormData ? opts.body : null;
        const body = !form && opts.body ? JSON.parse(opts.body) : {};
        return json(200, await handler(body, form, match.slice(1).map(decodeURIComponent)));
      } catch (err) {
        return json(err.status || 500, { error: err.message });
      }
    }
    return json(404, { error: 'Bulunamadı.' });
  };

  // Sayfa yenilenince yarım kalan bot cevaplarını sürdür.
  bots.resumeAll();
})();
