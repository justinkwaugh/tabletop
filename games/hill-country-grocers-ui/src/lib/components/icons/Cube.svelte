<script lang="ts">
    let {
        x,
        y,
        size = 18,
        fill,
        ghost = false
    }: { x: number; y: number; size?: number; fill: string; ghost?: boolean } = $props()

    const half = $derived(size / 2)
    const lift = $derived(size * 0.28)
</script>

<g transform="translate({x} {y})" class:ghost>
    <polygon
        points="{-half},{-half + lift} 0,{-half} {half},{-half + lift} 0,{-half + 2 * lift}"
        {fill}
        class="top"
    />
    <polygon points="{-half},{-half + lift} 0,{-half + 2 * lift} 0,{half} {-half},{half - lift}" {fill} />
    <polygon
        points="0,{-half + 2 * lift} {half},{-half + lift} {half},{half - lift} 0,{half}"
        {fill}
        class="side"
    />
</g>

<style>
    polygon {
        stroke: #1d140b;
        stroke-width: 1.1;
        stroke-linejoin: round;
    }

    .top {
        filter: brightness(1.25);
    }

    .side {
        filter: brightness(0.78);
    }

    .ghost {
        opacity: 0.75;
    }

    .ghost polygon {
        stroke-dasharray: 2 2;
    }
</style>
