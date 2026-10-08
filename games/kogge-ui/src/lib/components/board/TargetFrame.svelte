<script lang="ts">
    import type { BoardTarget } from '$lib/model/session.svelte.js'

    let {
        target,
        width,
        height,
        x = 0,
        y = 0,
        radius = 4
    }: {
        target: BoardTarget
        width: number
        height: number
        x?: number
        y?: number
        radius?: number
    } = $props()

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            target.select()
        }
    }
</script>

<rect
    class="kogge-target"
    {x}
    {y}
    {width}
    {height}
    rx={radius}
    role="button"
    tabindex="0"
    aria-label={target.label}
    onclick={() => target.select()}
    onkeydown={onKeydown}
>
    <title>{target.label}</title>
</rect>

<style>
    .kogge-target {
        fill: #f2c94c;
        fill-opacity: 0.06;
        stroke: #e39b12;
        stroke-width: 5;
        filter: drop-shadow(0 0 5px rgba(255, 196, 46, 0.9));
        cursor: pointer;
        animation: kogge-target-pulse 1.6s ease-in-out infinite;
        outline: none;
    }

    .kogge-target:hover,
    .kogge-target:focus-visible {
        fill-opacity: 0.2;
        stroke: #ffc21a;
        stroke-width: 6;
    }

    @keyframes kogge-target-pulse {
        0%,
        100% {
            stroke-opacity: 1;
        }
        50% {
            stroke-opacity: 0.7;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .kogge-target {
            animation: none;
        }
    }
</style>
