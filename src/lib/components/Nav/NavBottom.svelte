<script lang="ts">
    import Icon from "@iconify/svelte";
    const items = [
        { href: "/hub", icon: "ph:compass-duotone", label: "탐색" },
        {
            href: "/feed",
            icon: "material-symbols:smart-display-outline",
            label: "피드",
        },
        { href: "/edit", icon: "ph:plus-circle-duotone", label: "생성" },
        { href: "/user/setting", icon: "ph:gear-duotone", label: "설정" },
    ];
</script>

<nav class="nav-bottom">
    {#each items as { href, icon, label }}
        <a class="nav-item" {href}>
            <Icon {icon} width="26" height="26" />
        </a>
    {/each}
</nav>

<style>
    .nav-bottom {
        bottom: 0;
        left: 0;
        width: 100%;
        height: 56px;
        background: var(--color-surface, #fff);
        border-top: 1px solid var(--border-color, #eee);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 9999;

        border-top-left-radius: 15px;
        border-top-right-radius: 15px;
    }
    .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        color: var(--text-secondary, #666);
        text-decoration: none;
    }
    .nav-item:focus-visible,
    .nav-item:hover {
        color: var(--text-primary, #000);
    }
</style>
