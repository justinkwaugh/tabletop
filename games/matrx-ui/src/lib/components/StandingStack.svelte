<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { PIECE_RADIUS, SHADOW_BLUR, type BoardView } from '$lib/board/geometry.js'
    import type { Disc } from '$lib/board/pieceShape.js'
    import type { PieceParts } from '$lib/animators/drop.js'
    import PieceShape from './PieceShape.svelte'

    // A stack on the board with its shadow under it. The body is the whole stack, which rises off
    // the board; its discs can move on their own.
    let {
        discs,
        view,
        body,
        shadow,
        parts
    }: {
        discs: readonly Disc[]
        view: BoardView
        body?: Attachment<SVGGElement>
        shadow?: Attachment<SVGGElement>
        parts?: PieceParts
    } = $props()
</script>

<g {@attach shadow}>
    <ellipse
        rx={PIECE_RADIUS + SHADOW_BLUR}
        ry={PIECE_RADIUS * view.tilt + SHADOW_BLUR}
        cy={2}
        fill="url(#matrx-board-shadow)"
    ></ellipse>
    <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * view.tilt} fill="url(#matrx-board-contact)"
    ></ellipse>
</g>
<g {@attach body}>
    <PieceShape {discs} radius={PIECE_RADIUS} {view} {parts} />
</g>
