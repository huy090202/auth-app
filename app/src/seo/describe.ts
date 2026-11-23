const MAX = 160;

/** Cut at a word boundary so the result, with its ellipsis, is at most `max` characters. Short text is returned unchanged. */
export function clamp(text: string, max = MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

function plain(block: string): string {
  return block
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The meta description of a docs page: its first paragraph as plain text, at most 160 characters. Empty when it has none. */
export function describe(markdownBody: string): string {
  const body = markdownBody.replace(/\r\n?/g, '\n').replace(/```[\s\S]*?(```|$)/g, '\n\n');
  for (const block of body.split(/\n\s*\n/)) {
    const b = block.trim();
    // Headings, tables, quotes, lists, HTML and rules are not a paragraph.
    if (!b || /^(#|\||>|[-*+]\s|\d+[.)]\s|<|---|===)/.test(b)) continue;
    const text = plain(b);
    if (text) return clamp(text);
  }
  return '';
}
