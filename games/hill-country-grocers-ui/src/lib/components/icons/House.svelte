<script lang="ts">
    let {
        x,
        y,
        size = 22,
        built = true
    }: { x: number; y: number; size?: number; built?: boolean } = $props()

    const outline = $derived(
        [
            [-0.4, 0.5],
            [-0.4, 0],
            [-0.56, 0],
            [0, -0.5],
            [0.56, 0],
            [0.4, 0],
            [0.4, 0.5]
        ]
            .map(([px, py]) => `${px * size},${py * size}`)
            .join(' ')
    )
</script>

<g transform="translate({x} {y})" class:built>
    <polygon points={outline} class="house" />
    {#if built}
        <rect
            x={-size * 0.1}
            y={size * 0.18}
            width={size * 0.2}
            height={size * 0.32}
            class="door"
        />
    {/if}
</g>

<style>
    .house {
        fill: rgba(255, 255, 255, 0.6);
        stroke: #6d6d6d;
        stroke-width: 1.4;
        stroke-dasharray: 3 2;
        stroke-linejoin: round;
    }

    .built .house {
        fill: #6d6d6d;
        stroke: #1d140b;
        stroke-dasharray: none;
    }

    .door {
        fill: #2e2e2e;
    }
</style>
