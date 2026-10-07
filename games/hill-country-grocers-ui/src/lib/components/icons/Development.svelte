<script lang="ts">
    let {
        x,
        y,
        size = 22,
        built = true
    }: { x: number; y: number; size?: number; built?: boolean } = $props()

    const width = $derived(size * 0.66)
    const height = $derived(size)
    const left = $derived(-width / 2)
    const top = $derived(-height / 2)
    const depth = $derived(size * 0.14)
    const windows = $derived(
        Array.from({ length: 6 }, (_, index) => ({
            index,
            x: left + width * (index % 2 === 0 ? 0.16 : 0.58),
            y: top + height * (0.14 + Math.floor(index / 2) * 0.22)
        }))
    )
</script>

<g transform="translate({x - depth / 2} {y + depth / 2})" class:built>
    {#if built}
        <polygon
            points="{left},{top} {left + depth},{top - depth} {-left + depth},{top - depth} {-left},{top}"
            class="roof"
        />
        <polygon
            points="{-left},{top} {-left + depth},{top - depth} {-left + depth},{-top - depth} {-left},{-top}"
            class="side"
        />
        <rect x={left} y={top} {width} {height} class="front" />
        {#each windows as pane (pane.index)}
            <rect x={pane.x} y={pane.y} width={width * 0.26} height={height * 0.13} class="window" />
        {/each}
        <rect
            x={-width * 0.13}
            y={-top - height * 0.2}
            width={width * 0.26}
            height={height * 0.2}
            class="door"
        />
    {:else}
        <rect x={left} y={top} {width} {height} class="slot" />
    {/if}
</g>

<style>
    .front {
        fill: #9a9a9a;
        stroke: #1d140b;
        stroke-width: 1.2;
    }

    .side {
        fill: #686868;
        stroke: #1d140b;
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .roof {
        fill: #b9b9b9;
        stroke: #1d140b;
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .window {
        fill: #f2d98c;
    }

    .door {
        fill: #3a2a1e;
    }

    .slot {
        fill: rgba(255, 255, 255, 0.55);
        stroke: #6d6d6d;
        stroke-width: 1.3;
        stroke-dasharray: 3 2;
    }
</style>
