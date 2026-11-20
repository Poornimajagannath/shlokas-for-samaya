(function () {
  const MISSING = "Not recorded yet. Record it once in Voice Memos and it plays here.";
  const EPOCH = Date.UTC(2026, 0, 1);
  const PERIOD = 14;

  const state = {
    pack: null,
    browseId: null,
    view: "home",
    line: 0,
    heard: Object.create(null),
    playing: false,
    playFrom: null,
  };

  const audioCache = Object.create(null);
  const audio = new Audio();
  audio.preload = "none";
  audio.playsInline = true;

  const views = document.getElementById("views");
  const whole = document.getElementById("whole");
  const all = document.getElementById("all");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function calendarUtc() {
    const raw = new URLSearchParams(location.search).get("on");
    const match = raw && /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const utc = Date.UTC(y, m - 1, d);
      const check = new Date(utc);
      if (check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d) return utc;
    }
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function schedule() {
    const shlokas = state.pack.shlokas;
    const dayIndex = Math.round((calendarUtc() - EPOCH) / 86400000);
    const shlokaIndex = mod(Math.floor(dayIndex / PERIOD), shlokas.length);
    const day = mod(dayIndex, PERIOD) + 1;
    return {
      index: shlokaIndex,
      day: day,
      week: day <= 7 ? 1 : 2,
      shloka: shlokas[shlokaIndex],
    };
  }

  function current() {
    const today = schedule();
    if (!state.browseId || state.browseId === today.shloka.id) return today.shloka;
    return state.pack.shlokas.find((item) => item.id === state.browseId) || today.shloka;
  }

  function isThisWeek(item) {
    return item.id === schedule().shloka.id;
  }

  function audioStatus(id) {
    if (!Object.prototype.hasOwnProperty.call(audioCache, id)) return "pending";
    return audioCache[id] ? "ready" : "missing";
  }

  async function findAudio(id) {
    if (Object.prototype.hasOwnProperty.call(audioCache, id)) return audioCache[id];
    for (const ext of ["m4a", "mp3"]) {
      const url = new URL(`audio/${id}.${ext}`, document.baseURI).href;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
          audioCache[id] = url;
          return url;
        }
      } catch (err) {
        audioCache[id] = null;
        return null;
      }
    }
    audioCache[id] = null;
    return null;
  }

  function iconPlay() {
    return `<svg class="icon-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg>`;
  }

  function iconPause() {
    return `<svg class="icon-pause" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="2.6" width="3.1" height="10.8" rx="0.8" fill="currentColor"/><rect x="9.7" y="2.6" width="3.1" height="10.8" rx="0.8" fill="currentColor"/></svg>`;
  }

  function badge(id) {
    const ready = audioStatus(id) === "ready";
    if (ready) {
      return `<span class="badge play" data-badge="${id}" aria-hidden="true"><svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.6 1.1v5.8L6.6 4 1.6 1.1z" fill="#FBF8F1"/></svg></span>`;
    }
    return `<span class="badge" data-badge="${id}" aria-hidden="true"><svg width="9" height="9" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.2" fill="none" stroke="#6A625B" stroke-width="1.4"/></svg></span>`;
  }

  function clockIcon() {
    return `<svg class="ic" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#6A625B" stroke-width="1.5"/><path d="M8 4.8v3.6l2.2 1.3" stroke="#6A625B" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
  }

  function art(item, extra) {
    return `<div class="art-mat ${extra || ""}"><div class="frame"><img src="${item.image}" width="1152" height="864" alt="${escapeHtml(item.alt)}"></div></div>`;
  }

  function daysHtml(day) {
    return Array.from({ length: PERIOD }, (_, index) => {
      const n = index + 1;
      const cls = n < day ? "d" : n === day ? "t" : "";
      return `<span class="day ${cls}"></span>`;
    }).join("");
  }

  function renderHome(item) {
    const today = schedule();
    const here = isThisWeek(item);
    const row = state.pack.shlokas.map((entry) => {
      const on = entry.id === item.id;
      return `<button class="mi${on ? " cur" : ""}" type="button" data-shloka="${entry.id}"${on ? ' aria-current="true"' : ""}>
        <span class="tm"><img src="${entry.image}" width="1152" height="864" alt=""></span>
        <span class="nm">${escapeHtml(entry.short)}</span>
        ${badge(entry.id)}
      </button>`;
    }).join("");
    const sub = here
      ? `For ${item.deity} · Week ${today.week} of 2`
      : `For ${item.deity}`;
    const fort = here
      ? `<section class="fort">
          <div class="fort-head"><b>Two weeks with this shloka</b><span>Day ${today.day} of ${PERIOD}</span></div>
          <div class="days" aria-hidden="true">${daysHtml(today.day)}</div>
        </section>`
      : `<button class="btn btn-sec back-week" type="button" data-today>Back to this week</button>`;
    return `<section class="view" data-view="home">
      <div class="kicker">
        <p class="eyebrow">${here ? "Shloka of the week" : "Another shloka"}</p>
        <button class="chip" type="button" data-sheet="all">All 3 shlokas</button>
      </div>
      <h1 class="title">${escapeHtml(item.title)}</h1>
      <p class="sub">${escapeHtml(sub)}</p>
      ${art(item)}
      <button class="btn btn-play is-dim" type="button" data-audio="voice" id="voiceBtn" disabled>
        <span class="disc" aria-hidden="true">${iconPlay()}${iconPause()}</span>
        <span data-voice-label>Play Amma's voice</span>
      </button>
      <p class="note" data-missing hidden>${clockIcon()}${MISSING}</p>
      <div class="row2">
        <button class="btn btn-sec" type="button" data-sheet="whole">See whole shloka</button>
        <button class="btn btn-sec" type="button" data-goto="practice">Practice</button>
      </div>
      ${fort}
      <div class="more">
        <p class="more-label">Coming up</p>
        <div class="more-row">${row}</div>
      </div>
    </section>`;
  }

  function renderPractice(item) {
    const total = item.lines.length;
    const index = Math.min(state.line, total - 1);
    state.line = index;
    const dots = item.lines.map((_, dot) => {
      const cls = dot < index ? "d" : dot === index ? "c" : "";
      return `<span class="${cls}"></span>`;
    }).join("");
    const heard = state.heard[`${item.id}:${index}`];
    return `<section class="view" data-view="practice">
      <div class="kicker">
        <button class="back" type="button" data-goto="home">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4L6 9l5 5" stroke="#6B4420" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${escapeHtml(item.short)}
        </button>
        <span class="eyebrow">Line ${index + 1} of ${total}</span>
      </div>
      <div class="pdots" aria-hidden="true">${dots}</div>
      ${art(item, "p-art")}
      <div class="p-card">
        <p class="lbl">Say this line together</p>
        <h1 class="line" data-practice-line>${escapeHtml(item.lines[index])}</h1>
      </div>
      <div class="steps2">
        <button class="st hear is-dim" type="button" data-audio="hear" id="hearBtn" disabled>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M4 8.5h3l4.5-4v13L7 13.5H4z" fill="currentColor"/><path d="M14.5 7.5a5 5 0 010 7M17 5a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          <span data-hear-label>Hear it</span>
          <span class="chk"${heard ? "" : " hidden"}>Heard</span>
        </button>
        <button class="st say" type="button" data-say>
          <span class="ring" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M3.5 5.5a2 2 0 012-2h9a2 2 0 012 2v6a2 2 0 01-2 2H9l-3.5 3v-3a2 2 0 01-2-2z" fill="#fff"/></svg></span>
          You say it
        </button>
      </div>
      <p class="note" data-missing hidden>${clockIcon()}${MISSING}</p>
      <p class="hint">Amma says it, then Samaya copies. Slowly is fine.</p>
      <div class="navrow">
        <button class="btn btn-sec" type="button" data-line="-1"${index === 0 ? " disabled" : ""}>Back a line</button>
        <button class="btn btn-next" type="button" data-line="1"${index >= total - 1 ? " disabled" : ""}>Next line</button>
      </div>
    </section>`;
  }

  function renderWhole(item) {
    document.getElementById("wholeBody").innerHTML = `<div class="lines">${item.lines.map((line, index) => {
      return `<p class="ln" data-shloka-line><span class="n">${index + 1}</span><span class="t">${escapeHtml(line)}</span></p>`;
    }).join("")}</div>`;
  }

  function renderAll(item) {
    const today = schedule();
    document.getElementById("allBody").innerHTML = state.pack.shlokas.map((entry) => {
      const on = entry.id === item.id;
      const week = entry.id === today.shloka.id ? `<span class="pick-now">This week</span>` : "";
      return `<button class="pick${on ? " is-current" : ""}" type="button" data-shloka="${entry.id}"${on ? ' aria-current="true"' : ""}>
        <span class="pick-art"><img src="${entry.image}" width="1152" height="864" alt=""></span>
        <span class="pick-copy">
          <span class="pick-title">${escapeHtml(entry.title)}</span>
          ${week}
        </span>
      </button>`;
    }).join("");
  }

  function sheetOpen() {
    if (!whole.hidden) return whole;
    if (!all.hidden) return all;
    return null;
  }

  function closeSheets() {
    const which = !whole.hidden ? "whole" : !all.hidden ? "all" : null;
    whole.hidden = true;
    all.hidden = true;
    views.inert = false;
    if (which) {
      const back = views.querySelector(`[data-sheet="${which}"]`);
      if (back) back.focus();
    }
    syncHash();
  }

  function openSheet(name) {
    const item = current();
    if (name === "whole") renderWhole(item);
    if (name === "all") renderAll(item);
    whole.hidden = name !== "whole";
    all.hidden = name !== "all";
    views.inert = true;
    const root = name === "whole" ? whole : all;
    const sheet = root.querySelector(".picker-sheet");
    if (sheet) sheet.scrollTop = 0;
    const close = root.querySelector(".close");
    if (close) close.focus();
    syncAudio();
    syncHash();
  }

  function render() {
    const item = current();
    const open = sheetOpen();
    views.innerHTML = state.view === "practice" ? renderPractice(item) : renderHome(item);
    views.scrollTop = 0;
    renderWhole(item);
    renderAll(item);
    if (open) views.inert = true;
    syncAudio();
    syncHash();
  }

  function syncHash() {
    const hash = !whole.hidden ? "whole" : state.view === "practice" ? "practice" : "home";
    const next = `${location.pathname}${location.search}#${hash}`;
    const now = `${location.pathname}${location.search}${location.hash}`;
    if (now !== next) history.replaceState(null, "", next);
  }

  function syncAudio() {
    const item = current();
    const status = audioStatus(item.id);
    const dim = status !== "ready";
    const playing = state.playing;
    document.querySelectorAll("[data-audio='voice']").forEach((btn) => {
      btn.disabled = dim;
      btn.classList.toggle("is-dim", dim);
      btn.classList.toggle("is-playing", playing);
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      const label = btn.querySelector("[data-voice-label]");
      if (label) label.textContent = playing ? "Pause Amma's voice" : "Play Amma's voice";
    });
    const hear = document.getElementById("hearBtn");
    if (hear) {
      const fromHear = playing && state.playFrom === "hear";
      hear.disabled = dim;
      hear.classList.toggle("is-dim", dim);
      hear.classList.toggle("is-playing", fromHear);
      hear.setAttribute("aria-pressed", fromHear ? "true" : "false");
      const label = hear.querySelector("[data-hear-label]");
      if (label) label.textContent = fromHear ? "Pause" : "Hear it";
      const chk = hear.querySelector(".chk");
      if (chk) chk.hidden = !state.heard[`${item.id}:${state.line}`];
    }
    document.querySelectorAll("[data-missing]").forEach((note) => {
      note.hidden = status !== "missing";
    });
    document.querySelectorAll("[data-badge]").forEach((el) => {
      const ready = audioStatus(el.getAttribute("data-badge")) === "ready";
      el.classList.toggle("play", ready);
      el.innerHTML = ready
        ? `<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.6 1.1v5.8L6.6 4 1.6 1.1z" fill="#FBF8F1"/></svg>`
        : `<svg width="9" height="9" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.2" fill="none" stroke="#6A625B" stroke-width="1.4"/></svg>`;
    });
  }

  function stopAudio() {
    audio.pause();
    state.playing = false;
    state.playFrom = null;
  }

  async function toggleAudio(from) {
    const item = current();
    const url = await findAudio(item.id);
    syncAudio();
    if (!url) return;
    if (state.playing && state.playFrom === from) {
      stopAudio();
      syncAudio();
      return;
    }
    stopAudio();
    if (audio.src !== url) audio.src = url;
    else {
      try { audio.currentTime = 0; } catch (err) { /* not seekable yet */ }
    }
    state.playFrom = from;
    try {
      await audio.play();
    } catch (err) {
      stopAudio();
      syncAudio();
      return;
    }
    state.playing = true;
    syncAudio();
  }

  audio.addEventListener("ended", () => {
    const from = state.playFrom;
    const item = current();
    if (from === "hear") state.heard[`${item.id}:${state.line}`] = true;
    stopAudio();
    syncAudio();
  });

  function choose(id) {
    if (!state.pack.shlokas.some((item) => item.id === id)) return;
    stopAudio();
    const today = schedule();
    state.browseId = id === today.shloka.id ? null : id;
    state.line = 0;
    state.view = "home";
    closeSheets();
    render();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;
    if (target.dataset.sheet) openSheet(target.dataset.sheet);
    else if (target.hasAttribute("data-close") || target.classList.contains("picker-backdrop")) closeSheets();
    else if (target.dataset.goto) {
      stopAudio();
      state.view = target.dataset.goto === "practice" ? "practice" : "home";
      closeSheets();
      render();
    } else if (target.dataset.shloka) choose(target.dataset.shloka);
    else if (target.hasAttribute("data-today")) {
      stopAudio();
      state.browseId = null;
      state.line = 0;
      state.view = "home";
      render();
    } else if (target.dataset.line) {
      const next = state.line + Number(target.dataset.line);
      const count = current().lines.length;
      if (next < 0 || next >= count) return;
      stopAudio();
      state.line = next;
      render();
    } else if (target.hasAttribute("data-say")) {
      const on = target.getAttribute("aria-pressed") === "true";
      target.setAttribute("aria-pressed", on ? "false" : "true");
    } else if (target.dataset.audio) toggleAudio(target.dataset.audio);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sheetOpen()) closeSheets();
  });

  whole.addEventListener("click", (event) => {
    if (event.target === whole || event.target.classList.contains("picker-backdrop")) closeSheets();
  });
  all.addEventListener("click", (event) => {
    if (event.target === all || event.target.classList.contains("picker-backdrop")) closeSheets();
  });

  async function boot() {
    let pack;
    try {
      const res = await fetch(new URL("data/shlokas.json", document.baseURI));
      if (!res.ok) throw new Error("missing");
      pack = await res.json();
      if (!pack || !Array.isArray(pack.shlokas) || pack.shlokas.length !== 3) throw new Error("shape");
      pack.shlokas.forEach((item) => {
        if (!item || !Array.isArray(item.lines) || item.lines.some((line) => typeof line !== "string")) {
          throw new Error("lines");
        }
      });
    } catch (err) {
      views.innerHTML = `<p class="note">The shlokas did not load. Refresh the page.</p>`;
      return;
    }
    state.pack = pack;
    const opening = location.hash.replace(/^#/, "");
    if (opening === "practice") state.view = "practice";
    render();
    if (opening === "whole") openSheet("whole");
    Promise.all(pack.shlokas.map((item) => findAudio(item.id))).then(() => {
      if (!state.playing) syncAudio();
    });
  }

  boot();
})();
