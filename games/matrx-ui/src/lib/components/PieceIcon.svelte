<script lang="ts">
    import { Color } from '@tabletop/common'
    import { BoardShape, PieceKind } from '@tabletop/matrx'
    import { PIECE_RADIUS, viewOf } from '$lib/board/geometry.js'
    import PieceShape from './PieceShape.svelte'

    let {
        color,
        kind = PieceKind.Gipf,
        discs = 1,
        size = 18
    }: { color: Color; kind?: PieceKind; discs?: number; size?: number } = $props()

    const view = viewOf(BoardShape.Matrx)
    const radius = $derived(discs > 1 ? 10 : 10.5)
    const tone = $derived(color === Color.White ? 'light' : 'dark')
    // Centred on the stack's whole silhouette, from its top face down to the front of its base.
    const scale = $derived(radius / PIECE_RADIUS)
    const middle = $derived(((view.extentBelow - view.extentAbove(discs)) / 2) * scale)
</script>

<svg
    width={size}
    height={size}
    viewBox="-12 -12 24 24"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <g transform="translate(0 {-middle})">
        <PieceShape discs={Array.from({ length: discs }, () => ({ tone, kind }))} {radius} {view} />
    </g>
</svg>
