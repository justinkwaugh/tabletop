<script lang="ts">
    import { Color } from '@tabletop/common'
    import { PieceKind } from '@tabletop/gipf-potentials'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import type { DiscKind } from '$lib/board/pieceShape.js'
    import PieceShape from './PieceShape.svelte'

    // A piece drawn small, its discs' marks bottom to top.
    let {
        color,
        discs = [PieceKind.Basic],
        size = 18
    }: { color: Color; discs?: readonly DiscKind[]; size?: number } = $props()

    const radius = $derived(discs.length > 1 ? 10 : 10.5)
    const tone = $derived(color === Color.White ? 'light' : 'dark')
    // Centred on the stack's whole silhouette, from its top face down to the front of its base.
    const scale = $derived(radius / PIECE_RADIUS)
    const middle = $derived(((VIEW.extentBelow - VIEW.extentAbove(discs.length)) / 2) * scale)
</script>

<svg
    width={size}
    height={size}
    viewBox="-12 -12 24 24"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <g transform="translate(0 {-middle})">
        <PieceShape discs={discs.map((kind) => ({ tone, kind }))} {radius} view={VIEW} />
    </g>
</svg>
