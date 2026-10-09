<script lang="ts">
    import { type Rect } from '$lib/utils/boardGeometry.js'

    const GlowReach = 16

    let { id, outline, bounds }: { id: string; outline: string; bounds: Rect } = $props()

    let region = $derived({
        x: bounds.x - GlowReach,
        y: bounds.y - GlowReach,
        width: bounds.width + 2 * GlowReach,
        height: bounds.height + 2 * GlowReach
    })
</script>

<!-- The glow is drawn above the piece it marks, so the piece's own area is masked out to leave
 only the glow round its edge, as when the glow was drawn beneath it. -->
<mask
    {id}
    maskUnits="userSpaceOnUse"
    x={region.x}
    y={region.y}
    width={region.width}
    height={region.height}
>
    <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="#ffffff"
    ></rect>
    <path d={outline} fill="#000000"></path>
</mask>
<path
    d={outline}
    fill="none"
    stroke="#ffffff"
    stroke-width="8"
    stroke-linejoin="round"
    class="candidate-halo"
    mask="url(#{id})"
></path>
