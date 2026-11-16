<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import PieceShape from './PieceShape.svelte'

    let {
        color,
        gipf = false,
        size = 18
    }: { color: Color; gipf?: boolean; size?: number } = $props()

    const radius = $derived(gipf ? 10 : 10.5)
    const scale = $derived(radius / PIECE_RADIUS)
    const middle = $derived(((VIEW.extentBelow - VIEW.extentAbove(gipf)) / 2) * scale)
</script>

<svg
    width={size}
    height={size}
    viewBox="-12 -12 24 24"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <g transform="translate(0 {-middle})">
        <PieceShape {color} {gipf} {radius} />
    </g>
</svg>
