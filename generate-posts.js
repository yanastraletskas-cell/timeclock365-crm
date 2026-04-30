// =====================================================
// TimeClock 365 — AI marketing post generator
// =====================================================
// Generates LinkedIn posts via Claude API and submits
// them to the approval queue for human review.
//
// Usage:
//   node generate-posts.js              (generates 3 posts)
//   POST_COUNT=5 node generate-posts.js (generates 5 posts)
//
// Requires:
//   ANTHROPIC_API_KEY env var
//   CRM server running on localhost (npm start in another terminal)
// =====================================================

'use strict';

const https = require('https');
const http = require('http');
const config = require('./config');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CRM_PORT = process.env.PORT || config.PORT || 3000;
const POST_COUNT = Math.max(1, Math.min(20, parseInt(process.env.POST_COUNT || '3', 10)));

const TOPICS = [
  'time tracking for remote teams',
  'reducing payroll errors with accurate time tracking',
  'employee scheduling tips for managers',
  'labor law compliance and time records',
  'productivity insights from time data',
  'onboarding new employees faster',
  'overtime management and cost savings',
  'GPS tracking for field service teams',
  'integrating time tracking with payroll software',
  'shift management best practices',
  'work-life balance and flexible scheduling',
  'tracking billable hours for client projects',
  'reducing buddy punching and time theft',
  'managing a distributed workforce across time zones',
  'automating attendance reports for HR',
];

// System prompt is cached to save tokens on repeated runs
const SYSTEM_PROMPT = `You are a professional B2B copywriter for TimeClock365, a cloud-based 
time tracking and employee scheduling SaaS used by small and medium businesses.

TimeClock365 key features:
- Web, iOS and Android clock-in/out (with GPS)
- Drag-and-drop employee scheduling
- Overtime alerts and labor cost reporting
- Payroll integrations (QuickBooks, Gusto, ADP)
- PTO and leave management
- DCAA and FLSA compliance tools

Target audience: business owners, operations managers, HR professionals (10-500 employees).

Voice: professional, practical, data-aware. Avoid hype. One or two emojis max per post.`;

function callClaude(topic) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Write a LinkedIn post about: ${topic}\n\nRequirements:\n- 150-250 words\n- Mention TimeClock365 naturally (not forced)\n- Include 3-5 relevant hashtags at the end on their own line\n- End with a subtle call to action\n- Output only the post text, nothing else`,
        },
      ],
    });

    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const j = JSON.parse(data);
              const text = j.content && j.content[0] && j.content[0].text;
              if (!text) return reject(new Error('Claude returned no text'));
              const cacheInfo = j.usage
                ? ` (cache_read=${j.usage.cache_read_input_tokens || 0}, cache_write=${j.usage.cache_creation_input_tokens || 0})`
                : '';
              resolve({ text: text.trim(), cacheInfo });
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Claude API HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function submitToApprovalQueue(content, topic) {
  return new Promise((resolve, reject) => {
    const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const body = JSON.stringify({
      type: 'posts',
      item: {
        id,
        title: topic,
        content,
        generatedAt: new Date().toISOString(),
        source: 'ai-agent',
      },
    });

    const req = http.request(
      {
        method: 'POST',
        hostname: 'localhost',
        port: CRM_PORT,
        path: '/add-approval',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Bad response from CRM: ${data}`));
          }
        });
      }
    );
    req.on('error', (err) => {
      reject(new Error(`Cannot reach CRM server on port ${CRM_PORT}: ${err.message}. Is the server running? (npm start)`));
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('[generate-posts] ERROR: ANTHROPIC_API_KEY is not set.');
    console.error('  Set it in your environment before running:');
    console.error('    Windows cmd:   set ANTHROPIC_API_KEY=sk-ant-...');
    console.error('    PowerShell:    $env:ANTHROPIC_API_KEY="sk-ant-..."');
    process.exit(1);
  }

  // Pick topics without repeating
  const shuffled = TOPICS.slice().sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, POST_COUNT);

  console.log('');
  console.log('============================================');
  console.log('  TimeClock 365 — AI post generator');
  console.log('============================================');
  console.log(`  Generating ${POST_COUNT} post(s) via Claude API...`);
  console.log(`  Submitting to CRM on port ${CRM_PORT}`);
  console.log('============================================');
  console.log('');

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const topic of selected) {
    process.stdout.write(`  → "${topic}"... `);
    try {
      const { text, cacheInfo } = await callClaude(topic);
      const result = await submitToApprovalQueue(text, topic);
      if (result.added) {
        console.log(`✓ added${cacheInfo}`);
        added++;
      } else {
        console.log('~ already in queue (skipped)');
        skipped++;
      }
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`  Result: ${added} added, ${skipped} skipped, ${failed} failed`);
  if (added > 0) {
    console.log(`  Review and approve at: http://localhost:${CRM_PORT}/approvals-page`);
  }
  console.log('');
}

main();
