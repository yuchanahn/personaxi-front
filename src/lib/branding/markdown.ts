import { marked } from "marked";
import { applyBrandingText } from "./placeholders";

export async function renderBrandedMarkdown(
    raw: string,
    locale?: string | null,
): Promise<string> {
    return await marked.parse(applyBrandingText(raw, locale));
}
