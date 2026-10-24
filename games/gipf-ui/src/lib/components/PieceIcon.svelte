<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import PieceDefs from './PieceDefs.svelte'
    import PieceShape from './PieceShape.svelte'

    let {
        color,
        gipf = false,
        size = 18
    }: { color: Color; gipf?: boolean; size?: number } = $props()

    const id = $props.id()
    const radius = $derived(gipf ? 10 : 10.5)
    // Centred on the piece's whole silhouette, from its top face down to the front of its base.
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
    <defs><PieceDefs prefix="gipf-icon-{id}" /></defs>
    <g transform="translate(0 {-middle})">
        <PieceShape {color} {gipf} {radius} prefix="gipf-icon-{id}" />
    </g>
</svg>
