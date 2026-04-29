// =====================================================
// TimeClock 365 — LinkedIn approval and scheduling
// =====================================================
// Run: node server.js
// =====================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const config = require('./config');

const APPROVALS_FILE = path.join(__dirname, 'approvals.json');
const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const USED_IMAGES_FILE = path.join(__dirname, 'used-images.json');

// =====================================================
// Storage helpers (JSON files)
// =====================================================

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadApprovals() {
  return readJSON(APPROVALS_FILE, {
    posts: [], landings: [], competitors: [], seo: [], weekly: [], monthly: []
  });
}
function saveApprovals(d) { writeJSON(APPROVALS_FILE, d); }

function loadSubscribers() { return readJSON(SUBSCRIBERS_FILE, []); }
function saveSubscribers(d) { writeJSON(SUBSCRIBERS_FILE, d); }

// =====================================================
// Banner picker (no reuse)
// =====================================================

function loadUsedImages() { return readJSON(USED_IMAGES_FILE, []); }
function saveUsedImages(used) { writeJSON(USED_IMAGES_FILE, used); }

function listBanners() {
  if (!config.BANNERS_DIR) return [];
  if (!fs.existsSync(config.BANNERS_DIR)) return [];
  try {
    return fs.readdirSync(config.BANNERS_DIR)
      .filter(f => /\.(png|jpe?g)$/i.test(f))
      .sort();
  } catch (e) { return []; }
}

function pickUnusedBanner() {
  const all = listBanners();
  const used = new Set(loadUsedImages());
  const available = all.filter(f => !used.has(f));
  if (available.length === 0) return null;
  // deterministic: first alphabetically — so dry-run preview matches live
  const name = available[0];
  return { name, path: path.join(config.BANNERS_DIR, name) };
}

function markBannerUsed(name) {
  const used = loadUsedImages();
  if (!used.includes(name)) {
    used.push(name);
    saveUsedImages(used);
  }
}

// =====================================================
// LinkedIn API (3 steps for image post)
// =====================================================

function liRegisterUpload(token, ownerUrn) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: ownerUrn,
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent'
        }]
      }
    });
    const req = https.request({
      method: 'POST',
      hostname: 'api.linkedin.com',
      path: '/v2/assets?action=registerUpload',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const j = JSON.parse(data);
            const uploadUrl = j?.value?.uploadMechanism
              ?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
            const asset = j?.value?.asset;
            if (!uploadUrl || !asset) return reject(new Error('registerUpload: missing uploadUrl/asset'));
            resolve({ uploadUrl, asset });
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`registerUpload HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function liUploadBinary(uploadUrl, filePath, token) {
  return new Promise((resolve, reject) => {
    const buf = fs.readFileSync(filePath);
    const u = new URL(uploadUrl);
    const req = https.request({
      method: 'PUT',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Length': buf.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`uploadBinary HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(buf); req.end();
  });
}

function liCreatePost(text, ownerUrn, assetUrn, token) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      author: ownerUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'IMAGE',
          media: [{
            status: 'READY',
            description: { text: '' },
            media: assetUrn,
            title: { text: '' },
          }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    });
    const req = https.request({
      method: 'POST',
      hostname: 'api.linkedin.com',
      path: '/v2/ugcPosts',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, urn: res.headers['x-restli-id'] || data, status: res.statusCode });
        } else {
          resolve({ ok: false, status: res.statusCode, response: data });
        }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.write(body); req.end();
  });
}

async function publishToLinkedIn(text) {
  if (!config.LINKEDIN_PUBLISH_ENABLED) {
    console.log('[linkedin disabled] publish off (LINKEDIN_PUBLISH_ENABLED!=true)');
    return { ok: false, reason: 'disabled' };
  }

  const image = pickUnusedBanner();
  if (!image) {
    console.error(`[linkedin] no unused banner in ${config.BANNERS_DIR}`);
    return { ok: false, reason: 'no-image' };
  }

  if (config.LINKEDIN_DRY_RUN) {
    const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;
    console.log(`[linkedin dry-run] would publish with image "${image.name}":`);
    console.log('  ' + preview.replace(/\n/g, '\n  '));
    return { ok: true, dryRun: true, image: image.name };
  }

  if (!config.LINKEDIN_ACCESS_TOKEN || !config.LINKEDIN_AUTHOR_URN) {
    console.error('[linkedin] missing LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN');
    return { ok: false, reason: 'no-credentials' };
  }

  try {
    console.log(`[linkedin] uploading banner "${image.name}"…`);
    const reg = await liRegisterUpload(config.LINKEDIN_ACCESS_TOKEN, config.LINKEDIN_AUTHOR_URN);
    await liUploadBinary(reg.uploadUrl, image.path, config.LINKEDIN_ACCESS_TOKEN);
    const post = await liCreatePost(text, config.LINKEDIN_AUTHOR_URN, reg.asset, config.LINKEDIN_ACCESS_TOKEN);
    if (post.ok) {
      markBannerUsed(image.name);
      console.log(`✓ LinkedIn published: ${post.urn} (image: ${image.name})`);
      return { ...post, image: image.name };
    } else {
      console.error(`✗ LinkedIn create post failed: HTTP ${post.status} ${post.response || ''}`);
      return post;
    }
  } catch (err) {
    console.error(`✗ LinkedIn publish error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// =====================================================
// Scheduling: pick next free 11:25 / 18:36 slot
// =====================================================

function computeNextFreeSlot(approvals) {
  const slots = config.PUBLISH_SLOTS; // ['11:25', '18:36']
  const reserved = new Set(
    (approvals.posts || [])
      .filter(p => p.scheduledFor && !p.publishedAt)
      .map(p => p.scheduledFor)
  );
  const now = Date.now();
  const today = new Date();
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    for (const slot of slots) {
      const [h, m] = slot.split(':').map(Number);
      const date = new Date(
        today.getFullYear(), today.getMonth(), today.getDate() + dayOffset,
        h, m, 0, 0
      );
      if (date.getTime() <= now) continue;
      const iso = date.toISOString();
      if (reserved.has(iso)) continue;
      return iso;
    }
  }
  return null;
}

// =====================================================
// Scheduler: publish due posts
// Runs every minute and on startup. Publishes each post whose
// scheduledFor <= now, status ∈ {approved, edited}, not yet published.
// =====================================================

async function publishDuePosts() {
  const approvals = loadApprovals();
  const posts = approvals.posts || [];
  const now = Date.now();
  let changed = false;

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    if (p.publishedAt || p.dryRunPublishedAt) continue;
    if (p.status !== 'approved' && p.status !== 'edited') continue;
    if (!p.scheduledFor) continue;
    if (new Date(p.scheduledFor).getTime() > now) continue;

    const text = p.editedContent || p.content || '';
    const result = await publishToLinkedIn(text);

    if (result.ok && result.dryRun) {
      p.dryRunPublishedAt = new Date().toISOString();
      p.imagePreview = result.image;
      changed = true;
      console.log(`✓ posts[${i}] dry-run completed (${result.image})`);
    } else if (result.ok) {
      p.publishedAt = new Date().toISOString();
      p.linkedinPostUrn = result.urn;
      p.imageUsed = result.image;
      changed = true;
      console.log(`✓ posts[${i}] published as scheduled`);
    } else {
      p.publishError = result.reason || result.error || `HTTP ${result.status || '?'}`;
      changed = true;
    }
  }
  if (changed) saveApprovals(approvals);
}

// =====================================================
// Notification on new approval (no email — just console log)
// =====================================================

const TYPE_LABELS = {
  posts:       'LinkedIn post',
  landings:    'Landing page',
  competitors: 'Competitor analysis',
  seo:         'SEO ideas',
  weekly:      'Weekly report',
  monthly:     'Monthly report',
};

function notifyNewApproval(type, item) {
  const label = TYPE_LABELS[type] || type;
  const title = item.title || item.id || label;
  console.log(`+ New on approval queue: ${label} — ${title}`);
}

// =====================================================
// HTTP server
// =====================================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ---------- POST /subscribe — capture lead from a landing page ----------
  if (req.method === 'POST' && req.url === '/subscribe') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, email, source } = JSON.parse(body);
        if (!email || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'name and email are required' }));
          return;
        }
        const subs = loadSubscribers();
        if (subs.find(s => s.email === email)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: 'Already exists' }));
          return;
        }
        subs.push({
          name, email,
          source: source || 'landing',
          subscribedAt: new Date().toISOString(),
          status: 'new',
          notes: '',
        });
        saveSubscribers(subs);
        console.log(`+ New lead: ${name} (${email})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Saved' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });

  // ---------- GET /approvals-page — approval UI ----------
  } else if (req.method === 'GET' && req.url === '/approvals-page') {
    const html = fs.readFileSync(path.join(__dirname, 'approvals.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

  // ---------- GET /approvals — JSON of approvals queue ----------
  } else if (req.method === 'GET' && req.url === '/approvals') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadApprovals(), null, 2));

  // ---------- POST /approve — set status, schedule LinkedIn publish ----------
  } else if (req.method === 'POST' && req.url === '/approve') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { type, index, status, editedContent, approvedAt } = JSON.parse(body);
        const approvals = loadApprovals();

        if (approvals[type] && approvals[type][index] !== undefined) {
          const item = approvals[type][index];
          if (status !== undefined) item.status = status;
          if (editedContent !== undefined) item.editedContent = editedContent;
          if (approvedAt !== undefined) item.approvedAt = approvedAt;

          // Schedule a LinkedIn post when it gets approved/edited and no slot yet.
          if (type === 'posts'
              && (status === 'approved' || status === 'edited')
              && !item.scheduledFor
              && !item.publishedAt) {
            const slot = computeNextFreeSlot(approvals);
            if (slot) {
              item.scheduledFor = slot;
              console.log(`✓ posts[${index}] scheduled for ${slot}`);
            }
          }

          // If user undoes the approval, clear schedule.
          if (type === 'posts' && (status === 'pending' || status === 'rejected')) {
            if (item.scheduledFor) {
              delete item.scheduledFor;
              console.log(`✗ posts[${index}] schedule cleared (status=${status})`);
            }
          }

          saveApprovals(approvals);
          console.log(`✓ ${type}[${index}] → ${status}`);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });

  // ---------- POST /add-approval — agent adds a new item ----------
  } else if (req.method === 'POST' && req.url === '/add-approval') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { type, item } = JSON.parse(body);
        const approvals = loadApprovals();
        approvals[type] = approvals[type] || [];
        const exists = approvals[type].find(i => i.id === item.id);
        if (!exists) {
          approvals[type].push({ ...item, status: 'pending' });
          saveApprovals(approvals);
          notifyNewApproval(type, item);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, added: !exists }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });

  // ---------- GET /subscribers — leads list ----------
  } else if (req.method === 'GET' && req.url === '/subscribers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadSubscribers(), null, 2));

  // ---------- GET / or /dashboard — CRM dashboard ----------
  } else if (req.method === 'GET' && (req.url === '/' || req.url === '/dashboard')) {
    const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

  // ---------- POST /update-lead — change lead status / notes ----------
  } else if (req.method === 'POST' && req.url === '/update-lead') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { email, status, notes } = JSON.parse(body);
        const subs = loadSubscribers();
        const lead = subs.find(s => s.email === email);
        if (lead) {
          if (status !== undefined) lead.status = status;
          if (notes !== undefined) lead.notes = notes;
          saveSubscribers(subs);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });

  // ---------- GET /banners-status — counts of total/used/available banners ----------
  } else if (req.method === 'GET' && req.url === '/banners-status') {
    const all = listBanners();
    const used = loadUsedImages();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dir: config.BANNERS_DIR,
      total: all.length,
      used: used.length,
      available: all.length - used.filter(u => all.includes(u)).length,
    }));

  // ---------- GET /banners/<filename> — serve a banner image ----------
  } else if (req.method === 'GET' && req.url.startsWith('/banners/')) {
    const filename = decodeURIComponent(req.url.slice('/banners/'.length));
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.writeHead(400); res.end('bad'); return;
    }
    const filepath = path.join(config.BANNERS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filename).toLowerCase();
    const ct = ext === '.png' ? 'image/png'
      : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(fs.readFileSync(filepath));

  // ---------- 404 ----------
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// =====================================================
// Startup
// =====================================================

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('========================================');
    console.error(`  ✗ Port ${config.PORT} is already in use.`);
    console.error('  Close the program holding it or run with another port:');
    console.error('    PowerShell:  $env:PORT="3001"; npm start');
    console.error('    cmd:         set PORT=3001 && npm start');
    console.error('========================================');
  } else {
    console.error('✗ Server error:', err.message);
  }
  process.exit(1);
});

server.listen(config.PORT, () => {
  let liMode;
  if (!config.LINKEDIN_PUBLISH_ENABLED) liMode = 'OFF';
  else if (config.LINKEDIN_DRY_RUN) liMode = 'DRY-RUN (nothing is sent)';
  else if (!config.LINKEDIN_ACCESS_TOKEN || !config.LINKEDIN_AUTHOR_URN) liMode = 'no token';
  else liMode = 'LIVE — will really publish';

  const banners = listBanners();
  const usedCount = loadUsedImages().length;

  console.log('');
  console.log('========================================');
  console.log('  TimeClock 365 — LinkedIn agent');
  console.log('========================================');
  console.log(`  Server:    http://localhost:${config.PORT}`);
  console.log(`  LinkedIn:  ${liMode}`);
  console.log(`  Slots:     ${config.PUBLISH_SLOTS.join(', ')}`);
  console.log(`  Banners:   ${banners.length} total, ${usedCount} used, ${Math.max(0, banners.length - usedCount)} available`);
  console.log(`  Folder:    ${config.BANNERS_DIR}`);
  console.log('========================================');
  console.log('');
});

// scheduler tick (every minute) + immediate catch-up at startup
const ONE_MINUTE = 60 * 1000;
setInterval(publishDuePosts, ONE_MINUTE);
publishDuePosts();
