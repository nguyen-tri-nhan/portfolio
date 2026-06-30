#!/usr/bin/env node
// One-time script: extracts DETAIL entries from the HTML review file
// and generates individual MD files + a topics.ts index.
//
// Run: node scripts/extract-review-content.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'webapp/public/review/index.html');
const outDir  = path.join(root, 'webapp/src/review-content');

mkdirSync(outDir, { recursive: true });

const html = readFileSync(htmlPath, 'utf-8');

// ── 1. Extract TOPICS ──────────────────────────────────────────────────────────
// TOPICS is defined as "const TOPICS=[...  \n];" — find the closing "\n];"
const topicsStart = html.indexOf('const TOPICS=[');
// Find "\n];" after the start — this is the outer array close
const topicsEnd   = html.indexOf('\n];', topicsStart) + 3; // past the \n];
const topicsJs    = html.slice(topicsStart + 'const TOPICS='.length, topicsEnd - 1).trimEnd().replace(/;$/, '');
const TOPICS      = vm.runInNewContext('(' + topicsJs + ')', {});

// ── 2. Extract DETAIL entries ──────────────────────────────────────────────────
const detailStart = html.indexOf('const DETAIL={};');
const detailEnd   = html.indexOf('// ── NAV ──', detailStart);
// Strip "const DETAIL={};" so it doesn't shadow the sandbox variable
const detailJs = html
  .slice(detailStart, detailEnd)
  .replace(/^const DETAIL=\{\};\n?/, '');

const DETAIL = {};
vm.runInNewContext(detailJs, { DETAIL });

console.log(`Extracted ${Object.keys(DETAIL).length} DETAIL entries`);

// ── 3. Helpers ─────────────────────────────────────────────────────────────────
function slug(key) {
  return key
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[()\/\\]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function detectLang(code) {
  const t = (code || '').trimStart();
  if (!t) return '';
  // SQL
  if (/^(--\s|CREATE |SELECT |INSERT |UPDATE |DELETE |ALTER |EXPLAIN |SHOW |SET GLOBAL)/i.test(t)) return 'sql';
  // XML / HTML
  if (/^<[?!a-zA-Z]/.test(t)) return 'xml';
  // Dockerfile
  if (/^(FROM |RUN |ENV |CMD |EXPOSE |COPY |ADD |WORKDIR )/.test(t)) return 'dockerfile';
  // YAML (Spring config etc.)
  if (/^(spring:|server:|management:|mybatis:|resilience4j:|logging:|#\s*(application|config|yml|yaml))/i.test(t)
    || /^[a-z][a-z_-]+:\s*$/.test(t.split('\n')[0])) return 'yaml';
  // Bash / shell
  if (/^(#!\/|#\s|jstack|jmap|jcmd|jstat|java |kubectl |docker |mvn |gradle |systemctl|journalctl|sudo |apt |yum |ss |lsof |curl |tail |grep |awk |find |ps |top |kill |printf |cat |echo |git |ls |cd |mkdir )/.test(t)
    || t.startsWith('$ ') || t.startsWith('./')) return 'bash';
  // Java (default for remaining)
  return 'java';
}

// ── 4. MD generation ───────────────────────────────────────────────────────────
function generateMd(key, d) {
  const lines = [];
  const safeTitle = (d.title || key).replace(/"/g, '\\"');
  const safeCrumb = (d.crumb || '').replace(/"/g, '\\"');
  const safeKey   = key.replace(/"/g, '\\"');

  lines.push('---');
  lines.push(`key: "${safeKey}"`);
  lines.push(`title: "${safeTitle}"`);
  lines.push(`crumb: "${safeCrumb}"`);
  lines.push('---');
  lines.push('');

  if (d.summary) {
    lines.push(d.summary);
    lines.push('');
  }

  if (d.points?.length) {
    lines.push('## Điểm Chính');
    lines.push('');
    for (const p of d.points) lines.push(`- ${p}`);
    lines.push('');
  }

  if (d.code) {
    lines.push('## Ví Dụ Code');
    lines.push('');
    if (d.codeLabel) lines.push(`*${d.codeLabel}*`);
    lines.push('');
    const lang = detectLang(d.code);
    lines.push('```' + lang);
    lines.push(d.code.trim());
    lines.push('```');
    lines.push('');
  }

  if (d.adapt) {
    lines.push('## Ứng Dụng Thực Tế');
    lines.push('');
    lines.push(d.adapt);
    lines.push('');
  }

  if (d.interview?.length) {
    lines.push('## Câu Hỏi Phỏng Vấn');
    lines.push('');
    for (const q of d.interview) lines.push(`1. ${q}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── 5. Write MD files ──────────────────────────────────────────────────────────
const fileMap = {};   // key → slug (without .md)

for (const [key, d] of Object.entries(DETAIL)) {
  const s = slug(key);
  fileMap[key] = s;
  const md = generateMd(key, d);
  writeFileSync(path.join(outDir, s + '.md'), md, 'utf-8');
}

console.log(`Written ${Object.keys(fileMap).length} MD files to ${outDir}`);

// ── 6. Build topics.ts ────────────────────────────────────────────────────────
const categoriesJson = TOPICS.map(cat => ({
  title: cat.title,
  icon:  cat.icon,
  topics: cat.topics.map(tp => ({
    name: tp.name,
    file: fileMap[tp.name] || '',
    subs: (tp.subs || []).map(s => ({
      name: s,
      file: fileMap[s] || '',
    })),
  })),
}));

const topicsTs = `// Auto-generated by scripts/extract-review-content.mjs
// Re-run the script to regenerate. Do not edit manually.

export interface ReviewSub {
  name: string;
  file: string;
}

export interface ReviewTopic {
  name: string;
  file: string;
  subs: ReviewSub[];
}

export interface ReviewCategory {
  title: string;
  icon: string;
  topics: ReviewTopic[];
}

export const REVIEW_TOPICS: ReviewCategory[] = ${JSON.stringify(categoriesJson, null, 2)};
`;

writeFileSync(path.join(outDir, 'topics.ts'), topicsTs, 'utf-8');
console.log('Written topics.ts');

// ── 7. Summary ─────────────────────────────────────────────────────────────────
const missing = [];
for (const cat of categoriesJson) {
  for (const tp of cat.topics) {
    if (tp.file === '') missing.push(tp.name);
    for (const sub of tp.subs) {
      if (sub.file === '') missing.push(sub.name);
    }
  }
}
if (missing.length) {
  console.warn('\nTopics with no matching DETAIL entry (will show empty):');
  missing.forEach(n => console.warn('  ' + n));
} else {
  console.log('\nAll topics have matching DETAIL entries ✓');
}
