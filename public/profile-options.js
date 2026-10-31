// Profil kartındaki seçenekler ve doğrulama. Sunucu (require), tarayıcı
// (window.PROFILE_OPTIONS) ve demo aynı dosyayı kullanır.
(function (root) {
  const OPTIONS = {
    education: ['Lise', 'Ön lisans', 'Lisans', 'Yüksek lisans', 'Doktora'],
    zodiac: ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'],
    smoking: ['İçmiyor', 'Ara sıra', 'İçiyor'],
    drinking: ['İçmiyor', 'Sosyal içici', 'Seviyor'],
    exercise: ['Hiç', 'Bazen', 'Sık sık', 'Her gün'],
    relation: ['Uzun ilişki', 'Eğlenceli bir şey', 'Arkadaşlık', 'Henüz bilmiyor'],
    interests: [
      'Müzik', 'Konser', 'Spor', 'Yoga', 'Seyahat', 'Kamp', 'Doğa', 'Deniz', 'Kitap', 'Sinema',
      'Dizi', 'Yemek', 'Kahve', 'Oyun', 'Sanat', 'Dans', 'Fotoğraf', 'Hayvanlar', 'Teknoloji', 'Moda',
    ],
  };
  const MAX_INTERESTS = 5;

  // Kartta gösterim sırası ve simgeleri.
  const FIELDS = [
    { key: 'height', label: 'Boy', icon: '📏', format: (v) => `${v} cm` },
    { key: 'weight', label: 'Kilo', icon: '⚖️', format: (v) => `${v} kg` },
    { key: 'education', label: 'Eğitim', icon: '🎓' },
    { key: 'zodiac', label: 'Burç', icon: '✨' },
    { key: 'exercise', label: 'Spor', icon: '🏋️', format: (v) => `Spor: ${v}` },
    { key: 'smoking', label: 'Sigara', icon: '🚬', format: (v) => `Sigara: ${v}` },
    { key: 'drinking', label: 'Alkol', icon: '🍷', format: (v) => `Alkol: ${v}` },
    { key: 'relation', label: 'Aradığı', icon: '💞' },
  ];

  const intIn = (v, min, max) => {
    const n = parseInt(v, 10);
    return n >= min && n <= max ? n : null;
  };

  // Gelen veriyi temizler. Boş bırakılan alanlar profilden çıkar.
  // Hatalı değerde { error } döner.
  function cleanProfile(input = {}) {
    const profile = {};
    const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 200) : '';
    if (bio) profile.bio = bio;

    if (input.height !== undefined && input.height !== '' && input.height !== null) {
      profile.height = intIn(input.height, 140, 220);
      if (profile.height === null) return { error: 'Boy 140 ile 220 cm arasında olmalı.' };
    }
    if (input.weight !== undefined && input.weight !== '' && input.weight !== null) {
      profile.weight = intIn(input.weight, 40, 200);
      if (profile.weight === null) return { error: 'Kilo 40 ile 200 kg arasında olmalı.' };
    }
    for (const key of ['education', 'zodiac', 'smoking', 'drinking', 'exercise', 'relation']) {
      const v = input[key];
      if (!v) continue;
      if (!OPTIONS[key].includes(v)) return { error: 'Geçersiz bir seçim yapıldı.' };
      profile[key] = v;
    }
    const interests = Array.isArray(input.interests) ? [...new Set(input.interests)] : [];
    if (interests.some((i) => !OPTIONS.interests.includes(i))) return { error: 'Geçersiz ilgi alanı.' };
    if (interests.length > MAX_INTERESTS) return { error: `En fazla ${MAX_INTERESTS} ilgi alanı seçebilirsin.` };
    if (interests.length) profile.interests = interests;
    return { profile };
  }

  const api = { OPTIONS, FIELDS, MAX_INTERESTS, cleanProfile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PROFILE_OPTIONS = api;
})(this);
