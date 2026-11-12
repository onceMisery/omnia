#!/usr/bin/env node
// Structural checks only: no product execution, network access, or source-truth claims.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const slash = (path) => path.replaceAll('\\', '/');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n?/g, '\n');
const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? walk(slash(join(dir, entry.name)))
    : entry.name.endsWith('.md') ? [slash(join(dir, entry.name))] : []);
const paths = ['README.md', ...walk('docs')];
const docs = new Map(paths.map((path) => [path, read(path)]));
const scopePath = 'docs/Omnia-复刻范围与对应矩阵.md';
const contractPath = 'docs/Omnia-M0M1-协议契约.md';

function prose(source) {
  let fence = null;
  return source.split('\n').map((line) => {
    const mark = line.match(/^ {0,3}(\x60{3,}|~{3,})/);
    if (mark && !fence) {
      fence = mark[1];
      return '';
    }
    if (fence) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length
        && line.slice(mark[0].length).trim() === '') fence = null;
      return '';
    }
    return line;
  }).join('\n');
}

function fail(path, source, offset, message) {
  const line = source.slice(0, offset).split('\n').length;
  errors.push(path + ':' + line + ' ' + message);
}

let linkCount = 0;
for (const [path, source] of docs) {
  const text = prose(source);
  // Standard inline Markdown links, including angle-wrapped local paths.
  const links = text.replace(/(\x60+)[^\n]*?\1/g, '');
  for (const match of links.matchAll(/\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = match[1].replace(/^<|>$/g, '');
    const windowsPath = /^[a-z]:[\\/]/i.test(raw);
    if (!windowsPath && /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue;
    const local = raw.split(/[?#]/)[0];
    if (!local) continue;
    linkCount++;
    let target;
    try { target = resolve(root, dirname(path), decodeURIComponent(local)); }
    catch { errors.push(path + ': 无效链接编码 ' + raw); continue; }
    if (!existsSync(target)) errors.push(path + ': 链接目标不存在 ' + raw);
  }

  const titleVersion = source.split('\n')[0].match(/\bv(\d+(?:\.\d+)+)\b/)?.[1];
  const metadata = source.match(/^(?:\| 版本[^|\n]*\|[^\n]*|[- >]*版本[^\n]*)$/m);
  const metaVersion = metadata?.[0].match(/\bv(\d+(?:\.\d+)+)\b/)?.[1];
  if (!titleVersion || !metaVersion || titleVersion !== metaVersion) {
    errors.push(path + ': 标题与版本元数据缺失或不一致');
  }
  if (path !== 'README.md' && !docs.get('README.md').includes('](' + path + ')')) {
    errors.push(path + ': 未加入 README 文档索引');
  }
}

// Definition owners: scope owns BP/DV/IN/SC; contracts own C; PRDs own US.
const definitions = new Map();
function define(id, path, source, offset) {
  if (definitions.has(id)) fail(path, source, offset, '重复定义 ' + id);
  else definitions.set(id, path);
}
for (const [path, source] of docs) {
  const text = prose(source);
  if (path === scopePath) {
    for (const match of text.matchAll(/^\| ((?:BP|DV|IN|SC)-\d+) \|/gm)) {
      define(match[1], path, text, match.index);
    }
  }
  if (path === contractPath || /^docs\/m[2-5]-spec\.md$/.test(path)) {
    for (const match of text.matchAll(/^#{2,3} [^\n]*?((?:M[2-5]-)?C-\d+)(?=[，）\s:：])/gm)) {
      define(match[1], path, text, match.index);
    }
  }
  if (path.endsWith('-PRD.md')) {
    for (const match of text.matchAll(/^\*\*(US-\d+)\s/gm)) {
      define(match[1], path, text, match.index);
    }
  }
}

for (const [path, source] of docs) {
  // Expand US-001～006 and SC-01/02 shorthands; symbolic C-xx remains a placeholder.
  let text = prose(source).replace(/\b((?:M[2-5]-)?C|BP|DV|IN|SC|US)-(\d{1,3})((?:\/\d{1,3})+)/g,
    (_, prefix, first, tail) => [first, ...tail.slice(1).split('/')]
      .map((n) => prefix + '-' + n).join(' '));
  text = text.replace(/\b((?:M[2-5]-)?C|BP|DV|IN|SC|US)-(\d{1,3})\s*[~～–]\s*(?:((?:M[2-5]-)?C|BP|DV|IN|SC|US)-)?(\d{1,3})/g,
    (whole, prefix, first, otherPrefix, last) => {
      const start = Number(first), end = Number(last);
      if ((otherPrefix && otherPrefix !== prefix) || end < start || end - start > 100) {
        errors.push(path + ': 无效编号区间 ' + whole);
        return whole;
      }
      return Array.from({ length: end - start + 1 }, (_, i) =>
        prefix + '-' + String(start + i).padStart(first.length, '0')).join(' ');
    });
  for (const match of text.matchAll(/\b((?:M[2-5]-)?C|BP|DV|IN|SC|US)-(\d{1,3})(?!\d)/g)) {
    if (!definitions.has(match[0])) fail(path, text, match.index, '未定义引用 ' + match[0]);
  }
}

const scope = docs.get(scopePath);
for (const match of scope.matchAll(/^\| (SC-\d+) \|[^\n]+$/gm)) {
  const cells = match[0].split('|').map((cell) => cell.trim());
  if (!/US-\d+/.test(cells[3] ?? '') || !/US-427/.test(cells[3] ?? '') || !cells[4]) {
    fail(scopePath, scope, match.index, 'SC 缺少负责 US、终验承接或验收要求');
  }
}

const forbidden = [
  [/同(?:一)?文件[^\n。；]{0,40}(?:首次|第一个|首个)[^\n。；]{0,15}(?:定义|生效|优先)/g, '重复键规则回归：应取最后值'],
  [/Plugin\/<[^>]+>\/\.env\b|插件\s+\.env\s*(?:覆盖|文件)/g, '插件配置文件名应为 config.env'],
  [/(?:回调[^\n。；]{0,30}无认证|无认证（内部回调）)/g, '回调应遵守 C-11 Bearer 认证'],
  [/索引器无源码|Rust 源码不在仓库/g, '索引器源码存在性描述错误'],
  [/README(?:\.md)?\x60?\s*§7\.\d+/g, 'README §7 已改为条目列表，请更新章节引用'],
];
for (const [path, source] of docs) {
  for (const [pattern, message] of forbidden) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) fail(path, source, match.index, message);
  }
}

if (errors.length) {
  console.error('文档检查失败（' + errors.length + ' 项）：');
  for (const error of errors.slice(0, 80)) console.error('- ' + error);
  if (errors.length > 80) console.error('其余 ' + (errors.length - 80) + ' 项未展开。');
  process.exitCode = 1;
} else {
  console.log('文档检查通过：' + paths.length + ' 份现行文档，' + linkCount
    + ' 个本地链接，' + definitions.size + ' 个定义编号。');
  console.log('检查范围：文件链接、版本、编号引用、SC 承接与勘误回归；不证明产品兼容或源码事实。');
}

