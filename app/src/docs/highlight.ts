// highlight.js core with only the three languages the docs use (~12 kB gzip),
// instead of shiki, whose grammars and WASM engine would add hundreds of kB.
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerAliases(['ts'], { languageName: 'typescript' });
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });

/** Highlighted HTML, or undefined for unknown languages (the caller escapes those). */
export function highlight(code: string, lang: string): string | undefined {
  if (!lang || !hljs.getLanguage(lang)) return undefined;
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}
