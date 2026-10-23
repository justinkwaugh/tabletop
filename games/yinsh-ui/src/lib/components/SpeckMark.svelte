<script lang="ts">
    let {
        x,
        y,
        r,
        stretch,
        angle,
        scale,
        fill
    }: {
        x: number
        y: number
        r: number
        stretch: number
        angle: number
        scale: number
        fill: string
    } = $props()
</script>

<ellipse
    transform="translate({x * scale} {y}) rotate({angle})"
    rx={r * scale * stretch}
    ry={r * scale}
    {fill}
    opacity="0.9"
></ellipse>
