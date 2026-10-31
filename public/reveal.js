// Fotoğraflar açıldığında oynayan tam ekran gösteri:
// geri sayım → konfeti/kalp patlaması → kartlar dönerek açılır → iki yüz buluşur.
(function () {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const COLORS = ['#fd3a6a', '#ff7854', '#ffd166', '#ffffff', '#ff9fb8', '#c77dff'];

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // ---------- parçacıklar ----------

  function startParticles(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    let parts = [];
    let running = true;

    function burst(x, y, count, spread = Math.PI * 2, angle = 0, speed = 9) {
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = speed * (0.4 + Math.random() * 0.8);
        const heart = Math.random() < 0.3;
        parts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          size: heart ? 14 + Math.random() * 14 : 5 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          heart,
          life: 1,
          decay: 0.006 + Math.random() * 0.008,
        });
      }
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W(), H());
      parts = parts.filter((p) => p.life > 0 && p.y < H() + 40);
      for (const p of parts) {
        p.vy += 0.22; // yerçekimi
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.heart) {
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♥', 0, 0);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      // Ortadan büyük patlama + iki alt köşeden yukarı fışkırma.
      celebrate() {
        burst(W() / 2, H() * 0.42, 140, Math.PI * 2, 0, 11);
        burst(0, H(), 70, 0.7, -Math.PI / 3, 16);
        burst(W(), H(), 70, 0.7, (-2 * Math.PI) / 3, 16);
      },
      sprinkle() {
        burst(Math.random() * W(), -10, 25, 0.8, Math.PI / 2, 3);
      },
      stop() {
        running = false;
        ctx.clearRect(0, 0, W(), H());
      },
    };
  }

  // ---------- gösteri ----------

  let playing = false;

  async function playReveal({ partner, me, onLook }) {
    const overlay = document.getElementById('reveal-show');
    if (!overlay || playing) return;
    playing = true;
    const photos = partner.photos.slice(0, 3);
    const stage = overlay.querySelector('.rs-stage');
    const n = photos.length;

    stage.innerHTML = `
      <div class="rs-count"></div>
      <div class="rs-cards">
        ${photos.map((src, i) => `
          <div class="rs-card" style="--i:${i};--n:${n}">
            <div class="rs-face rs-front"><span>?</span></div>
            <div class="rs-face rs-back"><img src="${src}" alt=""><i class="rs-shine"></i></div>
          </div>`).join('')}
      </div>
      <div class="rs-meet">
        <div class="rs-avatar left" style="background-image:url('${me.photos[0] || ''}')"></div>
        <div class="rs-heart">♥</div>
        <div class="rs-avatar right" style="background-image:url('${partner.photos[0] || ''}')"></div>
      </div>
      <div class="rs-text">
        <h2>Yüzler açıldı!</h2>
        <p>${esc(partner.name)} ile artık birbirinizi görebilirsiniz 📸</p>
        <div class="rs-actions">
          <button type="button" class="btn primary" data-act="look">Fotoğraflara bak</button>
          <button type="button" class="btn rs-ghost" data-act="close">Sohbete dön</button>
        </div>
      </div>`;

    overlay.className = 'reveal-show';
    const particles = reduceMotion ? null : startParticles(overlay.querySelector('canvas'));
    let sprinkler;

    const close = () => {
      overlay.classList.add('rs-out');
      clearInterval(sprinkler);
      setTimeout(() => {
        particles?.stop();
        overlay.className = 'reveal-show hidden';
        stage.innerHTML = '';
        playing = false;
      }, 350);
    };
    stage.querySelector('[data-act=close]').onclick = close;
    stage.querySelector('[data-act=look]').onclick = () => {
      close();
      onLook?.();
    };

    // 1) Geri sayım
    const count = stage.querySelector('.rs-count');
    if (!reduceMotion) {
      for (const num of ['3', '2', '1']) {
        count.textContent = num;
        count.classList.remove('pop');
        void count.offsetWidth; // animasyonu yeniden başlat
        count.classList.add('pop');
        await wait(750);
      }
    }
    count.remove();

    // 2) Patlama
    overlay.classList.add('rs-flash');
    particles?.celebrate();
    sprinkler = particles ? setInterval(() => particles.sprinkle(), 260) : null;

    // 3) Kartlar sırayla dönerek açılır
    const cards = [...stage.querySelectorAll('.rs-card')];
    overlay.classList.add('rs-cards-in');
    await wait(450);
    for (const card of cards) {
      card.classList.add('flipped');
      await wait(380);
    }
    await wait(900);

    // 4) Kartlar yelpaze gibi açılıp kenara çekilir, iki yüz buluşur
    overlay.classList.add('rs-meet-in');
    await wait(500);
    particles?.celebrate();
    overlay.classList.add('rs-text-in');
    setTimeout(() => clearInterval(sprinkler), 2500);
  }

  window.playReveal = playReveal;
})();
