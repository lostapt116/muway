/* ════════════════════════════════════════════════════════════
   花琪平板互動 ─ 導覽邏輯
   ════════════════════════════════════════════════════════════

   畫面索引對照：
     0  screen-lock   解鎖頁
     1  screen-s1     限動1（進度條跑完自動淡入想法泡泡）
     2  screen-t1     （保留，不使用）
     3  screen-s2     限動2（進度條跑完自動淡入想法泡泡）
     4  screen-t2     （保留，不使用）
     5  screen-s3     限動3（進度條跑完自動淡入想法泡泡）
     6  screen-t3     （保留，不使用）
     7  screen-msgs   訊息通知+情境選擇（同一畫面，時序淡入）
     8  screen-choice （空 placeholder，保留索引）
     9  screen-ra     結局A
    10  screen-rb     結局B
    11  screen-final  最終畫面
*/

const SCREENS = [
  'screen-lock',
  'screen-s1', 'screen-t1',
  'screen-s2', 'screen-t2',
  'screen-s3', 'screen-t3',
  'screen-msgs',
  'screen-choice',
  'screen-ra', 'screen-rb',
  'screen-final'
];

let current = 0;
let lastChoice = null;
let thoughtTimer = null; // 記錄自動淡入的 timer，換頁時清掉

/* ── 縮放邏輯：讓 834×1194 場景自動適應視窗大小 ── */
function scaleScene() {
  const scene   = document.getElementById('scene');
  const wrapper = document.getElementById('scene-wrapper');
  const scale   = Math.min(window.innerWidth / 834, window.innerHeight / 1194);
  scene.style.transform  = `scale(${scale})`;
  wrapper.style.width    = `${834  * scale}px`;
  wrapper.style.height   = `${1194 * scale}px`;
}
window.addEventListener('resize', scaleScene);
scaleScene();

/* ── 進入限動頁時，3秒後自動淡入想法泡泡 ── */

/* ── 限動時間動畫（配合進度條 3 秒）── */
const storyTimeConfig = {
  1: { startH: 23, startM: 47, endH: 23, endM: 50 },
  3: { startH:  0, startM: 15, endH:  0, endM: 18 },
  5: { startH:  0, startM: 35, endH:  0, endM: 38 },
};
const storyTimeIds = { 1: 'story-time-1', 3: 'story-time-2', 5: 'story-time-3' };
let storyTimeRaf = null;

function startStoryTime(idx) {
  if (storyTimeRaf) cancelAnimationFrame(storyTimeRaf);
  const cfg = storyTimeConfig[idx];
  const elId = storyTimeIds[idx];
  if (!cfg || !elId) return;
  const el = document.getElementById(elId);
  if (!el) return;

  const startTotal = cfg.startH * 60 + cfg.startM;
  const endTotal   = cfg.endH   * 60 + cfg.endM;
  const duration   = 3000; // ms，配合進度條
  const startTs    = performance.now();

  function fmt(total) {
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    const prefix = (h >= 1 && h <= 4) ? '凌晨 ' : '晚上 ';
    return prefix + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }

  el.textContent = fmt(startTotal);

  function tick(now) {
    const p = Math.min((now - startTs) / duration, 1);
    const cur = Math.round(startTotal + (endTotal - startTotal) * p);
    el.textContent = fmt(cur);
    if (p < 1) storyTimeRaf = requestAnimationFrame(tick);
  }
  storyTimeRaf = requestAnimationFrame(tick);
}

function scheduleThought(screenId) {
  clearTimeout(thoughtTimer);
  thoughtTimer = setTimeout(() => {
    const el = document.getElementById(screenId);
    if (!el) return;
    el.classList.add('thought-visible');

    // 打字機效果：取得想法 <p> 的文字，逐字打出
    const p = el.querySelector('.thought-box p');
    if (!p) return;
    const fullText = p.dataset.full || p.textContent.trim();
    if (!p.dataset.full) p.dataset.full = fullText;
    p.textContent = '';
    let i = 0;
    function typeNext() {
      if (i < fullText.length) {
        p.textContent += fullText[i];
        i++;
        // 游移感：基礎 80ms，加上隨機 0~60ms 的猶豫
        const delay = 80 + Math.random() * 60;
        thoughtTimer = setTimeout(typeNext, delay);
      } else {
        // 打字完成 → 1 秒後顯示右側繼續按鈕＋提示文字
        thoughtTimer = setTimeout(() => {
          const tapRight = el.querySelector('.tap-right');
          if (tapRight) tapRight.classList.add('tap-right-ready');
          const tapHint = el.querySelector('.tap-hint');
          if (tapHint) tapHint.classList.add('tap-hint-ready');
        }, 1000);
      }
    }
    // 等泡泡淡入完（0.6s）再開始打字
    thoughtTimer = setTimeout(typeNext, 650);
  }, 3000);
}

/* ── 進入訊息通知頁時，依序淡入各元素 ── */
let msgsTimers = [];
function clearMsgsTimers() {
  msgsTimers.forEach(t => clearTimeout(t));
  msgsTimers = [];
}
function resetMsgCards() {
  ['msg-card-1','msg-card-2','story3-notif'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible', 'pushed-down', 'notif-show', 'notif-hide');
  });
  const cs = document.getElementById('choice-section');
  if (cs) cs.classList.remove('visible');
}
/* 用 Web Audio API 合成 iOS 風格通知音（短促的兩音節） */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [1046, 1318]; // C6 → E6，清脆上揚感
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.18);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
  } catch (e) { /* 靜默失敗 */ }
}


/* ── 限動3 使用時間通知 ── */
function triggerStory3Notif() {
  const notif = document.getElementById('story3-notif');
  if (!notif) return;
  // 重置
  notif.classList.remove('notif-show', 'notif-hide');
  void notif.offsetWidth;
  // 滑入
  notif.classList.add('visible', 'notif-show');
  playNotificationSound();
  // 3 秒後滑出
  setTimeout(() => {
    notif.classList.add('notif-hide');
    setTimeout(() => {
      notif.classList.remove('visible', 'notif-show', 'notif-hide');
    }, 500);
  }, 3000);
}
function startMsgsSequence() {
  clearMsgsTimers();
  resetMsgCards();

  // 訊息1：立即淡入 + 音效
  msgsTimers.push(setTimeout(() => {
    const m1 = document.getElementById('msg-card-1');
    if (m1) m1.classList.add('visible');
    playNotificationSound();
  }, 100));

  // 訊息2：2 秒後 + 音效；同時把訊息1 往下推
  msgsTimers.push(setTimeout(() => {
    const m1 = document.getElementById('msg-card-1');
    const m2 = document.getElementById('msg-card-2');
    if (m1) m1.classList.add('pushed-down');
    if (m2) m2.classList.add('visible');
    playNotificationSound();
  }, 2100));

  // 情境選擇：再 3 秒後（共 5 秒後）
  msgsTimers.push(setTimeout(() => {
    const cs = document.getElementById('choice-section');
    if (cs) cs.classList.add('visible');
  }, 5100));
}

/* ── 結局頁時序 timer ── */
let resultTimers = [];
function clearResultTimers() {
  resultTimers.forEach(t => clearTimeout(t));
  resultTimers = [];
}

/* 進入結局頁（A=9, B=10）：立即顯示故事，2 秒後淡入內心 + 繼續按鈕 */
function startResultSequence(screenIdx) {
  clearResultTimers();
  const delayedId = screenIdx === 9 ? 'result-a-delayed' : 'result-b-delayed';
  // 先重置
  const el = document.getElementById(delayedId);
  if (el) el.classList.remove('visible');
  // 2 秒後淡入
  resultTimers.push(setTimeout(() => {
    if (el) el.classList.add('visible');
  }, 2000));
}

/* ── 最終頁 timer ── */
let finalTimers = [];   // setTimeout ids
let finalRafs = [];     // requestAnimationFrame ids
function clearFinalTimers() {
  finalTimers.forEach(t => clearTimeout(t));
  finalRafs.forEach(r => cancelAnimationFrame(r));
  finalTimers = [];
  finalRafs = [];
}

/* 進入最終頁（11）：數字動畫到47，2 秒後淡入內心 + 按鈕 */
function startFinalSequence() {
  clearFinalTimers();
  // 重置
  const counter = document.getElementById('final-counter');
  const delayed = document.getElementById('final-delayed');
  if (counter) counter.textContent = '0';
  if (delayed) delayed.classList.remove('visible');

  // 數字滾動動畫：1.5 秒內從 0 → 47
  const target = 48;
  const duration = 1500;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = Math.round(eased * target);
    if (counter) counter.textContent = val;
    if (progress < 1) {
      finalRafs.push(requestAnimationFrame(tick));
    }
  }
  finalRafs.push(requestAnimationFrame(tick));

  // 2 秒後淡入內心 + 按鈕
  finalTimers.push(setTimeout(() => {
    if (delayed) delayed.classList.add('visible');
  }, 2000));
}

/* ── 回上一頁（結局→訊息頁） ── */
function goBack() {
  goTo(7);
}

/* ── 切換到指定畫面（左右滑動過場） ── */
function goTo(idx) {
  clearTimeout(thoughtTimer); // 取消上一頁還沒觸發的 timer
  clearMsgsTimers();
  clearResultTimers();
  clearFinalTimers();
  // 立刻清掉所有延遲淡入容器的狀態，避免第二次進入時殘留
  ['final-delayed','result-a-delayed','result-b-delayed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
  document.querySelectorAll('#msg-card-1,#msg-card-2,#choice-section').forEach(el => {
    el.classList.remove('visible');
  });

  const dir = idx > current ? 1 : -1;
  const outgoing = document.getElementById(SCREENS[current]);
  const incoming = document.getElementById(SCREENS[idx]);

  // 清掉想法泡泡狀態
  outgoing.classList.remove('thought-visible');
  // 重置打字機文字，讓下次進入時重新打
  const thoughtP = outgoing.querySelector('.thought-box p');
  if (thoughtP && thoughtP.dataset.full) {
    thoughtP.textContent = thoughtP.dataset.full;
  }
  // 隱藏右側繼續按鈕＋提示文字（等下次打字完成才顯示）
  const outTapRight = outgoing.querySelector('.tap-right');
  if (outTapRight) outTapRight.classList.remove('tap-right-ready');
  const outTapHint = outgoing.querySelector('.tap-hint');
  if (outTapHint) outTapHint.classList.remove('tap-hint-ready');

  incoming.style.transition = 'none';
  incoming.style.transform = `translateX(${dir * 100}%)`;
  incoming.style.display = 'block';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      outgoing.style.transition = 'transform 0.3s ease';
      incoming.style.transition = 'transform 0.3s ease';
      outgoing.style.transform = `translateX(${-dir * 100}%)`;
      incoming.style.transform = 'translateX(0)';

      setTimeout(() => {
        outgoing.classList.remove('active');
        incoming.classList.add('active');
        // 清掉所有 inline style，讓 CSS class 完全接管
        outgoing.style.display = '';
        outgoing.style.transform = '';
        outgoing.style.transition = '';
        incoming.style.display = '';
        incoming.style.transform = '';
        incoming.style.transition = '';
        current = idx;

        /* 重置並重播進度條動畫 */
        incoming.querySelectorAll('.pb-seg.active .pb-fill').forEach(fill => {
          fill.style.animation = 'none';
          fill.offsetWidth;
          fill.style.animation = '';
        });

        /* 如果是限動頁，啟動 3 秒後淡入想法泡泡 */
        const storyScreens = { 1: 'screen-s1', 3: 'screen-s2', 5: 'screen-s3' };
        if (storyScreens[idx]) {
          scheduleThought(storyScreens[idx]);
          startStoryTime(idx);
        }
        if (idx === 5) triggerStory3Notif();
        /* 如果是訊息頁，啟動時序淡入 */
        if (idx === 7) {
          startMsgsSequence();
        }
        /* 如果是結局頁，啟動時序 */
        if (idx === 9 || idx === 10) {
          startResultSequence(idx);
        }
        /* 如果是最終頁，啟動數字動畫 */
        if (idx === 11) {
          startFinalSequence();
        }
        /* 螢幕使用時間頁：顯示 60 分鐘 */
        if (idx === 6) {
          const stCounter = document.getElementById('st-counter');
          if (stCounter) stCounter.textContent = '60';
        }
      }, 300);
    });
  });
}

/* ── 切換畫面（直接，不帶過場） ── */
function showScreen(idx) {
  clearTimeout(thoughtTimer);
  clearMsgsTimers();
  clearResultTimers();
  clearFinalTimers();
  ['final-delayed','result-a-delayed','result-b-delayed'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
  document.querySelectorAll('#msg-card-1,#msg-card-2,#choice-section').forEach(el => {
    el.classList.remove('visible');
  });
  SCREENS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', i === idx);
    el.classList.remove('thought-visible');
    // 重置打字機文字
    const tp = el.querySelector('.thought-box p');
    if (tp && tp.dataset.full) tp.textContent = tp.dataset.full;
    // 隱藏右側繼續按鈕＋提示文字
    const tr = el.querySelector('.tap-right');
    if (tr) tr.classList.remove('tap-right-ready');
    const th = el.querySelector('.tap-hint');
    if (th) th.classList.remove('tap-hint-ready');

    if (i === idx) {
      el.querySelectorAll('.pb-seg.active .pb-fill').forEach(fill => {
        fill.style.animation = 'none';
        fill.offsetWidth;
        fill.style.animation = '';
      });
    }
  });
  current = idx;
  const storyMap = { 1: 'screen-s1', 3: 'screen-s2', 5: 'screen-s3' };
  if (storyMap[idx]) { scheduleThought(storyMap[idx]); startStoryTime(idx); }
  if (idx === 5) triggerStory3Notif();
  if (idx === 7) startMsgsSequence();
  if (idx === 9 || idx === 10) startResultSequence(idx);
  if (idx === 6) {
    // 螢幕使用時間頁：啟動分鐘數倒數
    const stCounter = document.getElementById('st-counter');
    if (stCounter) stCounter.textContent = '60';
  }
  if (idx === 11) startFinalSequence();
}

/* ── 限動右側點擊：直接換到下一個限動（跳過想法頁 +2） ── */
function goNextStory() {
  const storyScreens = { 1: true, 3: true };
  if (storyScreens[current]) {
    goTo(current + 2);  // 限動1/2：跳過空白頁直接到下一個限動
  } else if (current === 5) {
    goTo(6);            // 限動3結束：進入螢幕使用時間頁
  } else {
    goTo(current + 1);
  }
}

/* ── 限動左側點擊：上一幕 ── */
function goPrev() {
  if (current <= 0) return;
  if (current === 1) {
    // 回解鎖頁：解鎖頁從上方滑下來
    clearTimeout(thoughtTimer);
    const lockScreen = document.getElementById('screen-lock');
    const s1 = document.getElementById('screen-s1');
    if (lockScreen && s1) {
      // 先讓解鎖頁在上方就位（不可見）
      lockScreen.classList.add('active');
      lockScreen.style.transition = 'none';
      lockScreen.style.transform = 'translateY(-100%)';
      // 強制 reflow
      lockScreen.getBoundingClientRect();
      // 兩個畫面同時動
      lockScreen.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      lockScreen.style.transform = '';
      s1.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      s1.style.transform = 'translateY(100%)';
      setTimeout(() => {
        s1.classList.remove('active');
        s1.style.transform = '';
        s1.style.transition = '';
        lockScreen.style.transition = '';
        current = 0;
      }, 420);
    }
    return;
  }
  // 跳過空的 placeholder 頁（2, 4, 6, 8）
  const SKIP = new Set([2, 4, 6, 8]);
  let target = current - 1;
  while (SKIP.has(target) && target > 0) target--;
  goTo(target);
}

/* ── 選擇按鈕 ── */
function chooseA() {
  lastChoice = 'a';
  goTo(9);
}
function chooseB() {
  lastChoice = 'b';
  goTo(10);
}

/* ── 重新開始 ── */
function restart() {
  lastChoice = null;
  // 清掉解鎖頁的殘留狀態
  const lockScreen = document.getElementById('screen-lock');
  if (lockScreen) {
    lockScreen.classList.remove('unlock-out', 'dragging');
    lockScreen.style.transform = '';
    lockScreen.style.transition = '';
  }
  showScreen(0);
}


/* 解鎖頁點擊 → 上滑過場到畫面1 */
function unlockSlideUp() {
  const lockScreen = document.getElementById('screen-lock');
  if (!lockScreen) return;
  lockScreen.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
  lockScreen.style.transform = 'translateY(-100%)';
  setTimeout(() => {
    lockScreen.style.transition = '';
    lockScreen.style.transform = '';
    showScreen(1);
  }, 450);
}
