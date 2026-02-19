<script lang="ts">
    import { onMount } from "svelte";

    /** Raw HTML template from the creator, with {{{var}}} placeholders */
    export let template: string = "";
    /** CSS for the template */
    export let css: string = "";
    /** Current variable values: { name: value } */
    export let variables: Record<string, string> = {};

    let containerEl: HTMLElement;

    // Render the template with variable values substituted
    function renderTemplate(
        tmpl: string,
        vars: Record<string, string>,
    ): string {
        let result = tmpl;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replaceAll(`{{{${key}}}}`, escapeHtml(value));
        }
        return result;
    }

    function escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // DOMPurify-like sanitization (basic version)
    // Strips <script>, on* event handlers, javascript: URLs
    function sanitizeHtml(html: string): string {
        // Remove script tags
        let clean = html.replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            "",
        );
        // Remove event handlers
        clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
        clean = clean.replace(/\s+on\w+\s*=\s*\S+/gi, "");
        // Remove javascript: URLs
        clean = clean.replace(/javascript\s*:/gi, "");
        return clean;
    }

    $: renderedHtml = sanitizeHtml(renderTemplate(template, variables));
</script>

{#if template}
    <div class="variable-status-panel" bind:this={containerEl}>
        {#if css}
            <svelte:element this={"style"}>{css}</svelte:element>
        {/if}
        {@html renderedHtml}
    </div>
{/if}

<style>
    .variable-status-panel {
        margin: 8px 0;
        padding: 12px 16px;
        border-radius: 12px;
        background: var(--bg-secondary, rgba(255, 255, 255, 0.05));
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        backdrop-filter: blur(10px);
        font-size: 0.9em;
        color: var(--text-primary, #eee);
        line-height: 1.6;
    }
</style>
