// Eşleşme süre kuralları. Sunucu (require), tarayıcı (window.MATCH_RULES)
// ve demo aynı dosyayı kullanır.
//   1. aşama (start):     eşleşmeden sonra 24 saat içinde iki taraf da en az bir mesaj yazmalı.
//   2. aşama (questions): ikisi de yazdıktan sonra 8 saat içinde 5 soru cevaplanmalı.
// Sorular tamamlanınca süre durur (phase: done). Süre dolarsa sohbet kapanır.
(function (root) {
  const HOUR = 60 * 60 * 1000;
  const START_WINDOW = 24 * HOUR;
  const QUESTION_WINDOW = 8 * HOUR;

  // İki tarafın da ilk kez yazmış olduğu an (ikinci kişinin ilk mesajı).
  function bothWroteAt(conv) {
    const writers = new Set();
    for (const m of conv.messages) {
      if (!m.senderId) continue;
      writers.add(m.senderId);
      if (writers.size === 2) return m.at;
    }
    return null;
  }

  function matchTiming(conv, nowMs, requiredQuestions) {
    const answered = conv.questions.filter((q) => q.answer).length;
    if (answered >= requiredQuestions) return { phase: 'done', expiresAt: null, expired: false };
    const started = bothWroteAt(conv);
    const deadline = started
      ? Date.parse(started) + QUESTION_WINDOW
      : Date.parse(conv.createdAt) + START_WINDOW;
    return {
      phase: started ? 'questions' : 'start',
      expiresAt: new Date(deadline).toISOString(),
      expired: nowMs >= deadline,
    };
  }

  const api = { START_WINDOW, QUESTION_WINDOW, HOUR, matchTiming };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MATCH_RULES = api;
})(this);
