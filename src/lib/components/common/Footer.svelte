<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
</script>

<footer
    class="w-full py-4 px-4 bg-background text-muted-foreground border-t border-border/20 mt-auto mobile:mb-20"
>
    <div class="w-full flex flex-col gap-1 text-left tracking-tight">
        <!-- Company Name -->
        <h3 class="text-xs font-bold text-foreground opacity-90">
            {$t("footer.companyName")}
        </h3>

        <!-- Business Info Block -->
        <div
            class="flex flex-col gap-0.5 text-[10px] leading-tight opacity-60 font-medium"
        >
            <p>
                {$t("footer.address")}
            </p>
            <div class="flex flex-wrap gap-x-2">
                <span>{$t("footer.ceo")}</span>
                <span class="opacity-30">|</span>
                <span>{$t("footer.bizLicense")}</span>
                <span class="opacity-30">|</span>
                <span>{$t("footer.mailOrder")}</span>
            </div>
            <div class="flex flex-wrap gap-x-2">
                <span>{$t("footer.phone")}</span>
                <span class="opacity-30">|</span>
                <span>{$t("footer.email")}</span>
            </div>
        </div>

        <!-- Links Row -->
        <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium pt-1 mt-0.5 border-t border-border/10"
        >
            <a href="/policy" class="hover:text-foreground transition-colors"
                >{$t("legal.privacyPolicy")}</a
            >
            <span class="opacity-20">|</span>
            <a href="/terms" class="hover:text-foreground transition-colors"
                >{$t("legal.termsOfService")}</a
            >

            <div class="flex items-center gap-2 ml-2">
                <a
                    href="https://discord.gg/pyPb9Pp6"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-[#5865F2] transition-colors"
                    title="Discord"
                >
                    <Icon icon="ic:baseline-discord" width="16" height="16" />
                </a>
            </div>

            <p class="opacity-40 ml-auto">
                © 2026 PersonaXi. All Rights Reserved.
            </p>
        </div>
    </div>
</footer>

<style>
    @media (max-width: 768px) {
        footer {
            margin-bottom: 4rem;
        }
    }
</style>
