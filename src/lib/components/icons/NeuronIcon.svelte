<script lang="ts">
    // 아이콘의 크기와 색상을 props로 받아 동적으로 제어합니다.
    export let size = 24;
    export let color = "currentColor"; // 기본값은 부모의 글자색을 따릅니다.
    export let variant: "simple" | "standard" | "double" = "standard";
</script>

<svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
>
    {#if variant === "simple"}
        <!-- 4 connections -->
        <circle cx="12" cy="12" r="3" />
        <path d="M12 9V5" />
        <path d="M12 15V19" />
        <path d="M9 12H5" />
        <path d="M15 12H19" />
    {:else if variant === "standard"}
        <!-- 6 connections (Original) -->
        <circle cx="12" cy="12" r="3" />
        <path d="M12 15V21" />
        <path d="M12 9V3" />
        <path d="M9.5 14.5L5 19" />
        <path d="M14.5 9.5L19 5" />
        <path d="M14.5 14.5L19 19" />
        <path d="M9.5 9.5L5 5" />
    {:else if variant === "double"}
        <!-- Two Overlapping Neurons -->
        <!-- Neuron 1 (Back/Top-Left) -->
        <g opacity="0.6" transform="translate(-3, -3)">
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 14.5V19" />
            <path d="M12 9.5V5" />
            <path d="M10 14L6 18" />
            <path d="M14 10L18 6" />
            <path d="M14 14L18 18" />
            <path d="M10 10L6 6" />
        </g>
        <!-- Neuron 2 (Front/Bottom-Right) -->
        <g transform="translate(3, 3)">
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 14.5V19" />
            <path d="M12 9.5V5" />
            <path d="M10 14L6 18" />
            <path d="M14 10L18 6" />
            <path d="M14 14L18 18" />
            <path d="M10 10L6 6" />
        </g>
    {/if}
</svg>
