import type { Chat2DBlock } from "$lib/chat2d/types";

const STYLE_TAG_RE = /<style\b/i;
const ANY_HTML_RE = /<[a-z][^>]*>/i;
const HTML_INTERACTIVE_ATTR_RE = /\s(data-action|data-role|data-id|data-value|data-required)\s*=/i;
const GAME_UI_GROUP_RE = /<div\b[^>]*class=(["'])[^"']*\bgame-ui-group\b[^"']*\1/i;
const ATOMIC_HTML_RE =
  /<(table|thead|tbody|tr|td|th|button|label|select|option|textarea|form|input|img)\b/i;
const SIMPLE_HTML_TEXT_RE =
  /<(div|section|article|header|footer|main|aside|p|span|strong|em|b|i|u|br|blockquote|ul|ol|li|h[1-6]|a|code)\b/i;
const VOID_TAGS = new Set(["br", "hr", "img", "input"]);
const INCOMPLETE_TAG_FRAGMENT_RE = /<[^>\n]*$/;

export type TestRenderableBlock =
  | Chat2DBlock
  | { type: "dialogue"; id: string; speaker: string; content: string }
  | { type: "narration"; id: string; content: string }
  | { type: "code"; id: string; language: string; content: string };

export abstract class RenderBlockPlayer {
  started = false;
  completed = false;
  sealed = true;

  constructor(public block: Chat2DBlock, sealed = true) {
    this.sealed = sealed;
  }

  get id() {
    return this.block.id;
  }

  start() {
    this.started = true;
    this.onStart();
  }

  update(block: Chat2DBlock, sealed: boolean) {
    this.block = block;
    this.sealed = sealed;
    this.onUpdate();
  }

  forceComplete() {
    this.started = true;
    this.completed = true;
    this.onForceComplete();
  }

  protected onStart() {}

  protected onUpdate() {}

  protected onForceComplete() {}

  abstract tick(deltaMs: number, charsPerSecond: number): boolean;

  abstract getRenderableBlock(): TestRenderableBlock | null;
}

export class AtomicBlockPlayer extends RenderBlockPlayer {
  protected onStart() {
    if (this.sealed) {
      this.completed = true;
    }
  }

  protected onUpdate() {
    if (this.started && this.sealed) {
      this.completed = true;
    }
  }

  tick(): boolean {
    if (this.started && this.sealed && !this.completed) {
      this.completed = true;
      return true;
    }
    return false;
  }

  getRenderableBlock(): TestRenderableBlock | null {
    if (!this.started) return null;
    if (this.sealed || this.completed) return this.block;

    if (
      this.block.type === "dialogue" ||
      this.block.type === "narration" ||
      this.block.type === "code"
    ) {
      return {
        type: "narration",
        id: `${this.block.id}-atomic-loading`,
        content:
          '<p class="test-atomic-placeholder">인터랙티브 HTML 블록 조립 중...</p>',
      };
    }

    return null;
  }
}

export class TextBlockPlayer extends RenderBlockPlayer {
  private visibleChars = 0;

  protected onForceComplete() {
    this.visibleChars = this.getTargetText().length;
  }

  protected onUpdate() {
    const targetLength = this.getTargetText().length;
    if (this.visibleChars > targetLength) {
      this.visibleChars = targetLength;
    }
    this.completed = this.started && this.sealed && this.visibleChars >= targetLength;
  }

  tick(deltaMs: number, charsPerSecond: number): boolean {
    if (!this.started || this.completed) return false;

    const targetLength = this.getTargetText().length;
    if (targetLength === 0) {
      if (this.sealed) this.completed = true;
      return false;
    }

    const nextVisibleChars = Math.min(
      targetLength,
      this.visibleChars + (charsPerSecond * deltaMs) / 1000,
    );
    const changed = Math.floor(nextVisibleChars) !== Math.floor(this.visibleChars);
    this.visibleChars = nextVisibleChars;

    if (this.sealed && this.visibleChars >= targetLength) {
      this.completed = true;
    }

    return changed || this.completed;
  }

  getRenderableBlock(): TestRenderableBlock | null {
    if (!this.started) return null;
    const visibleText = this.getTargetText().slice(0, Math.floor(this.visibleChars));

    if (this.block.type === "dialogue") {
      return {
        type: "dialogue",
        id: this.block.id,
        speaker: this.block.speaker,
        content: visibleText,
      };
    }

    if (this.block.type === "narration") {
      return {
        type: "narration",
        id: this.block.id,
        content: visibleText,
      };
    }

    if (this.block.type === "code") {
      return {
        type: "code",
        id: this.block.id,
        language: this.block.language,
        content: visibleText,
      };
    }

    return null;
  }

  private getTargetText() {
    if (this.block.type === "dialogue") return this.block.content;
    if (this.block.type === "narration") return this.block.content;
    if (this.block.type === "code") return this.block.content;
    return "";
  }
}

export class HtmlTextBlockPlayer extends RenderBlockPlayer {
  private visibleChars = 0;

  protected onForceComplete() {
    this.visibleChars = this.getPlainText().length;
  }

  protected onUpdate() {
    const targetLength = this.getPlainText().length;
    if (this.visibleChars > targetLength) {
      this.visibleChars = targetLength;
    }
    this.completed = this.started && this.sealed && this.visibleChars >= targetLength;
  }

  tick(deltaMs: number, charsPerSecond: number): boolean {
    if (!this.started || this.completed) return false;

    const targetLength = this.getPlainText().length;
    if (targetLength === 0) {
      if (this.sealed) this.completed = true;
      return false;
    }

    const nextVisibleChars = Math.min(
      targetLength,
      this.visibleChars + (charsPerSecond * deltaMs) / 1000,
    );
    const changed = Math.floor(nextVisibleChars) !== Math.floor(this.visibleChars);
    this.visibleChars = nextVisibleChars;

    if (this.sealed && this.visibleChars >= targetLength) {
      this.completed = true;
    }

    return changed || this.completed;
  }

  getRenderableBlock(): TestRenderableBlock | null {
    if (!this.started) return null;
    const visibleHtml = buildProgressiveHtml(
      this.getTargetHtml(),
      Math.floor(this.visibleChars),
    );

    if (this.block.type === "dialogue") {
      return {
        type: "dialogue",
        id: this.block.id,
        speaker: this.block.speaker,
        content: visibleHtml,
      };
    }

    if (this.block.type === "narration") {
      return {
        type: "narration",
        id: this.block.id,
        content: visibleHtml,
      };
    }

    return null;
  }

  private getTargetHtml() {
    if (this.block.type === "dialogue") return this.block.content;
    if (this.block.type === "narration") return this.block.content;
    return "";
  }

  private getPlainText() {
    return stripTags(this.getTargetHtml());
  }
}

export class MixedInteractiveSuffixBlockPlayer extends RenderBlockPlayer {
  private visibleChars = 0;

  protected onForceComplete() {
    this.visibleChars = this.getPrefixPlainText().length;
  }

  protected onUpdate() {
    const targetLength = this.getPrefixPlainText().length;
    if (this.visibleChars > targetLength) {
      this.visibleChars = targetLength;
    }
    this.completed = this.started && this.sealed && this.visibleChars >= targetLength;
  }

  tick(deltaMs: number, charsPerSecond: number): boolean {
    if (!this.started || this.completed) return false;

    const targetLength = this.getPrefixPlainText().length;
    if (targetLength === 0) {
      if (this.sealed) this.completed = true;
      return false;
    }

    const nextVisibleChars = Math.min(
      targetLength,
      this.visibleChars + (charsPerSecond * deltaMs) / 1000,
    );
    const changed = Math.floor(nextVisibleChars) !== Math.floor(this.visibleChars);
    this.visibleChars = nextVisibleChars;

    if (this.sealed && this.visibleChars >= targetLength) {
      this.completed = true;
    }

    return changed || this.completed;
  }

  getRenderableBlock(): TestRenderableBlock | null {
    if (!this.started) return null;

    const typedPrefix = this.getTypedPrefixContent();
    const suffixReady = this.sealed && this.visibleChars >= this.getPrefixPlainText().length;
    const content = suffixReady ? typedPrefix + this.getHtmlSuffix() : typedPrefix;

    if (this.block.type === "dialogue") {
      return {
        type: "dialogue",
        id: this.block.id,
        speaker: this.block.speaker,
        content,
      };
    }

    if (this.block.type === "narration") {
      return {
        type: "narration",
        id: this.block.id,
        content,
      };
    }

    return null;
  }

  private getContent() {
    if (this.block.type === "dialogue") return this.block.content;
    if (this.block.type === "narration") return this.block.content;
    return "";
  }

  private getSplitParts() {
    return splitInteractiveSuffix(this.getContent());
  }

  private getPrefixContent() {
    return this.getSplitParts()?.prefix ?? this.getContent();
  }

  private getHtmlSuffix() {
    return this.getSplitParts()?.suffix ?? "";
  }

  private getPrefixPlainText() {
    return stripTags(this.getPrefixContent());
  }

  private getTypedPrefixContent() {
    const prefix = this.getPrefixContent();
    const visibleChars = Math.floor(this.visibleChars);

    if (ANY_HTML_RE.test(prefix) && SIMPLE_HTML_TEXT_RE.test(prefix)) {
      return buildProgressiveHtml(prefix, visibleChars);
    }

    return this.getPrefixPlainText().slice(0, visibleChars);
  }
}

export function createRenderBlockPlayer(
  block: Chat2DBlock,
  sealed: boolean,
): RenderBlockPlayer {
  if (block.type === "dialogue" || block.type === "narration") {
    const content = block.content;
    const splitInteractive = splitInteractiveSuffix(content);

    if (splitInteractive) {
      return new MixedInteractiveSuffixBlockPlayer(block, sealed);
    }

    if (
      STYLE_TAG_RE.test(content) ||
      ATOMIC_HTML_RE.test(content) ||
      HTML_INTERACTIVE_ATTR_RE.test(content)
    ) {
      return new AtomicBlockPlayer(block, sealed);
    }

    if (ANY_HTML_RE.test(content) && SIMPLE_HTML_TEXT_RE.test(content)) {
      return new HtmlTextBlockPlayer(block, sealed);
    }

    return new TextBlockPlayer(block, sealed);
  }

  if (block.type === "code") {
    return new TextBlockPlayer(block, sealed);
  }

  return new AtomicBlockPlayer(block, sealed);
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(INCOMPLETE_TAG_FRAGMENT_RE, "");
}

function buildProgressiveHtml(html: string, visibleChars: number) {
  if (visibleChars <= 0) return "";

  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  const stack: string[] = [];
  let remaining = visibleChars;
  let out = "";

  for (const token of tokens) {
    if (token.startsWith("<")) {
      const closeMatch = token.match(/^<\/\s*([a-z0-9]+)/i);
      if (closeMatch) {
        const name = closeMatch[1].toLowerCase();
        const stackIndex = stack.lastIndexOf(name);
        if (stackIndex !== -1) {
          stack.splice(stackIndex, 1);
        }
        out += token;
        continue;
      }

      const openMatch = token.match(/^<\s*([a-z0-9]+)/i);
      const name = openMatch?.[1]?.toLowerCase() || "";
      const selfClosing = /\/>$/.test(token) || VOID_TAGS.has(name);
      out += token;
      if (name && !selfClosing) {
        stack.push(name);
      }
      continue;
    }

    if (remaining <= 0) break;
    const safeToken = sanitizeTextToken(token);
    if (!safeToken) break;
    const slice = safeToken.slice(0, remaining);
    out += slice;
    remaining -= slice.length;
    if (slice.length < safeToken.length) break;
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    out += `</${stack[i]}>`;
  }

  const trailingFragment = getTrailingIncompleteFragment(html);
  if (trailingFragment) {
    out += trailingFragment;
  }

  return out;
}

function sanitizeTextToken(token: string) {
  if (!token.includes("<")) return token;
  return token.replace(INCOMPLETE_TAG_FRAGMENT_RE, "");
}

function getTrailingIncompleteFragment(html: string) {
  const match = html.match(INCOMPLETE_TAG_FRAGMENT_RE);
  return match ? match[0] : "";
}

function splitInteractiveSuffix(content: string) {
  const groupMatch = GAME_UI_GROUP_RE.exec(content);
  const attrMatch = HTML_INTERACTIVE_ATTR_RE.exec(content);
  const attrTagStart =
    typeof attrMatch?.index === "number"
      ? findContainingTagStart(content, attrMatch.index)
      : -1;

  const candidates = [groupMatch?.index, attrTagStart].filter(
    (value): value is number => typeof value === "number" && value >= 0,
  );

  if (!candidates.length) return null;

  const startIndex = Math.min(...candidates);
  const prefix = content.slice(0, startIndex).trimEnd();
  const suffix = content.slice(startIndex).trimStart();

  // If the prefix already contains HTML, splitting here would auto-close the
  // existing structure during progressive typing and expose tag attributes as
  // plain text in the chat room. In that case, render the whole block
  // atomically instead of trying to type only the prefix.
  if (ANY_HTML_RE.test(prefix)) return null;
  if (!prefix || !suffix) return null;

  return { prefix, suffix };
}

function findContainingTagStart(content: string, index: number) {
  const tagStart = content.lastIndexOf("<", index);
  if (tagStart === -1) return -1;

  const lastTagClose = content.lastIndexOf(">", index);
  if (lastTagClose > tagStart) {
    return -1;
  }

  return tagStart;
}
