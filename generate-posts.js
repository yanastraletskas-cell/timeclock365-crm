// =====================================================
// TimeClock 365 — Monthly LinkedIn post generator
// Generates 60 posts via Claude API, pushes to approvals queue.
// Run directly:  node generate-posts.js
// Or triggered automatically by server.js on the 30th.
// =====================================================

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const APPROVALS_FILE = path.join(__dirname, 'approvals.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 60 distinct topic angles spread across 3 batches of 20
const TOPIC_GROUPS = [
  // batch 1 — product features & how-it-works
  [
    'How inaccurate timesheets cause payroll errors that hurt everyone',
    'Clock-in clock-out simplicity: what modern time tracking should feel like',
    'Real-time attendance dashboards: what managers actually need',
    'Overtime alerts that prevent surprise payroll spikes at month-end',
    'GPS-verified clock-ins for mobile and field teams',
    'The hidden cost of buddy-punching and how to eliminate it',
    'Automated break tracking and labor law compliance',
    'One-click payroll sync: how time tracking connects to QuickBooks and ADP',
    'Leave management (PTO, sick days, approvals) in one place',
    'Role-based access: managers see their teams, admins see everything',
    'Audit trail: every punch logged, every edit recorded with a timestamp',
    'Biometric vs software-based time clocks: pros and cons',
    'Mobile app for hourly employees who never sit at a desk',
    'Shift scheduling and how it integrates with attendance tracking',
    'Department-level reports for smarter workforce planning',
    'Project-based time tracking for accurate client billing',
    'Cloud time tracking vs on-premise hardware: the comparison',
    'How employee self-service portals reduce HR tickets',
    'Setting up a new employee for time tracking in under 5 minutes',
    'Automatic notifications: late arrivals, missed punches, unusual overtime',
  ],
  // batch 2 — business value, ROI, compliance
  [
    'The real cost of one payroll error (and why it keeps happening)',
    'ROI of automating attendance management for 50+ employee companies',
    'FLSA, state overtime laws, and how time tracking software keeps you safe',
    'How a 20-person company saved 10 admin hours every single week',
    'Reducing payroll processing time from hours to under 30 minutes',
    'Workforce analytics: turning raw attendance data into business decisions',
    'Scaling from 10 to 100 employees without adding HR headcount',
    'How restaurants use time tracking to manage tipped employees and compliance',
    'Construction and job-site time tracking: solving the hardest problems',
    'Healthcare scheduling and attendance: zero margin for error',
    'Retail shift management during peak and holiday seasons',
    'Payroll accuracy benchmarks: what best-in-class looks like',
    'When spreadsheets break: five signs you have outgrown manual tracking',
    'Reducing employee turnover with fair, transparent scheduling',
    'Proof-of-work for remote employees without micromanagement',
    'Seasonal staffing: how to scale up and down without chaos',
    'Why labor costs are the #1 controllable expense in most businesses',
    'How automated overtime calculation prevents legal exposure',
    'Preparing your business for a payroll audit',
    'Time tracking as an employee benefit: giving workers visibility into their own data',
  ],
  // batch 3 — thought leadership, future of work, HR insights
  [
    'The future of work: how hybrid teams are redefining attendance',
    'Five HR metrics every small business owner should track weekly',
    'What Gen Z employees expect from workplace technology in 2025',
    'The psychology of fair scheduling and its effect on employee engagement',
    'Digital transformation in HR: where time tracking fits in the stack',
    'Four-day work week: how time-tracking data can support the decision',
    'AI and attendance management: separating hype from practical value',
    'Employee monitoring vs time tracking: where is the ethical line',
    'The link between accurate timekeeping and employee trust',
    'Work-life balance starts with accurate time data on both sides',
    'How to calculate your true labor cost per productive hour',
    'The gig economy and time tracking for contract and part-time workers',
    'HR tech stack essentials for fast-growing small businesses',
    'Building a culture of accountability without micromanagement',
    'From paper punch cards to cloud: the evolution of time tracking',
    'State-by-state overtime law changes every employer should watch',
    'Why the best operations managers obsess over labor efficiency',
    'Data-driven scheduling: using past attendance to predict future needs',
    'Integrating time tracking into your onboarding process from day one',
    'The one dashboard that replaces five spreadsheets for HR teams',
  ],
];

async function generateBatch(client, topics, batchNum) {
  const topicList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    system: `You are a LinkedIn content writer for TimeClock 365, a cloud-based employee time tracking and attendance management SaaS for small and mid-size businesses. Write professional, value-driven LinkedIn posts that help business owners and HR managers. The tone is helpful, conversational, and occasionally uses a short real-world scenario or statistic. Never sound like a direct ad. Naturally mention TimeClock 365 in most posts. Use 2–3 emojis per post, placed where they add emphasis. End every post with 4–6 relevant hashtags on the final line.`,
    messages: [{
      role: 'user',
      content: `Write exactly ${topics.length} LinkedIn posts. Each post covers one of the following topics in the order listed:

${topicList}

Rules:
- Each post is 180–250 words
- Return ONLY a JSON array, no markdown, no extra text
- Format: [{"topic": "short label", "content": "full post text with emojis and hashtags"}]`,
    }],
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Batch ${batchNum}: could not parse JSON from response`);
  return JSON.parse(match[0]);
}

async function generatePosts() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is not set');

  const client = new Anthropic({ apiKey });
  const approvals = readJSON(APPROVALS_FILE, {
    posts: [], landings: [], competitors: [], seo: [], weekly: [], monthly: [],
  });

  const date = new Date().toISOString().slice(0, 10);
  let totalAdded = 0;

  for (let b = 0; b < TOPIC_GROUPS.length; b++) {
    const topics = TOPIC_GROUPS[b];
    console.log(`[generator] batch ${b + 1}/3 — generating ${topics.length} posts…`);

    let posts;
    try {
      posts = await generateBatch(client, topics, b + 1);
    } catch (err) {
      console.error(`[generator] batch ${b + 1} failed: ${err.message}`);
      throw err;
    }

    for (let j = 0; j < posts.length; j++) {
      const id = `post-${date}-b${b}-${j}`;
      if (!approvals.posts.find(p => p.id === id)) {
        approvals.posts.push({
          id,
          content: posts[j].content || '',
          topic: posts[j].topic || topics[j],
          date,
          status: 'pending',
          generatedAt: new Date().toISOString(),
        });
        totalAdded++;
      }
    }

    writeJSON(APPROVALS_FILE, approvals);
    console.log(`[generator] batch ${b + 1} saved (${posts.length} posts)`);

    if (b < TOPIC_GROUPS.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`[generator] ✓ ${totalAdded} posts added to approval queue`);
  return totalAdded;
}

module.exports = { generatePosts };

if (require.main === module) {
  generatePosts()
    .then(n => { console.log(`Done. ${n} posts added.`); process.exit(0); })
    .catch(err => { console.error('✗', err.message); process.exit(1); });
}
