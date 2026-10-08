<script lang="ts">
    let {
        x,
        y,
        color,
        textColor,
        initial,
        size = 30
    }: { x: number; y: number; color: string; textColor: string; initial: string; size?: number } =
        $props()
</script>

<g transform="translate({x} {y})">
    <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        rx="4"
        fill={color}
        stroke="#1d140b"
        stroke-width="1.6"
    />
    <text y={size * 0.2} fill={textColor} font-size={size * 0.6}>{initial}</text>
</g>

<style>
    text {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
        pointer-events: none;
    }
</style>
