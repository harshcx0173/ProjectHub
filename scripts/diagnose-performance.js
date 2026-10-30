const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// Read .env.local
const envPath = path.resolve(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchRest(endpoint) {
  const t0 = performance.now();
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  });
  const t1 = performance.now();
  const data = await res.json().catch(() => null);
  return { time: t1 - t0, status: res.status, count: Array.isArray(data) ? data.length : 0 };
}

async function main() {
  console.log('=== STAGE B: PERFORMANCE & REGIONAL DIAGNOSTICS ===');
  console.log(`Supabase URL: ${supabaseUrl}`);

  // 1. Resolve host and ping timing
  const urlObj = new URL(supabaseUrl);
  const hostname = urlObj.hostname;

  try {
    const addresses = await dns.lookup(hostname);
    console.log(`Resolved IP: ${addresses.address} (family: IPv${addresses.family})`);
  } catch (err) {
    console.error(`DNS lookup failed: ${err.message}`);
  }

  // 2. HTTP Ping / Latency check
  const httpLatencies = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    try {
      await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: supabaseKey },
      });
      const t1 = performance.now();
      httpLatencies.push(t1 - t0);
    } catch (e) {
      console.error('Fetch failed', e.message);
    }
  }

  const avgHttpLatency = httpLatencies.reduce((a, b) => a + b, 0) / httpLatencies.length;
  console.log(`Round-trip HTTP Latencies (ms): ${httpLatencies.map(l => l.toFixed(1)).join(', ')}`);
  console.log(`Average Network Latency to Supabase: ${avgHttpLatency.toFixed(1)} ms`);

  // 3. Database Query Timings
  console.log('\n--- Database Query Timings (PostgREST API) ---');

  const q1 = await fetchRest('roles?select=id,name');
  console.log(`Q1: Fetch Roles (${q1.count} rows): ${q1.time.toFixed(1)} ms`);

  const q2 = await fetchRest('projects?select=id,name,key,is_archived&is_archived=eq.false&limit=10');
  console.log(`Q2: Fetch Projects (${q2.count} rows): ${q2.time.toFixed(1)} ms`);

  const q3 = await fetchRest('tasks?select=id,title,status_id,position&is_deleted=eq.false&limit=25');
  console.log(`Q3: Fetch Board Tasks (${q3.count} rows): ${q3.time.toFixed(1)} ms`);

  const q4 = await fetchRest('messages?select=id,content,created_at&order=created_at.desc&limit=30');
  console.log(`Q4: Fetch Messages (${q4.count} rows): ${q4.time.toFixed(1)} ms`);

  console.log('\n--- Regional Assessment ---');
  console.log(`User Location: India (approx. IST +05:30)`);
  console.log(`Hosting / Node process: Localhost:4321`);
  if (avgHttpLatency > 150) {
    console.log(`Supabase Hosting Region: US-East (Virginia / us-east-1) or Central EU (~${avgHttpLatency.toFixed(0)} ms round trip).`);
    console.log(`Recommendation: Aligning regions to India/South Asia (ap-south-1 Mumbai) would cut latency from ~${avgHttpLatency.toFixed(0)}ms to ~20-30ms.`);
  } else {
    console.log(`Supabase Hosting Region: Regionally fast (~${avgHttpLatency.toFixed(0)} ms).`);
  }
}

main().catch(console.error);
