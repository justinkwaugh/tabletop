<script lang="ts">
    import type { PieceKind } from '@tabletop/punct'
    import { VIEW, type BoardView } from '$lib/board/geometry.js'
    import { drawPiece, pathOf, type Tone } from '$lib/board/pieceShape.js'
    import { TOP_LOOK } from '$lib/board/pieceColours.js'

    // A piece's body round its PÜNCT, drawn live: its rounded side as slices, bottom first, each
    // shaded by the gradients in `PieceDefs` under the same prefix, then its flat top.
    let {
        kind,
        angle,
        tone,
        prefix,
        view = VIEW
    }: {
        kind: PieceKind
        angle: number
        tone: Tone
        prefix: string
        view?: BoardView
    } = $props()

    const drawing = $derived(drawPiece(kind, angle, view))
    const top = $derived(TOP_LOOK[tone])
</script>

<g>
    {#each drawing.slices as slice, index (index)}
        <path d={pathOf(slice.points)} fill="url(#{prefix}-{tone}-{slice.shade})" stroke="none"
        ></path>
    {/each}
    <path d={pathOf(drawing.top)} fill={top.fill} stroke={top.stroke} stroke-width={top.strokeWidth}
    ></path>
</g>
