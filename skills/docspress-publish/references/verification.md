# Verifying a docs tree before it syncs

Three checks, cheapest first. All are read-only and run against the repo, not the docs
site. Run them from the repo root before the first dry run — a malformed block reaches
WordPress as a broken page, and a broken relative link becomes a 404 the sync happily
publishes.

## 1. Block JSON and enum values

Every `wp:docspress/*` comment must be one self-closing comment carrying valid compact
JSON. This catches trailing commas, unescaped quotes, JavaScript object syntax, and enum
values the block will silently coerce.

```bash
node --input-type=module -e '
import fs from "node:fs"; import path from "node:path";
const ALLOWED = new Set(["colorful-code","code-tabs","callout","flow","api-request","fields",
  "code-playground","diagram","troubleshooter","terminal-session","result","file-tree",
  "prompt","hero","audience-paths","version-notice","version-switcher"].map(n=>"docspress/"+n));
const ENUMS = {
  "docspress/callout": { tone: ["note","tip","warning","danger","success"] },
  "docspress/result":  { status: ["success","neutral","warning","error"] },
  "docspress/diagram": { type: ["flow","sequence"] },
  "docspress/prompt":  { mode: ["chat","code","ask","plan"] },
};
const LANGS = new Set(["bash","css","html","javascript","json","jsx","markdown","php",
  "plaintext","python","shell","sql","tsx","typescript","yaml"]);
const files=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name); e.isDirectory()?walk(p):e.name.endsWith(".md")&&files.push(p);}})("docs");
const re=/<!--\s*wp:([a-z0-9/-]+)\s+(\{.*?\})\s*\/-->/gs;
let n=0, bad=0;
for (const f of files) for (const m of fs.readFileSync(f,"utf8").matchAll(re)) {
  n++; const [ ,name,raw]=m;
  if (!ALLOWED.has(name)) { console.log("UNKNOWN BLOCK",f,name); bad++; continue; }
  let a; try { a=JSON.parse(raw); } catch(e){ console.log("BAD JSON",f,name,e.message); bad++; continue; }
  for (const [k,v] of Object.entries(ENUMS[name]??{}))
    if (k in a && !v.includes(a[k])) { console.log("BAD ENUM",f,`${name}.${k}=${a[k]}`); bad++; }
  if (name==="docspress/colorful-code" && !LANGS.has(a.language)) { console.log("BAD LANG",f,a.language); bad++; }
  for (const t of a.tabs ?? []) if (!LANGS.has(t.language)) { console.log("BAD TAB LANG",f,t.language); bad++; }
  if (name==="docspress/troubleshooter") {
    const ids=new Set([...(a.questions??[]).map(q=>q.id), ...(a.outcomes??[]).map(o=>o.id)]);
    if (!ids.has(a.startId)) { console.log("BAD startId",f); bad++; }
    for (const q of a.questions??[]) for (const k of ["yesNext","noNext"])
      if (!ids.has(q[k])) { console.log("UNRESOLVED",f,`${q.id}.${k}`); bad++; }
  }
}
console.log(`${n} blocks checked, ${bad} problems`);
process.exit(bad?1:0);'
```

Keep the allow-list honest: read the block names from `blocks/*/block.php` in the
`docspress-blocks` plugin for the revision the target site runs, rather than trusting this
list forever.

## 2. Links, anchors, frontmatter and routes

Relative links are rewritten to page URLs at sync time, so one that does not resolve on
disk will not resolve on the site either.

```bash
node --input-type=module -e '
import fs from "node:fs"; import path from "node:path";
const files=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name); e.isDirectory()?walk(p):e.name.endsWith(".md")&&files.push(p);}})("docs");
const slug=h=>h.trim().toLowerCase().replace(/`([^`]*)`/g,"$1")
  .replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/^-|-$/g,"");
const anchors=new Map(), routes=new Map(); let bad=0;
for (const f of files) {
  const t=fs.readFileSync(f,"utf8");
  anchors.set(path.resolve(f), new Set([...t.matchAll(/^#{2,6}\s+(.*)$/gm)].map(m=>slug(m[1]))));
  if (!t.startsWith("---\ntitle: ")) { console.log("NO FRONTMATTER TITLE",f); bad++; }
  if (/^#\s+/m.test(t)) { console.log("HAS H1",f); bad++; }
  const r=f.replace(/\.md$/,"").replace(/\/index$/,"");
  if (routes.has(r)) { console.log("DUPLICATE ROUTE",r); bad++; } else routes.set(r,f);
}
for (const f of files) for (const m of fs.readFileSync(f,"utf8")
    .matchAll(/\[[^\]]*\]\((?!https?:\/\/|#|mailto:)([^)]+)\)/g)) {
  const [p,,frag]=m[1].split(/(#)/);
  const dest = p ? path.resolve(path.dirname(f), p) : path.resolve(f);
  if (!fs.existsSync(dest)) { console.log("BROKEN LINK",f,"->",m[1]); bad++; continue; }
  if (frag && !anchors.get(dest)?.has(frag)) { console.log("BAD ANCHOR",f,"->",m[1]); bad++; }
}
console.log(`${files.length} files, ${routes.size} routes, ${bad} problems`);
process.exit(bad?1:0);'
```

Also grep for placeholders that survived generation — `TODO`, `TBD`, `YOUR_`, `FIXME`,
fake domains — and for unverified version numbers.

## 3. Converter round-trip

The strongest check: run the **pinned action's own** converter over the tree and confirm
every block survives. Clone the pinned revision somewhere scratch first.

```bash
git clone https://github.com/linchpin/docspress /tmp/docspress-pin
git -C /tmp/docspress-pin checkout 3260df1c7deceb4da867bdba7967be4b807e4025
( cd /tmp/docspress-pin && npm ci --omit=dev )
```

The `npm ci` is not optional: `src/markdown.js` imports `gray-matter`, so a bare clone
fails with `ERR_MODULE_NOT_FOUND` before it converts anything. Use the subshell `cd` —
`npm --prefix <dir> ci` is rejected outright (`npm ci` takes no positional arguments and
ignores `--prefix` for lockfile resolution).

```bash
node --input-type=module -e '
import { markdownToBlocks } from "/tmp/docspress-pin/src/markdown.js";
import fs from "node:fs"; import path from "node:path";
const files=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name); e.isDirectory()?walk(p):e.name.endsWith(".md")&&files.push(p);}})("docs");
const re=/<!--\s*wp:(docspress\/[a-z0-9-]+) (\{.*?\}) \/-->/gs;
let n=0, same=0, drift=0;
for (const f of files) {
  const md=fs.readFileSync(f,"utf8");
  let out; try { out=markdownToBlocks(md,{createH1:false}); }
  catch(e){ console.log("CONVERT FAIL",f,e.message); drift++; continue; }
  const s=[...md.matchAll(re)], d=[...out.blocks.matchAll(re)];
  if (s.length!==d.length) { console.log("COUNT",f,s.length,"->",d.length); drift++; continue; }
  for (let i=0;i<s.length;i++) {
    n++;
    const a=JSON.parse(s[i][2]), b=JSON.parse(d[i][2]);
    if (s[i][1]===d[i][1] && JSON.stringify(a)===JSON.stringify(b)) same++;
    else { console.log("DRIFT",f,i,s[i][1]); drift++; }
  }
}
console.log(`${n} blocks round-tripped, ${same} identical, ${drift} drifted`);
process.exit(drift?1:0);'
```

**Compare parsed attributes, not raw strings.** DocsPress normalizes HTML-sensitive
attribute characters to WordPress-safe Unicode escapes — `<` becomes `\u003c` and `>`
becomes `\u003e` — so a byte-for-byte comparison reports most blocks as altered when
nothing is wrong. Any `content` or `source` attribute containing markup or an arrow will differ.

`markdownToBlocks` returns `{ title, blocks, data }`, where `blocks` is a string. Treating
it as a string directly (or `JSON.stringify`-ing the object) is the usual reason this check
appears to fail everywhere at once.

## What none of this catches

- Whether the target site has the `docspress-blocks` plugin active. A block comment on a
  site without the plugin renders as nothing.
- Whether the facts are true. These checks prove the docs are well-formed, not correct —
  cross-check claims against source, which is `generate-docs-from-source`'s job.
- Deletion scope. That only shows up in a dry run's delete count.
