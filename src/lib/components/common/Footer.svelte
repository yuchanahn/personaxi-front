<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
</script>

<footer
    class="w-full py-6 px-4 bg-background text-muted-foreground border-t border-border/20 mt-auto select-text"
>
    <div class="max-w-screen-xl mx-auto w-full flex flex-col gap-2 text-left">
        <h3 class="text-xs font-bold text-foreground opacity-90">
            {$t("footer.companyName")}
        </h3>

        <div
            class="flex flex-col gap-1 text-[10px] leading-normal opacity-70 font-medium"
        >
            <p>{$t("footer.address")}</p>
            <div class="flex flex-wrap items-center gap-x-2">
                <span>{$t("footer.ceo")}</span>
                <span class="w-px h-2 bg-border/30"></span>
                <span>{$t("footer.bizLicense")}</span>
                <span class="w-px h-2 bg-border/30"></span>
                <span>{$t("footer.mailOrder")}</span>
            </div>
            <div class="flex flex-wrap items-center gap-x-2">
                <span>{$t("footer.phone")}</span>
                <span class="w-px h-2 bg-border/30"></span>
                <span>{$t("footer.email")}</span>
            </div>
        </div>

        <div
            class="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold pt-3 mt-1 border-t border-border/10"
        >
            <a
                href="/policy"
                class="text-foreground/80 hover:text-foreground underline decoration-border/50 underline-offset-2 transition-colors"
                >{$t("legal.privacyPolicy")}</a
            >
            <a
                href="/terms"
                class="text-foreground/80 hover:text-foreground underline decoration-border/50 underline-offset-2 transition-colors"
                >{$t("legal.termsOfService")}</a
            >
            <a href="/licenses" class="hover:text-foreground transition-colors"
                >{$t("legal.licensesAndCredits")}</a
            >

            <div class="flex items-center gap-2">
                <a
                    href="https://discord.gg/pyPb9Pp6"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-[#5865F2] transition-colors p-1"
                    title="Discord"
                >
                    <Icon icon="ic:baseline-discord" width="16" height="16" />
                </a>
            </div>

            <p class="opacity-40 ml-auto text-[9px]">
                © 2026 PersonaXi. All Rights Reserved.
            </p>
        </div>
    </div>
</footer>

<style>
    /* Global CSS나 Tailwind가 방해할 경우를 대비해 명시적 드래그 허용 */
    footer {
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
        user-select: text;
    }

    @media (max-width: 768px) {
        footer {
            /* 4rem 대신 safe-area-inset을 고려한 패딩이 더 안전합니다 */
            padding-bottom: calc(6rem + env(safe-area-inset-bottom));
        }
    }
</style>
