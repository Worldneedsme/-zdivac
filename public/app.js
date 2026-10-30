const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  me: null,
  candidates: [],
  conversations: new Map(),
  currentId: null,
  mode: 'chat', // 'chat' | 'question' | 'answer'
  socket: null,
  typing: new Set(), // karşı tarafın yazdığı sohbetler
  lastSeen: loadLastSeen(),
};

// ---------- yardımcılar ----------

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) opts.body = form;
  else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
  return data;
}

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function showScreen(name) {
  for (const s of ['auth', 'app', 'chat']) $('#' + s).classList.toggle('hidden', s !== name);
}

function gradientFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(160deg, hsl(${h} 70% 62%), hsl(${(h + 50) % 360} 75% 45%))`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function loadLastSeen() {
  try { return JSON.parse(localStorage.getItem('lastSeen') || '{}'); } catch { return {}; }
}
function markSeen(conv) {
  const at = conv.lastMessage?.at || conv.createdAt;
  state.lastSeen[conv.id] = at;
  try { localStorage.setItem('lastSeen', JSON.stringify(state.lastSeen)); } catch {}
}
function isUnread(conv) {
  const last = conv.lastMessage;
  if (!last || last.senderId === state.me.id) return false;
  return !state.lastSeen[conv.id] || state.lastSeen[conv.id] < last.at;
}

// "📍 İzmir · 💼 Mimar"
function infoLine(u) {
  return [u.hometown && `📍 ${u.hometown}`, u.occupation && `💼 ${u.occupation}`].filter(Boolean).join(' · ');
}

function setAvatar(el, partner) {
  if (partner.photos.length) {
    el.style.background = `center / cover url("${partner.photos[0]}")`;
    el.textContent = '';
  } else {
    el.style.background = gradientFor(partner.id);
    el.textContent = partner.name[0]?.toUpperCase() || '?';
  }
}

// ---------- giriş / kayıt ----------

$$('[data-auth-tab]').forEach((btn) =>
  btn.addEventListener('click', () => {
    $$('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b === btn));
    $('#login-form').classList.toggle('hidden', btn.dataset.authTab !== 'login');
    $('#register-form').classList.toggle('hidden', btn.dataset.authTab !== 'register');
    $('#auth-error').textContent = '';
  })
);

$('#register-form [name=photos]').addEventListener('change', (e) => {
  const files = [...e.target.files].slice(0, 6);
  $('#register-preview').innerHTML = files
    .map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`)
    .join('');
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const { user } = await api('/api/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } });
    onLoggedIn(user);
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const { user } = await api('/api/register', { method: 'POST', form: new FormData(e.target) });
    onLoggedIn(user);
  } catch (err) {
    $('#auth-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.socket?.disconnect();
  state.me = null;
  state.conversations.clear();
  showScreen('auth');
});

async function onLoggedIn(user) {
  state.me = user;
  $('#auth-error').textContent = '';
  showScreen('app');
  connectSocket();
  renderProfile();
  await Promise.all([loadCandidates(), loadConversations()]);
  switchView('discover');
}

// ---------- gezinme ----------

function switchView(name) {
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== 'view-' + name));
  if (name === 'chats') renderChatList();
}
$$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

// ---------- gerçek zamanlı ----------

function connectSocket() {
  state.socket?.disconnect();
  const socket = io();
  state.socket = socket;
  socket.on('conversation', (conv) => upsertConversation(conv));
  socket.on('typing', ({ conversationId, typing }) => {
    if (typing) state.typing.add(conversationId);
    else state.typing.delete(conversationId);
    if (state.currentId === conversationId) renderChat();
    renderChatList();
  });
  socket.on('match', (conv) => {
    upsertConversation(conv);
    state.candidates = state.candidates.filter((c) => c.id !== conv.partner.id);
    renderCards();
    showMatch(conv);
  });
}

function upsertConversation(conv) {
  const prev = state.conversations.get(conv.id);
  state.conversations.set(conv.id, conv);
  if (state.currentId === conv.id) {
    // Bana yeni bir soru geldiyse otomatik cevap moduna geç.
    const newQuestionForMe =
      conv.pendingQuestion && conv.pendingQuestion.askerId !== state.me.id && prev?.pendingQuestion?.id !== conv.pendingQuestion.id;
    if (newQuestionForMe) state.mode = 'answer';
    renderChat();
    markSeen(conv);
    if (!prev?.revealed && conv.revealed) toast('📸 Fotoğraflar açıldı!');
  }
  renderChatList();
}

// ---------- keşfet ----------

async function loadCandidates() {
  const { candidates } = await api('/api/discover');
  state.candidates = candidates;
  renderCards();
}

function renderCards() {
  const stack = $('#card-stack');
  const top = state.candidates.slice(0, 3).reverse();
  $('#btn-like').disabled = $('#btn-pass').disabled = top.length === 0;
  if (!top.length) {
    stack.innerHTML = `<div class="empty"><div class="big">🌙</div><p>Şimdilik yeni kimse yok.<br>Biraz sonra tekrar bak!</p>
      <button class="btn secondary" id="btn-refresh">Yenile</button></div>`;
    $('#btn-refresh').onclick = loadCandidates;
    return;
  }
  stack.innerHTML = top
    .map(
      (c, i) => `
      <div class="card" data-id="${c.id}" style="background:${gradientFor(c.id)};transform:scale(${1 - (top.length - 1 - i) * 0.04}) translateY(${(top.length - 1 - i) * 10}px)">
        <div class="mystery">?</div>
        <div class="stamp like">BEĞEN</div>
        <div class="stamp nope">GEÇ</div>
        ${c.isBot ? '<div class="bot-tag">🤖 Bot</div>' : ''}
        <div class="card-name">${esc(c.name)}, <small>${c.age}</small></div>
        ${infoLine(c) ? `<div class="card-info">${esc(infoLine(c))}</div>` : ''}
        <div class="card-note">🔒 Fotoğraflar 5 sorudan sonra</div>
      </div>`
    )
    .join('');
  enableDrag(stack.lastElementChild);
}

function enableDrag(card) {
  let startX = 0, dx = 0, dragging = false;
  card.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 15}deg)`;
    card.querySelector('.stamp.like').style.opacity = Math.max(0, dx / 100);
    card.querySelector('.stamp.nope').style.opacity = Math.max(0, -dx / 100);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = '';
    if (Math.abs(dx) > 100) swipe(dx > 0);
    else {
      card.style.transform = '';
      card.querySelectorAll('.stamp').forEach((s) => (s.style.opacity = 0));
    }
    dx = 0;
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

async function swipe(like) {
  const target = state.candidates[0];
  if (!target) return;
  const card = $('#card-stack').lastElementChild;
  if (card) {
    card.style.transform = `translateX(${like ? 600 : -600}px) rotate(${like ? 30 : -30}deg)`;
    card.style.opacity = 0;
  }
  state.candidates.shift();
  setTimeout(renderCards, 250);
  try {
    const res = await api('/api/swipe', { method: 'POST', body: { targetId: target.id, like } });
    if (res.match) {
      upsertConversation(res.conversation);
      showMatch(res.conversation);
    }
  } catch (err) {
    toast(err.message);
  }
}
$('#btn-like').addEventListener('click', () => swipe(true));
$('#btn-pass').addEventListener('click', () => swipe(false));

function showMatch(conv) {
  const info = infoLine(conv.partner);
  $('#match-text').textContent = `${conv.partner.name} (${conv.partner.age}${info ? ', ' + info : ''}) ile eşleştin. Birbirinize 5 soru sorun, sonra isterseniz fotoğraflar açılsın!`;
  $('#match-modal').classList.remove('hidden');
  $('#btn-match-chat').onclick = () => {
    $('#match-modal').classList.add('hidden');
    openChat(conv.id);
  };
}
$('#btn-match-close').addEventListener('click', () => $('#match-modal').classList.add('hidden'));

// ---------- sohbet listesi ----------

async function loadConversations() {
  const { conversations } = await api('/api/conversations');
  state.conversations = new Map(conversations.map((c) => [c.id, c]));
  renderChatList();
}

function sortedConversations() {
  const key = (c) => c.lastMessage?.at || c.createdAt;
  return [...state.conversations.values()].sort((a, b) => key(b).localeCompare(key(a)));
}

function previewText(conv) {
  const m = conv.lastMessage;
  if (state.typing.has(conv.id)) return 'yazıyor...';
  if (!m) return 'Yeni eşleşme — ilk soruyu sen sor!';
  const prefix = m.senderId === state.me.id ? 'Sen: ' : '';
  if (m.type === 'question') return `${prefix}❓ ${m.text}`;
  if (m.type === 'answer') return `${prefix}💬 ${m.text}`;
  return prefix + m.text;
}

function renderChatList() {
  const list = sortedConversations();
  const unread = list.filter(isUnread).length;
  $('#chat-badge').textContent = unread;
  $('#chat-badge').classList.toggle('hidden', unread === 0);
  const ul = $('#chat-list');
  if (!list.length) {
    ul.innerHTML = `<li class="empty"><div class="big">💬</div><p>Henüz eşleşmen yok. Keşfet'ten birini beğen!</p></li>`;
    return;
  }
  ul.innerHTML = list
    .map((c) => {
      const pill = c.revealed
        ? '<span class="pill ok">📸 Açık</span>'
        : `<span class="pill">❓ ${c.answeredCount}/${c.requiredQuestions}</span>`;
      return `<li class="chat-item" data-id="${c.id}">
        <div class="avatar" data-avatar="${c.id}"></div>
        <div class="meta">
          <div class="title"><span>${esc(c.partner.name)}, ${c.partner.age}${c.partner.isBot ? ' 🤖' : ''}${isUnread(c) ? ' •' : ''}</span>${pill}</div>
          ${infoLine(c.partner) ? `<div class="info">${esc(infoLine(c.partner))}</div>` : ''}
          <div class="preview">${esc(previewText(c))}</div>
        </div>
      </li>`;
    })
    .join('');
  list.forEach((c) => setAvatar(ul.querySelector(`[data-avatar="${c.id}"]`), c.partner));
  ul.querySelectorAll('.chat-item').forEach((li) => li.addEventListener('click', () => openChat(li.dataset.id)));
}

// ---------- sohbet ekranı ----------

function openChat(id) {
  const conv = state.conversations.get(id);
  if (!conv) return;
  state.currentId = id;
  state.mode = conv.pendingQuestion && conv.pendingQuestion.askerId !== state.me.id ? 'answer' : 'chat';
  showScreen('chat');
  renderChat(true);
  markSeen(conv);
  renderChatList();
  $('#composer-input').focus();
}

$('#btn-back').addEventListener('click', () => {
  state.currentId = null;
  showScreen('app');
  switchView('chats');
});

function messageHtml(m, conv) {
  if (m.type === 'system') return `<div class="system">${esc(m.text)}</div>`;
  const mine = m.senderId === state.me.id;
  let inner = esc(m.text);
  if (m.type === 'question') {
    const n = conv.questions.findIndex((q) => q.id === m.questionId) + 1;
    inner = `<span class="tag">❓ SORU ${n}/${conv.requiredQuestions}</span>${inner}`;
  } else if (m.type === 'answer') {
    const q = conv.questions.find((q) => q.id === m.questionId);
    inner = `<span class="tag">💬 CEVAP</span><span class="quote">${esc(q?.text)}</span>${inner}`;
  }
  return `<div class="msg ${m.type} ${mine ? 'mine' : 'theirs'}">${inner}<span class="time">${fmtTime(m.at)}</span></div>`;
}

function renderChat(scrollToBottom = false) {
  const conv = state.conversations.get(state.currentId);
  if (!conv) return;
  const me = state.me.id;
  const p = conv.partner;
  const pending = conv.pendingQuestion;
  const pendingForMe = pending && pending.askerId !== me;
  const done = conv.answeredCount >= conv.requiredQuestions;

  // Başlık
  $('#chat-name').textContent = `${p.name}, ${p.age}${p.isBot ? ' 🤖' : ''}`;
  $('#chat-info').textContent = infoLine(p);
  $('#chat-status').textContent = state.typing.has(conv.id)
    ? 'yazıyor...'
    : conv.revealed ? '📸' : '🔒';
  setAvatar($('#chat-avatar'), p);

  // İlerleme
  $('#progress-text').textContent = `❓ ${conv.answeredCount}/${conv.requiredQuestions}`;
  $('#progress-bar').style.width = `${(conv.answeredCount / conv.requiredQuestions) * 100}%`;

  // Fotoğraf onayı / galeri
  const panel = $('#reveal-panel');
  if (conv.revealed) {
    panel.classList.remove('hidden');
    panel.innerHTML = `<div class="thumb-strip"><span>📸</span>${p.photos.map((src) => `<img src="${src}" alt="">`).join('')}</div>`;
  } else if (conv.canApprove) {
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="reveal-row">
        <div class="reveal-text">
          <b>🎉 Fotoğraflar açılsın mı?</b>
          <div class="reveal-status">
            <span class="pill ${conv.myApproval ? 'ok' : ''}">Sen: ${conv.myApproval ? 'Onayladın ✓' : 'Bekliyor'}</span>
            <span class="pill ${conv.partnerApproval ? 'ok' : ''}">${esc(p.name)}: ${conv.partnerApproval ? 'Onayladı ✓' : 'Bekliyor'}</span>
          </div>
        </div>
        ${conv.myApproval ? '' : '<button class="btn ok small" id="btn-approve">Onayla</button>'}
      </div>`;
    const btn = $('#btn-approve');
    if (btn) btn.onclick = approve;
  } else {
    panel.classList.add('hidden');
  }

  // Mesajlar
  const box = $('#messages');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = conv.messages.length
    ? conv.messages.map((m) => messageHtml(m, conv)).join('')
    : `<div class="system">Sadece isim ve yaş görünür. Tanışmak için sohbet edin ve sırayla soru sorun! (${conv.requiredQuestions} soru → fotoğraf onayı)</div>`;
  if (state.typing.has(conv.id)) box.insertAdjacentHTML('beforeend', '<div class="msg theirs typing"><span></span><span></span><span></span></div>');
  box.querySelectorAll('img').forEach((img) => img.addEventListener('click', () => openLightbox(img.src)));
  panel.querySelectorAll('img').forEach((img) => img.addEventListener('click', () => openLightbox(img.src)));
  if (scrollToBottom || nearBottom) box.scrollTop = box.scrollHeight;

  // Bekleyen soru
  const pp = $('#pending-panel');
  if (pending) {
    pp.classList.remove('hidden');
    pp.innerHTML = pendingForMe
      ? `<b>❓ ${esc(p.name)} sana sordu:</b>${esc(pending.text)}`
      : `<b>⏳ Sorunun cevabı bekleniyor:</b>${esc(pending.text)}`;
  } else {
    pp.classList.add('hidden');
  }

  // Yazma alanı modları
  if (state.mode === 'answer' && !pendingForMe) state.mode = 'chat';
  if (state.mode === 'question' && (pending || done)) state.mode = 'chat';
  renderComposer(conv, { pendingForMe, canAsk: !pending && !done });
}

function renderComposer(conv, { pendingForMe, canAsk }) {
  const modes = [{ key: 'chat', label: 'Mesaj' }];
  if (pendingForMe) modes.push({ key: 'answer', label: '✍️ Cevap' });
  else modes.push({ key: 'question', label: '❓ Soru', disabled: !canAsk });

  $('.mode-switch').innerHTML = modes
    .map((m) => `<button type="button" class="mode ${state.mode === m.key ? 'active' : ''}" data-mode="${m.key}" ${m.disabled ? 'disabled' : ''}>${m.label}</button>`)
    .join('');
  $$('.mode-switch .mode').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      renderComposer(conv, { pendingForMe, canAsk });
      $('#composer-input').focus();
    })
  );

  const input = $('#composer-input');
  $('#composer').classList.toggle('answering', state.mode !== 'chat');
  input.placeholder = {
    chat: 'Mesaj yaz...',
    question: `Soru ${conv.questions.length + 1}/${conv.requiredQuestions}: ne soracaksın?`,
    answer: 'Cevabını yaz...',
  }[state.mode];
}

$('#composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#composer-input');
  const text = input.value.trim();
  const conv = state.conversations.get(state.currentId);
  if (!text || !conv) return;
  const base = `/api/conversations/${conv.id}`;
  const url = {
    chat: `${base}/messages`,
    question: `${base}/questions`,
    answer: `${base}/questions/${conv.pendingQuestion?.id}/answer`,
  }[state.mode];
  input.value = '';
  try {
    const res = await api(url, { method: 'POST', body: { text } });
    if (state.mode !== 'chat') state.mode = 'chat';
    upsertConversation(res.conversation);
    $('#messages').scrollTop = $('#messages').scrollHeight;
  } catch (err) {
    input.value = text;
    toast(err.message);
  }
});

async function approve() {
  try {
    const res = await api(`/api/conversations/${state.currentId}/approve`, { method: 'POST' });
    upsertConversation(res.conversation);
  } catch (err) {
    toast(err.message);
  }
}

function openLightbox(src) {
  const lb = $('#lightbox');
  lb.querySelector('img').src = src;
  lb.classList.remove('hidden');
}
$('#lightbox').addEventListener('click', () => $('#lightbox').classList.add('hidden'));

// ---------- profil ----------

function renderProfile() {
  const me = state.me;
  $('#profile-name').textContent = `${me.name}, ${me.age}`;
  $('#profile-info').textContent = infoLine(me);
  $('#profile-form [name=hometown]').value = me.hometown || '';
  $('#profile-form [name=occupation]').value = me.occupation || '';
  $('#profile-photos').innerHTML = me.photos
    .map(
      (src, i) => `<div class="photo"><img src="${src}" alt="">
        ${me.photos.length > 1 ? `<button class="del" data-file="${me.photoIds[i]}" title="Sil">✕</button>` : ''}</div>`
    )
    .join('');
  $$('#profile-photos img').forEach((img) => img.addEventListener('click', () => openLightbox(img.src)));
  $$('#profile-photos .del').forEach((b) =>
    b.addEventListener('click', async () => {
      // İlk dokunuş onay ister, ikincisi siler.
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Sil?';
        return;
      }
      try {
        const { user } = await api(`/api/me/photos/${b.dataset.file}`, { method: 'DELETE' });
        state.me = user;
        renderProfile();
      } catch (err) {
        toast(err.message);
      }
    })
  );
}

$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const { user } = await api('/api/me', {
      method: 'PATCH',
      body: { hometown: f.get('hometown'), occupation: f.get('occupation') },
    });
    state.me = user;
    renderProfile();
    toast('Bilgilerin kaydedildi.');
  } catch (err) {
    toast(err.message);
  }
});

$('#add-photos').addEventListener('change', async (e) => {
  const form = new FormData();
  for (const f of e.target.files) form.append('photos', f);
  e.target.value = '';
  try {
    const { user } = await api('/api/me/photos', { method: 'POST', form });
    state.me = user;
    renderProfile();
    toast('Fotoğraf eklendi.');
  } catch (err) {
    toast(err.message);
  }
});

// ---------- ekran yüksekliği ----------

// iOS klavye açılınca sayfayı yukarı iter. Uygulamayı görünen alana
// sığdırıp kaymayı sıfırlayarak başlık ve yazma alanını ekranda tutar.
function fitViewport() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
  window.scrollTo(0, 0);
}
window.visualViewport?.addEventListener('resize', fitViewport);
window.addEventListener('resize', fitViewport);
document.addEventListener('focusout', () => setTimeout(fitViewport, 100));
fitViewport();

// ---------- başlangıç ----------

api('/api/me')
  .then(({ user }) => onLoggedIn(user))
  .catch(() => showScreen('auth'));
