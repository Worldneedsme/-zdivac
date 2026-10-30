const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { Server } = require('socket.io');
const db = require('./db');
const { createBots } = require('./bots');

const PORT = process.env.PORT || 3000;
const REQUIRED_QUESTIONS = 5;
const MAX_PHOTOS = 6;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- yardımcılar ----------

const id = () => crypto.randomBytes(12).toString('hex');
const now = () => new Date().toISOString();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passHash, 'hex'));
}

function userFromToken(token) {
  const userId = token && db.data.sessions[token];
  return userId ? db.data.users[userId] : null;
}

function auth(req, res, next) {
  const user = userFromToken(req.cookies.token);
  if (!user) return res.status(401).json({ error: 'Giriş yapmalısın.' });
  req.user = user;
  next();
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.data.sessions[token] = userId;
  db.save();
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  age: u.age,
  hometown: u.hometown || '',
  occupation: u.occupation || '',
  isBot: !!u.isBot,
});

function ownProfile(u) {
  return {
    ...publicUser(u),
    email: u.email,
    gender: u.gender,
    interestedIn: u.interestedIn,
    photos: u.photos.map((f) => `/photos/${f}`),
    photoIds: u.photos,
  };
}

function partnerOf(conv, userId) {
  return conv.users.find((u) => u !== userId);
}

function isRevealed(conv) {
  return conv.users.every((u) => conv.approvals[u]);
}

function answeredCount(conv) {
  return conv.questions.filter((q) => q.answer).length;
}

// Bir sohbetin, belirli bir kullanıcının gözünden görünümü.
// Fotoğraflar yalnızca her iki taraf da onay verdiyse eklenir.
function conversationView(conv, userId) {
  const partner = db.data.users[partnerOf(conv, userId)];
  const revealed = isRevealed(conv);
  const answered = answeredCount(conv);
  const pending = conv.questions.find((q) => !q.answer) || null;
  const lastMessage = conv.messages[conv.messages.length - 1] || null;
  return {
    id: conv.id,
    partner: {
      ...publicUser(partner),
      photos: revealed ? partner.photos.map((f) => `/photos/${f}`) : [],
    },
    messages: conv.messages,
    questions: conv.questions,
    answeredCount: Math.min(answered, REQUIRED_QUESTIONS),
    requiredQuestions: REQUIRED_QUESTIONS,
    canApprove: answered >= REQUIRED_QUESTIONS,
    pendingQuestion: pending,
    myApproval: !!conv.approvals[userId],
    partnerApproval: !!conv.approvals[partner.id],
    revealed,
    lastMessage,
    createdAt: conv.createdAt,
  };
}

function pushConversation(conv) {
  for (const u of conv.users) {
    io.to(`user:${u}`).emit('conversation', conversationView(conv, u));
  }
}

function getConversation(req, res) {
  const conv = db.data.conversations[req.params.id];
  if (!conv || !conv.users.includes(req.user.id)) {
    res.status(404).json({ error: 'Sohbet bulunamadı.' });
    return null;
  }
  return conv;
}

function cleanText(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function addMessage(conv, senderId, type, text, questionId = null) {
  const msg = { id: id(), senderId, type, text, questionId, at: now() };
  conv.messages.push(msg);
  return msg;
}

// ---------- fotoğraf yükleme ----------

const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, id() + ALLOWED_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new Error('Sadece JPG, PNG, WEBP veya GIF yükleyebilirsin.'));
  },
});

function photoUpload(req, res, next) {
  upload.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

function removeFiles(files = []) {
  for (const f of files) fs.rm(f.path, { force: true }, () => {});
}

// ---------- kimlik doğrulama ----------

const GENDERS = ['kadin', 'erkek', 'diger'];
const INTERESTS = ['kadin', 'erkek', 'herkes'];

app.post('/api/register', photoUpload, (req, res) => {
  const fail = (msg) => {
    removeFiles(req.files);
    res.status(400).json({ error: msg });
  };
  const name = cleanText(req.body.name, 30);
  const hometown = cleanText(req.body.hometown, 40);
  const occupation = cleanText(req.body.occupation, 40);
  const email = cleanText(req.body.email, 100).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const age = parseInt(req.body.age, 10);
  const { gender, interestedIn } = req.body;

  if (!name) return fail('İsim gerekli.');
  if (!hometown) return fail('Nereli olduğunu yaz.');
  if (!occupation) return fail('Ne iş yaptığını yaz.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Geçerli bir e-posta gir.');
  if (password.length < 6) return fail('Şifre en az 6 karakter olmalı.');
  if (!(age >= 18 && age <= 99)) return fail('Yaş 18 ile 99 arasında olmalı.');
  if (!GENDERS.includes(gender)) return fail('Cinsiyet seç.');
  if (!INTERESTS.includes(interestedIn)) return fail('Kimi aradığını seç.');
  if (!req.files || req.files.length === 0) return fail('En az bir fotoğraf yükle.');
  if (Object.values(db.data.users).some((u) => u.email === email)) return fail('Bu e-posta zaten kayıtlı.');

  const { salt, hash } = hashPassword(password);
  const user = {
    id: id(),
    name,
    email,
    age,
    gender,
    interestedIn,
    hometown,
    occupation,
    salt,
    passHash: hash,
    photos: req.files.map((f) => f.filename),
    swipes: {},
    createdAt: now(),
  };
  db.data.users[user.id] = user;
  startSession(res, user.id);
  res.json({ user: ownProfile(user) });
});

app.post('/api/login', (req, res) => {
  const email = cleanText(req.body.email, 100).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = Object.values(db.data.users).find((u) => u.email === email);
  if (!user || !user.passHash || !verifyPassword(password, user)) {
    return res.status(400).json({ error: 'E-posta veya şifre hatalı.' });
  }
  startSession(res, user.id);
  res.json({ user: ownProfile(user) });
});

app.post('/api/logout', (req, res) => {
  if (req.cookies.token) {
    delete db.data.sessions[req.cookies.token];
    db.save();
  }
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: ownProfile(req.user) }));

app.patch('/api/me', auth, (req, res) => {
  const hometown = cleanText(req.body.hometown, 40);
  const occupation = cleanText(req.body.occupation, 40);
  if (!hometown || !occupation) return res.status(400).json({ error: 'Memleket ve meslek boş olamaz.' });
  Object.assign(req.user, { hometown, occupation });
  db.save();
  res.json({ user: ownProfile(req.user) });
});

// ---------- profil fotoğrafları ----------

app.post('/api/me/photos', auth, photoUpload, (req, res) => {
  const files = req.files || [];
  if (req.user.photos.length + files.length > MAX_PHOTOS) {
    removeFiles(files);
    return res.status(400).json({ error: `En fazla ${MAX_PHOTOS} fotoğraf olabilir.` });
  }
  req.user.photos.push(...files.map((f) => f.filename));
  db.save();
  res.json({ user: ownProfile(req.user) });
});

app.delete('/api/me/photos/:file', auth, (req, res) => {
  const { file } = req.params;
  if (!req.user.photos.includes(file)) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
  if (req.user.photos.length === 1) return res.status(400).json({ error: 'En az bir fotoğrafın kalmalı.' });
  req.user.photos = req.user.photos.filter((f) => f !== file);
  db.save();
  fs.rm(path.join(UPLOAD_DIR, file), { force: true }, () => {});
  res.json({ user: ownProfile(req.user) });
});

// Fotoğraflar herkese açık değil: sadece sahibi ve
// "fotoğraf açma" onayı karşılıklı verilmiş eşleşmeler görebilir.
app.get('/photos/:file', auth, (req, res) => {
  const { file } = req.params;
  const owner = Object.values(db.data.users).find((u) => u.photos.includes(file));
  if (!owner) return res.sendStatus(404);
  const allowed =
    owner.id === req.user.id ||
    Object.values(db.data.conversations).some(
      (c) => c.users.includes(owner.id) && c.users.includes(req.user.id) && isRevealed(c)
    );
  if (!allowed) return res.sendStatus(403);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(UPLOAD_DIR, file));
});

// ---------- keşfet / kaydırma ----------

function wantsGender(seeker, other) {
  return seeker.interestedIn === 'herkes' || seeker.interestedIn === other.gender;
}

app.get('/api/discover', auth, (req, res) => {
  const me = req.user;
  const candidates = Object.values(db.data.users)
    .filter((u) => u.id !== me.id && !(u.id in me.swipes))
    .filter((u) => wantsGender(me, u) && wantsGender(u, me))
    .filter((u) => u.swipes[me.id] !== false)
    .map(publicUser);
  res.json({ candidates });
});

app.post('/api/swipe', auth, (req, res) => {
  const me = req.user;
  const target = db.data.users[req.body.targetId];
  if (!target || target.id === me.id) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const like = !!req.body.like;
  me.swipes[target.id] = like;
  if (like) bots.onLiked(target, me);

  let conversation = null;
  if (like && target.swipes[me.id] === true) {
    const conv = {
      id: id(),
      users: [me.id, target.id],
      messages: [],
      questions: [],
      approvals: {},
      createdAt: now(),
    };
    db.data.conversations[conv.id] = conv;
    conversation = conversationView(conv, me.id);
    io.to(`user:${target.id}`).emit('match', conversationView(conv, target.id));
    bots.react(conv);
  }
  db.save();
  res.json({ match: !!conversation, conversation });
});

// ---------- sohbetler ----------

app.get('/api/conversations', auth, (req, res) => {
  const list = Object.values(db.data.conversations)
    .filter((c) => c.users.includes(req.user.id))
    .map((c) => conversationView(c, req.user.id))
    .sort((a, b) => (b.lastMessage?.at || b.createdAt).localeCompare(a.lastMessage?.at || a.createdAt));
  res.json({ conversations: list });
});

app.get('/api/conversations/:id', auth, (req, res) => {
  const conv = getConversation(req, res);
  if (conv) res.json({ conversation: conversationView(conv, req.user.id) });
});

// Sohbet işlemleri. Hem HTTP uçları hem botlar bunları kullanır.
// Hata varsa mesajını döndürür, başarılıysa null.
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
    const text = cleanText(rawText, 1000);
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
    addMessage(
      conv,
      null,
      'system',
      isRevealed(conv) ? 'İkiniz de onay verdiniz. Fotoğraflar artık açık! 📸' : `${user.name} fotoğrafları açmayı onayladı.`
    );
    return commit(conv);
  },
};

function conversationRoute(handler) {
  return (req, res) => {
    const conv = getConversation(req, res);
    if (!conv) return;
    const error = handler(conv, req);
    if (error) return res.status(400).json({ error });
    res.json({ conversation: conversationView(conv, req.user.id) });
  };
}

app.post('/api/conversations/:id/messages', auth, conversationRoute((conv, req) =>
  actions.sendChat(conv, req.user, req.body.text)));

app.post('/api/conversations/:id/questions', auth, conversationRoute((conv, req) =>
  actions.askQuestion(conv, req.user, req.body.text)));

app.post('/api/conversations/:id/questions/:qid/answer', auth, conversationRoute((conv, req) =>
  actions.answerQuestion(conv, req.user, req.params.qid, req.body.text)));

app.post('/api/conversations/:id/approve', auth, conversationRoute((conv, req) =>
  actions.approvePhotos(conv, req.user)));

// ---------- gerçek zamanlı ----------

io.use((socket, next) => {
  const cookies = Object.fromEntries(
    (socket.handshake.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
  );
  const user = userFromToken(cookies.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.userId = user.id;
  next();
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
});

// ---------- botlar ----------

const bots = createBots({ db, io, uploadDir: UPLOAD_DIR, actions, requiredQuestions: REQUIRED_QUESTIONS });
bots.seed();
bots.resumeAll();
server.listen(PORT, () => console.log(`Kör Randevu çalışıyor: http://localhost:${PORT}`));
