// Fotoğraflar açıldığında oynayan sade, beyaz zeminli gösteri.
// Zamanlama tamamen CSS'te (style.css, "fotoğraf açılış gösterisi");
// burada sadece içerik kurulur ve oynatma sınıfı eklenir.
(function () {
  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  let playing = false;

  function playReveal({ partner, onLook }) {
    const overlay = document.getElementById('reveal-show');
    if (!overlay || playing || !partner.photos.length) return;
    playing = true;
    const [main, ...rest] = partner.photos;
    const stage = overlay.querySelector('.rs-stage');

    stage.innerHTML = `
      <p class="rs-caption">Fotoğraflar açıldı</p>
      <div class="rs-photo">
        <span class="rs-ripple"></span>
        <div class="rs-iris"><img src="${main}" alt=""></div>
      </div>
      <div class="rs-title">
        <svg class="rs-heart" viewBox="0 0 24 24" aria-hidden="true">
          <path pathLength="1" d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>
        </svg>
        <h2>${esc(partner.name)}, <span>${partner.age}</span></h2>
      </div>
      <i class="rs-rule"></i>
      ${rest.length ? `<div class="rs-thumbs">${rest.map((src, i) => `<img src="${src}" alt="" style="--i:${i}">`).join('')}</div>` : ''}
      <div class="rs-actions">
        <button type="button" class="rs-btn" data-act="look">Fotoğraflara bak</button>
        <button type="button" class="rs-link" data-act="close">Sohbete dön</button>
      </div>`;

    overlay.className = 'reveal-show';
    // Bir kare bekle ki başlangıç durumu çizilsin, sonra geçişler başlasın.
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('rs-play')));

    const close = () => {
      overlay.classList.add('rs-out');
      setTimeout(() => {
        overlay.className = 'reveal-show hidden';
        stage.innerHTML = '';
        playing = false;
      }, 400);
    };
    stage.querySelector('[data-act=close]').onclick = close;
    stage.querySelector('[data-act=look]').onclick = () => {
      close();
      onLook?.();
    };
    stage.querySelectorAll('.rs-thumbs img, .rs-iris img').forEach((img) =>
      img.addEventListener('click', () => {
        close();
        onLook?.(img.src);
      })
    );
  }

  window.playReveal = playReveal;
})();
