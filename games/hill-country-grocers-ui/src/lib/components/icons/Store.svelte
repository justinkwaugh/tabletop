<script lang="ts">
    let {
        x,
        y,
        size = 18,
        fill,
        tint,
        ghost = false
    }: { x: number; y: number; size?: number; fill: string; tint: string; ghost?: boolean } =
        $props()

    const half = $derived(size / 2)
    const corner = $derived(size * 0.12)
    const awningTop = $derived(-half + size * 0.26)
    const awningBottom = $derived(-half + size * 0.44)
    const scallops = $derived(
        Array.from({ length: 4 }, (_, index) => ({
            index,
            x: -half + ((index + 0.5) * size) / 4
        }))
    )
</script>

<g transform="translate({x} {y})" class:ghost>
    <rect x={-half} y={-half} width={size} height={size} rx={corner} {fill} class="body" />
    <rect
        x={-half + size * 0.12}
        y={-half + size * 0.06}
        width={size * 0.76}
        height={size * 0.14}
        rx={size * 0.05}
        fill={tint}
    />
    <rect x={-half} y={awningTop} width={size} height={awningBottom - awningTop} fill={tint} />
    {#each scallops as scallop (scallop.index)}
        <rect
            x={scallop.x - size / 16}
            y={awningTop}
            width={size / 8}
            height={awningBottom - awningTop}
            {fill}
            opacity="0.85"
        />
        <circle cx={scallop.x} cy={awningBottom} r={size / 8} fill={tint} />
    {/each}
    <rect
        x={-half + size * 0.12}
        y={half - size * 0.38}
        width={size * 0.4}
        height={size * 0.26}
        rx={size * 0.04}
        class="window"
    />
    <path
        d="M {half - size * 0.36} {half} V {half - size * 0.3} a {size * 0.12} {size *
            0.12} 0 0 1 {size * 0.24} 0 V {half} Z"
        class="door"
    />
</g>

<style>
    .body {
        stroke: rgba(29, 20, 11, 0.55);
        stroke-width: 0.9;
        filter: drop-shadow(0.8px 1.4px 0.9px rgba(30, 20, 10, 0.4));
    }

    .window {
        fill: #e6f3f7;
        stroke: rgba(29, 20, 11, 0.35);
        stroke-width: 0.6;
    }

    .door {
        fill: #4a3528;
    }

    .ghost {
        opacity: 0.6;
    }

    .ghost .body {
        stroke-dasharray: 3 2;
        stroke-width: 1.4;
    }
</style>
