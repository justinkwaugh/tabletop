<script lang="ts">
    let {
        x,
        y,
        size = 20,
        built = true
    }: { x: number; y: number; size?: number; built?: boolean } = $props()

    const width = $derived(size * 0.7)
    const left = $derived(-width / 2)
    const top = $derived(-size / 2)
    const windows = $derived(
        Array.from({ length: 6 }, (_, index) => ({
            index,
            x: left + width * (index % 2 === 0 ? 0.2 : 0.58),
            y: top + size * (0.2 + Math.floor(index / 2) * 0.2)
        }))
    )
</script>

<g transform="translate({x} {y})">
    {#if built}
        <rect x={left} y={top} {width} height={size} rx={size * 0.08} class="body" />
        <rect
            x={left - size * 0.04}
            y={top - size * 0.04}
            width={width + size * 0.08}
            height={size * 0.1}
            rx={size * 0.04}
            class="roof"
        />
        {#each windows as pane (pane.index)}
            <rect
                x={pane.x}
                y={pane.y}
                width={width * 0.22}
                height={size * 0.12}
                rx={size * 0.02}
                class="window"
            />
        {/each}
        <path
            d="M {-width * 0.14} {-top} V {-top - size * 0.16} a {width * 0.14} {width * 0.14} 0 0 1 {width *
                0.28} 0 V {-top} Z"
            class="door"
        />
    {:else}
        <rect x={left} y={top} {width} height={size} rx={size * 0.08} class="slot" />
    {/if}
</g>

<style>
    .body {
        fill: #8a8f99;
        stroke: #3f434b;
        stroke-width: 0.9;
        filter: drop-shadow(0.8px 1.2px 0.8px rgba(30, 20, 10, 0.35));
    }

    .roof {
        fill: #5d626c;
    }

    .window {
        fill: #f6dc8c;
    }

    .door {
        fill: #4a3528;
    }

    .slot {
        fill: rgba(255, 255, 255, 0.55);
        stroke: #7b7f86;
        stroke-width: 1.2;
        stroke-dasharray: 3 2;
    }
</style>
