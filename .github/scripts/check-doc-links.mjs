/**
 * Documentation link check.
 *
 * A broken relative link in a specification repository is a defect rather than a
 * cosmetic problem: a reader who follows a cross-reference and finds nothing
 * concludes the chapter does not exist, which is a claim about the model.
 *
 * This checks two kinds of reference across every Markdown file in the repository:
 *
 * 1. Relative links to files, including `path#anchor` forms. The anchor is checked
 *    against the target's headings, because a link into a heading that was renamed
 *    is just as broken as a link to a missing file.
 * 2. Relative links to directories, which must exist and must not be empty.
 *
 * Absolute URLs are not fetched. A build step that reaches the network is not
 * reproducible, and a transient failure at a third party must not fail a release.
 *
 * Run with `node .github/scripts/check-doc-links.mjs`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage']);

/** Slugs a Markdown renderer derives from a heading, in the common GitHub form. */
function slugify(heading) {
  return heading
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function listMarkdownFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      found.push(...listMarkdownFiles(join(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(join(directory, entry.name));
    }
  }
  return found;
}

/** Every heading slug a file declares, so an anchor can be validated. */
function headingSlugs(file) {
  const slugs = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(#{1,6})\s+(.*\S)\s*$/.exec(line);
    if (match) slugs.add(slugify(match[2]));
  }
  return slugs;
}

/** Link targets outside code spans and code fences. */
function linkTargets(contents) {
  const withoutFences = contents.replace(/^```[\s\S]*?^```/gm, '');
  const targets = [];
  const pattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(withoutFences)) !== null) targets.push(match[1]);
  return targets;
}

function main() {
  const files = listMarkdownFiles(REPO_ROOT);
  const failures = [];
  let checked = 0;

  for (const file of files) {
    const contents = readFileSync(file, 'utf8');
    const where = relative(REPO_ROOT, file);

    for (const rawTarget of linkTargets(contents)) {
      // Only relative references are checked. Scheme-qualified URLs, anchors
      // within the same document, and mail links are out of scope.
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith('#')) continue;
      if (rawTarget.startsWith('mailto:')) continue;

      const [pathPart, anchor] = rawTarget.split('#');
      if (pathPart === undefined || pathPart === '') continue;

      checked += 1;
      const absolute = resolve(dirname(file), decodeURIComponent(pathPart));

      let stats;
      try {
        stats = statSync(absolute);
      } catch {
        failures.push(`${where}: link target does not exist -> ${rawTarget}`);
        continue;
      }

      if (stats.isDirectory()) {
        if (readdirSync(absolute).length === 0) {
          failures.push(`${where}: link target is an empty directory -> ${rawTarget}`);
        }
        continue;
      }

      if (anchor !== undefined && anchor !== '') {
        const slugs = headingSlugs(absolute);
        if (!slugs.has(anchor)) {
          failures.push(`${where}: anchor not found in target -> ${rawTarget}`);
        }
      }
    }
  }

  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(
    `check-doc-links: checked ${checked} relative links across ${files.length} Markdown files`,
  );
  if (failures.length > 0) {
    console.error(`check-doc-links: ${failures.length} FAILURE(S)`);
    return 1;
  }
  console.log('check-doc-links: PASS');
  return 0;
}

process.exitCode = main();
