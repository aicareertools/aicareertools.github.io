import { SYSTEM_PROMPT, TOOL_PROMPTS } from './prompts.js';

// Rate limiting: 5 requests per IP per hour using Cloudflare KV
// Bind a KV namespace named RATE_LIMIT_KV in your Cloudflare dashboard
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 3600;

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV) return true; // KV not bound yet, allow all
  const key = `rl:${ip}`;
  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= RATE_LIMIT) return false;
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: RATE_WINDOW_SECONDS });
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }), env);
    }

    if (request.method !== 'POST') {
      return corsResponse(new Response('Method not allowed', { status: 405 }), env);
    }

    const tool = url.searchParams.get('tool');
    if (!tool || !TOOL_PROMPTS[tool]) {
      return corsResponse(new Response('Unknown tool', { status: 400 }), env);
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(env, ip);
    if (!allowed) {
      return corsResponse(new Response('Rate limit exceeded. Try again in an hour.', { status: 429 }), env);
    }

    let inputs;
    try {
      inputs = await request.json();
    } catch {
      return corsResponse(new Response('Invalid JSON body', { status: 400 }), env);
    }

    const userPrompt = TOOL_PROMPTS[tool](inputs);

    // Call Groq API with streaming
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('Groq error:', errText);
      return corsResponse(new Response('AI service error. Please try again.', { status: 502 }), env);
    }

    // Transform Groq SSE stream → raw text stream for the browser
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      try {
        const reader = groqResponse.body.getReader();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const chunk = JSON.parse(data);
              const text = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) await writer.write(encoder.encode(text));
            } catch {}
          }
        }
      } finally {
        await writer.close();
      }
    })();

    return corsResponse(new Response(readable, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    }), env);
  },
};

function corsResponse(response, env) {
  // Set ALLOWED_ORIGIN in Cloudflare env vars to your GitHub Pages domain
  // e.g. https://yourusername.github.io
  const origin = env.ALLOWED_ORIGIN || '*';
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}
