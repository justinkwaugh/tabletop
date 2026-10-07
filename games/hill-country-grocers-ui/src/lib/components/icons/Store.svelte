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
    const depth = $derived(size * 0.16)
    const awningTop = $derived(-half + size * 0.24)
    const awningBottom = $derived(-half + size * 0.44)
    const stripes = $derived(
        Array.from({ length: 5 }, (_, index) => ({
            index,
            x: -half + (index * size) / 5,
            width: size / 5
        }))
    )
</script>

<g transform="translate({x - depth / 2} {y + depth / 2})" class:ghost>
    <polygon
        points="{-half},{-half} {-half + depth},{-half - depth} {half + depth},{-half - depth} {half},{-half}"
        {fill}
        class="top"
    />
    <polygon
        points="{half},{-half} {half + depth},{-half - depth} {half + depth},{half - depth} {half},{half}"
        {fill}
        class="side"
    />
    <rect x={-half} y={-half} width={size} height={size} {fill} class="front" />
    <rect x={-half} y={-half} width={size} height={size * 0.24} fill={tint} class="sign" />
    {#each stripes as stripe (stripe.index)}
        <rect
            x={stripe.x}
            y={awningTop}
            width={stripe.width}
            height={awningBottom - awningTop}
            fill={stripe.index % 2 === 0 ? tint : fill}
        />
        <circle
            cx={stripe.x + stripe.width / 2}
            cy={awningBottom}
            r={stripe.width / 2}
            fill={stripe.index % 2 === 0 ? tint : fill}
        />
    {/each}
    <rect
        x={-half + size * 0.1}
        y={half - size * 0.36}
        width={size * 0.22}
        height={size * 0.2}
        class="window"
    />
    <rect
        x={half - size * 0.32}
        y={half - size * 0.36}
        width={size * 0.22}
        height={size * 0.2}
        class="window"
    />
    <rect
        x={-size * 0.11}
        y={half - size * 0.4}
        width={size * 0.22}
        height={size * 0.4}
        class="door"
    />
    <rect x={-half} y={-half} width={size} height={size} class="outline" />
</g>

<style>
    polygon,
    .outline {
        stroke: #1d140b;
        stroke-width: 1.2;
        stroke-linejoin: round;
    }

    .outline {
        fill: none;
    }

    .top {
        filter: brightness(1.3);
    }

    .side {
        filter: brightness(0.7);
    }

    .sign {
        stroke: #1d140b;
        stroke-width: 0.8;
    }

    .window {
        fill: #d9eef5;
        stroke: #1d140b;
        stroke-width: 0.7;
    }

    .door {
        fill: #3a2a1e;
    }

    .ghost {
        opacity: 0.7;
    }

    .ghost polygon,
    .ghost .outline {
        stroke-dasharray: 3 2;
    }
</style>
