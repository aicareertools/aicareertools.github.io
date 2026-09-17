#!/usr/bin/env node
/**
 * Content generation pipeline
 * Reads pending keywords, generates articles via Groq, commits to guides/
 * Run via GitHub Actions nightly, or manually: node pipeline/generate.js
 *
 * Required env vars:
 *   GROQ_API_KEY - your Groq API key (set as GitHub Actions secret)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const KEYWORDS_FILE = path.join(__dirname, 'keywords.json');
const GUIDES_DIR = path.join(ROOT, 'src/content/guides');
const BATCH_SIZE = 10; // articles per run (stay within Groq free tier)

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY environment variable');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are an expert career coach writing comprehensive, SEO-optimized career guides. Write in a clear, direct, actionable style. Use real examples. Avoid fluff and filler. Structure content with clear H2 headings. Aim for 800-1200 words.`;

function buildPrompt(keyword) {
  return `Write a comprehensive career guide about: "${keyword}"

The article must:
1. Start with a compelling introductory paragraph (no heading before it)
2. Use H2 headings (## Heading) for each major section (4-6 sections)
3. Include specific, actionable advice with examples
4. Reference relevant tools where natural (link as [Tool Name](/tools/slug))
5. End with a practical takeaway or next step

Internal tool links to use when relevant:
- Cover letters: [Cover Letter Generator](/tools/cover-letter-generator)
- Resume review: [Resume Analyzer](/tools/resume-analyzer)
- Interview prep: [Interview Questions Generator](/tools/interview-questions-generator)
- Decoding job listings: [Job Description Analyzer](/tools/job-description-analyzer)
- Compensation: [Salary Estimator](/tools/salary-estimator)

Write ONLY the article body (no frontmatter). Start directly with the first paragraph.`;
}

function buildFrontmatter(keyword, slug) {
  const title = keyword
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const today = new Date().toISOString().split('T')[0];

  // Derive tags from keyword
  const tags = [];
  if (/cover.?letter/i.test(keyword)) tags.push('cover-letter');
  if (/interview/i.test(keyword)) tags.push('interview');
  if (/resume/i.test(keyword)) tags.push('resume');
  if (/salary|negotiat/i.test(keyword)) tags.push('salary');
  if (/job.?search|find.*job/i.test(keyword)) tags.push('job-search');
  if (/career.?change|switch.*career/i.test(keyword)) tags.push('career');
  if (tags.length === 0) tags.push('career');

  return `---
title: "${title}"
description: "A comprehensive guide to ${keyword.toLowerCase()} — practical advice, examples, and strategies that actually work."
pubDate: ${today}
tags: ${JSON.stringify(tags)}
relatedTools: []
---

`;
}

// Groq periodically retires model IDs, so pick a live one instead of hardcoding.
async function pickGroqModel() {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Groq models list error: ${res.status}`);
  const { data } = await res.json();
  const exclude = /whisper|tts|guard|moderation|embed|vision|compound/i;
  const scored = data
    .filter(m => !exclude.test(m.id))
    .map(m => {
      let score = 0;
      if (/70b/i.test(m.id)) score += 30;
      else if (/32b|maverick/i.test(m.id)) score += 25;
      else if (/17b|20b/i.test(m.id)) score += 20;
      else if (/9b|8b/i.test(m.id)) score += 10;
      if (/versatile|instruct/i.test(m.id)) score += 5;
      return { id: m.id, score };
    })
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) throw new Error('No usable Groq chat models found');
  return scored[0].id;
}

async function generateArticle(keyword, model) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(keyword) },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function main() {
  const keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
  const pending = keywords.filter(k => k.status === 'pending').slice(0, BATCH_SIZE);

  if (pending.length === 0) {
    console.log('No pending keywords. All done!');
    return;
  }

  const model = await pickGroqModel();
  console.log(`Using model: ${model}`);
  console.log(`Generating ${pending.length} articles...`);
  let generated = 0;
  let failed = 0;

  for (const item of pending) {
    const outputPath = path.join(GUIDES_DIR, `${item.slug}.md`);

    // Skip if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭  Skipping ${item.slug} (file exists)`);
      item.status = 'done';
      continue;
    }

    try {
      console.log(`  ⚙  Generating: ${item.keyword}`);
      const content = await generateArticle(item.keyword, model);

      if (!content || content.length < 200) {
        throw new Error('Generated content too short');
      }

      const fullContent = buildFrontmatter(item.keyword, item.slug) + content;
      fs.writeFileSync(outputPath, fullContent, 'utf8');

      item.status = 'done';
      generated++;
      console.log(`  ✓  Done: ${item.slug}`);

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ✗  Failed: ${item.keyword} — ${err.message}`);
      item.status = 'error';
      failed++;
    }
  }

  // Write updated keywords file
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2), 'utf8');

  console.log(`\nDone: ${generated} generated, ${failed} failed`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
