(() => {
  // ——— DEFAULT TEMPLATES —————————————————————————————————————————————
  let backlinkTemplates = [
    'https://www.facebook.com/sharer/sharer.php?u=[ENCODE_URL]',
    'https://twitter.com/intent/tweet?url=[ENCODE_URL]&text=[ENCODE_TITLE]',
    'https://www.linkedin.com/shareArticle?mini=true&url=[ENCODE_URL]&title=[ENCODE_TITLE]',
    'https://www.reddit.com/submit?url=[ENCODE_URL]&title=[ENCODE_TITLE]',
    'http://pinterest.com/pin/create/button/?url=[ENCODE_URL]&media=&description=',
    'https://www.tumblr.com/widgets/share/tool?canonicalUrl=[ENCODE_URL]&title=[ENCODE_TITLE]&caption=[ENCODE_TITLE]',
    'https://vk.com/share.php?url=[ENCODE_URL]&title=[ENCODE_TITLE]',
    'http://service.weibo.com/share/share.php?url=[ENCODE_URL]&title=[ENCODE_TITLE]&pic=',
    'https://mix.com/add?url=[ENCODE_URL]'
  ];
  let youtubeBacklinkTemplates = [
    'https://video.ultra-zone.net/watch.en.html.gz?v=[ID]',
    'https://www.ytrepeat.com/watch/?v=[ID]',
    'https://sec.pn.to/jump.php?https://youtube.com/watch?v=[ID]'
  ];
  
  // Add near the top of your script, alongside backlinkTemplates:
  let corsProxiesTemplates = [
    'https://api.allorigins.win/raw?url=[ENCODE_URL]'
  ];
  
  
  let templatesLoaded = false;

  /*
  // ——— FETCH UP‑TO‑DATE TEMPLATES —————————————————————————————————————
  async function loadBacklinkTemplates() {
    try {
      const [res1, res2] = await Promise.all([
        fetch("https://backlinkexchange.github.io/backlink-templates/backlink-templates.json"),
        fetch("https://backlinkexchange.github.io/backlink-templates/youtube-backlink-templates.json")
      ]);
      if (!res1.ok || !res2.ok) throw new Error('Failed to fetch templates');
      const t1 = await res1.json();
      const t2 = await res2.json();
      if (Array.isArray(t1)) backlinkTemplates = t1;
      if (Array.isArray(t2)) youtubeBacklinkTemplates = t2;
      
      // —— NEW: fetch CORS proxy list ——
      const corsRes = await fetch(
        'https://backlinkexchange.github.io/backlink-templates/cors-proxies.json'
      );
      if (corsRes.ok) {
        const corsList = await corsRes.json();
        if (Array.isArray(corsList)) {
          corsProxiesTemplates = corsList;
        }
      }
    } catch (err) {
      console.error('Error loading templates, using defaults:', err);
    } finally {
      templatesLoaded = true;
    }
  }
  */
  
  async function loadBacklinkTemplates() {
  console.debug('⏳ Loading backlink templates...');

  try {
    // Parallel fetch for main templates
    const [res1, res2] = await Promise.all([
      fetch("https://backlinkexchange.github.io/backlink-templates/backlink-templates.json"),
      fetch("https://backlinkexchange.github.io/backlink-templates/youtube-backlink-templates.json")
    ]);

    if (res1.ok) {
      const data1 = await res1.json();
      if (Array.isArray(data1)) {
        backlinkTemplates = data1;
      } 
    } 

    if (res2.ok) {
      const data2 = await res2.json();
      if (Array.isArray(data2)) {
        youtubeBacklinkTemplates = data2;
      } 
    } 

    // Optional: load CORS proxies
    try {
      const corsRes = await fetch(
        'https://backlinkexchange.github.io/backlink-templates/cors-proxies.json'
      );
      if (corsRes.ok) {
        const corsList = await corsRes.json();
        if (Array.isArray(corsList)) {
          corsProxiesTemplates = corsList;
        } 
      } 
    } catch (corsErr) {
    }

  } catch (err) {
  } finally {
    templatesLoaded = true
  }
}
  
  document.addEventListener('DOMContentLoaded', async () => {
    await loadBacklinkTemplates();

    // ——— STATE & ELEMENTS —————————————————————————————————————
    let running = false;
    let total = 0, completed = 0, failed = 0;
    let urlQueue = [];
    let slots = [];
    let popupBlocked = false;
    let currentMap = null;

    const settings = { mode: 'iframe', concurrency: 5, rerun: false, shuffle: true };
    const el = id => document.getElementById(id);
    const urlInput         = el('urlInput');
    const startBtn         = el('startBtn');
    const toggleBtn        = el('toggleAdvancedBtn');
    const advPanel         = el('advancedPanel');
    const modeSelect       = el('modeSelect');
    const concurrencyRange = el('concurrencyRange');
    const concurrentCount  = el('concurrentCount');
    const rerunCheckbox    = el('rerunCheckbox');
    const shuffleCheckbox  = el('shuffleCheckbox');
    const newUrlInput      = el('newUrl');
    const copyBtn          = el('copyBtn');
    const progressBar      = el('progressBar');
    const progressText     = el('progressText');
    const resultsList      = el('results');
    const controls         = el('controls');

    // ——— UTILITIES —————————————————————————————————————————————————
    function saveSettings() {
      document.cookie = `mode=${settings.mode};path=/`;
      document.cookie = `concurrency=${settings.concurrency};path=/`;
      document.cookie = `rerun=${settings.rerun};path=/`;
      document.cookie = `shuffle=${settings.shuffle};path=/`;
    }

    function loadSettings() {
      document.cookie.split(';').forEach(c => {
        const [k, v] = c.trim().split('=');
        if (k === 'mode')        settings.mode        = v;
        if (k === 'concurrency') settings.concurrency = +v;
        if (k === 'rerun')       settings.rerun       = (v === 'true');
        if (k === 'shuffle')     settings.shuffle     = (v === 'true');
      });
    }

    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function normalizeUrl(raw) {
      let u = raw.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      try {
        const p = new URL(u);
        p.hostname = p.hostname.replace(/^www\./i, '');
        if (p.pathname === '/' || !p.pathname) p.pathname = '';
        return p.toString();
      } catch {
        return null;
      }
    }

    function extractYouTubeID(u) {
      try {
        const p = new URL(u);
        if (p.hostname.includes('youtube.com') && p.searchParams.get('v'))
          return p.searchParams.get('v');
        if (p.hostname === 'youtu.be') return p.pathname.slice(1);
      } catch {}
      return null;
    }

    function buildMap(u, vid) {
      const p = new URL(u);
      const parts = p.hostname.split('.'); const ln = parts.length;
      const domainname = parts.slice(-2, -1)[0]; const tld = parts.slice(-1)[0];
      const sub = parts.slice(0, ln - 2).join('.');
      const map = {
        PROTOCOL:   p.protocol,
        SUBDOMAIN:  sub ? sub + '.' : '',
        DOMAINNAME: domainname,
        TLD:        tld,
        HOST:       p.hostname,
        PORT:       p.port ? ':' + p.port : '',
        PATH:       p.pathname,
        QUERY:      p.search,
        PARAMS:     p.search ? p.search.slice(1) : '',
        FRAGMENT:   p.hash,
        URL:        u,
        DOMAIN:     p.hostname
      };
      if (vid) map.ID = vid;
      Object.keys(map).forEach(k => map['ENCODE_' + k] = encodeURIComponent(map[k]));
      return map;
    }

    function replacePlaceholders(tpl, map) {
      return tpl.replace(/\[([A-Z_]+)\]/g, (_, key) => map[key] || '');
    }

    function updateProgress() {
      const pct = Math.round(((completed + failed) / total) * 100);
      progressBar.style.width = pct + '%';
      progressText.textContent = pct + '%';
    }

    function showPopupWarning() {
      if (popupBlocked) return;
      popupBlocked = true;
      const msg = document.createElement('div');
      msg.id = 'popupWarning'; msg.style.color='red'; msg.style.margin='1em 0';
      msg.textContent = 'Pop-up blocked! Please allow pop-ups to use Popup/Tab mode.';
      controls.parentNode.insertBefore(msg, controls);
    }

    // ——— ON COMPLETE ——————————————————————————————————————————————
    function onComplete() {
      running = false;
      urlInput.disabled = false;
      startBtn.textContent = 'Generate Backlinks';
      // cleanup
      slots.forEach(s => {
        if (settings.mode === 'iframe') s.ref.remove();
        else if (s.ref && !s.ref.closed) s.ref.close();
      });
      if (settings.rerun) {
        startAll();
      }
    }

    // ——— SLOT POOL ——————————————————————————————————————————————————
    function initSlots(map, templates) {
      currentMap = map;
      urlQueue = templates.map((tpl, idx) => ({ tpl, idx }));
      slots = [];
      for (let i = 0; i < settings.concurrency; i++) {
        const slot = { id: i, busy: false, ref: null, timeoutId: null, current: null };
        if (settings.mode === 'iframe') {
          const iframe = document.createElement('iframe'); iframe.sandbox = 'allow-scripts allow-same-origin';  iframe.style.display = 'none'; document.body.appendChild(iframe);
          iframe.onload = () => handleIframeLoad(slot);
          slot.ref = iframe;
        }
        slots.push(slot);
      }
      slots.forEach(slot => launchSlot(slot));
    }
	
   
    function launchSlot(slot) {
  if (!running || slot.busy) return;

  // If queue empty, check for completion
  if (urlQueue.length === 0) {
    if (slots.every(s => !s.busy)) onComplete();
    return;
  }

  // Pull next URL
  const { tpl, idx } = slot.current = urlQueue.shift();
  const url = replacePlaceholders(tpl, currentMap);

  // Update UI to “loading”
  const status = resultsList.children[idx].querySelector('.status');
  status.innerHTML = '⏳';
  status.className = 'status loading';
  slot.busy = true;

  const timeoutMs = 8000;

  if (settings.mode === 'ping') {
    // ——— PING MODE —————————————————————————————————————
    let done = false;
    // global timeout
    slot.timeoutId = setTimeout(() => {
      if (!done) handlePingError(slot, idx);
    }, timeoutMs);

    (async () => {
      for (const proxyTpl of corsProxiesTemplates) {
        const proxyUrl = replacePlaceholders(proxyTpl, currentMap);
        try {
          const res = await fetch(proxyUrl);
          if (res.ok) {
            done = true;
            clearTimeout(slot.timeoutId);
            handlePingComplete(slot, idx);
            break;
          }
        } catch (e) {
          // try next proxy
        }
      }
      if (!done) {
        clearTimeout(slot.timeoutId);
        handlePingError(slot, idx);
      }
    })();

  } else if (settings.mode === 'iframe') {
    // **REUSE** the pre‑created iframe (slot.ref) from initSlots()
    const iframe = slot.ref;

    // Clear any previous handlers/timeouts
    iframe.onload = null;
    clearTimeout(slot.timeoutId);

    // Set up new load handler
    iframe.onload = () => {
      clearTimeout(slot.timeoutId);
      handleIframeLoad(slot);
    };

    // Start timeout
    slot.timeoutId = setTimeout(() => {
      iframe.onload = null;
      handleIframeError(slot);
    }, timeoutMs);

    // Kick off load
    iframe.src = url;

  } else {
    // Popup/Tab mode — reuse slot.ref if already open, otherwise open once
    const name  = `slotWin_${slot.id}`;
  
    const specs = settings.mode === 'popup'
      ? 'width=600,height=400,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes'
      : '';

    let win = slot.ref;
    if (!win || win.closed) {
      // open fresh if needed
      win = window.open('about:blank', name, specs);
      if (!win) {
        showPopupWarning();
        handlePopupError(slot);
        return;
      }
      slot.ref = win;
      // Optionally disable further popups from inside:
      try { win.onload = () => { win.open = () => null; }; } catch {}
    }

    // Clear any previous timeout/poll
    clearTimeout(slot.timeoutId);

    // Navigate it
    try { win.location.href = url; } catch {}

    // Listen for real load if same‑origin
    let loaded = false;
    try {
      win.addEventListener('load', () => {
        if (loaded) return;
        loaded = true;
        clearTimeout(slot.timeoutId);
        handlePopupComplete(slot);
      });
    } catch {}

    // Poll readyState every 200ms (same‑origin only)
    const pollId = setInterval(() => {
      try {
        if (win.document.readyState === 'complete') {
          clearInterval(pollId);
          if (!loaded) {
            loaded = true;
            clearTimeout(slot.timeoutId);
            handlePopupComplete(slot);
          }
        }
      } catch {
        clearInterval(pollId);
      }
    }, 200);

    // Fallback timeout
    slot.timeoutId = setTimeout(() => {
      clearInterval(pollId);
      if (!loaded) handlePopupError(slot);
    }, timeoutMs);
  }
}

// You’ll need two new handlers alongside your existing ones:

function handlePingComplete(slot, idx) {
  const status = resultsList.children[idx].querySelector('.status');
  status.innerHTML = '✓';
  status.className = 'status success';
  completed++;
  updateProgress();
  slot.busy = false;
  launchSlot(slot);
}

function handlePingError(slot, idx) {
  const status = resultsList.children[idx].querySelector('.status');
  status.innerHTML = '✗';
  status.className = 'status failure';
  failed++;
  updateProgress();
  slot.busy = false;
  launchSlot(slot);
}
    
    function handleIframeLoad(slot) {
      clearTimeout(slot.timeoutId); const idx=slot.current.idx;
      const status = resultsList.children[idx].querySelector('.status'); status.innerHTML='✓'; status.className='status success';
      completed++; updateProgress(); slot.busy=false; launchSlot(slot);
    }
    function handleIframeError(slot) {
      clearTimeout(slot.timeoutId); const idx=slot.current.idx;
      const status = resultsList.children[idx].querySelector('.status'); status.innerHTML='✗'; status.className='status failure';
      failed++; updateProgress(); slot.busy=false; launchSlot(slot);
    }
    function handlePopupComplete(slot) {
      clearTimeout(slot.timeoutId); const idx=slot.current.idx;
      const status = resultsList.children[idx].querySelector('.status'); status.innerHTML='✓'; status.className='status success';
      completed++; updateProgress(); slot.busy=false; launchSlot(slot);
    }
    function handlePopupError(slot) {
      clearTimeout(slot.timeoutId); const idx=slot.current.idx;
      const status = resultsList.children[idx].querySelector('.status'); status.innerHTML='✗'; status.className='status failure';
      failed++; updateProgress(); slot.busy=false; launchSlot(slot);
    }

    // ——— START & STOP —————————————————————————————————————————————————
    function startAll() {
      const normalized = normalizeUrl(urlInput.value);
      if (!normalized) { alert('Invalid URL'); return; }
      const vid = extractYouTubeID(normalized);
      let templates = vid ? youtubeBacklinkTemplates : backlinkTemplates;
      if (settings.shuffle) templates = shuffleArray(templates.slice());
      currentMap = buildMap(normalized, vid);

      running = true; total = templates.length; completed = failed = 0;
      resultsList.innerHTML = '';
      progressBar.style.width = '0%'; progressText.textContent = '0%';

      templates.forEach((tpl, idx) => {
        const u = replacePlaceholders(tpl, currentMap);
        const li = document.createElement('li');
        li.innerHTML = `<a href="${u}" target="_blank">${u}</a><span class=\"status\">…</span>`;
        resultsList.appendChild(li);
      });

      urlInput.disabled = true; startBtn.textContent='Stop';
      // share URL
      const shareStr = `${location.origin}${location.pathname}?${normalized}`;
      newUrlInput.value = shareStr; history.replaceState(null,'',`${location.pathname}?${normalized}`);

      settings.rerun = rerunCheckbox.checked;
      initSlots(currentMap, templates);
    }

    function stopAll() {
      running = false; urlInput.disabled=false; startBtn.textContent='Generate Backlinks';
      slots.forEach(s => { if (!s.ref) return; if (settings.mode==='iframe') s.ref.remove(); else if (!s.ref.closed) s.ref.close(); });
      slots=[]; urlQueue=[];
    }

    // ——— UI INITIALIZATION —————————————————————————————————————
    function init() {
      loadSettings(); advPanel.style.display='none';
      modeSelect.value=settings.mode; concurrencyRange.value=settings.concurrency;
      concurrentCount.textContent=settings.concurrency;
      rerunCheckbox.checked=settings.rerun; shuffleCheckbox.checked=settings.shuffle;
      toggleBtn.addEventListener('click',()=>{ const hid=advPanel.style.display==='none'; advPanel.style.display=hid?'block':'none'; toggleBtn.innerHTML=hid?'⚙️ Advanced ▲':'⚙️ Advanced ▼'; });
      modeSelect.addEventListener('change',()=>{settings.mode=modeSelect.value;saveSettings();});
      concurrencyRange.addEventListener('input',()=>{settings.concurrency=+concurrencyRange.value;concurrentCount.textContent=settings.concurrency;saveSettings();});
      rerunCheckbox.addEventListener('change',()=>{/* noop—read in startAll */});
      shuffleCheckbox.addEventListener('change',()=>{settings.shuffle=shuffleCheckbox.checked;saveSettings();});
      startBtn.addEventListener('click',()=>running?stopAll():startAll());
      newUrlInput.addEventListener('click',()=>newUrlInput.select());
      copyBtn.addEventListener('click',()=>{newUrlInput.select();document.execCommand('copy');});
      const q=window.location.search.slice(1); if(q){urlInput.value=q;startAll();}
    }

    init();
  });
})();
