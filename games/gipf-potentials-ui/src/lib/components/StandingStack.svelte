<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { PIECE_RADIUS, SHADOW_BLUR, type BoardView } from '$lib/board/geometry.js'
    import type { Disc } from '$lib/board/pieceShape.js'
    import type { PieceParts } from '$lib/animators/drop.js'
    import PieceShape from './PieceShape.svelte'

    let {
        discs,
        view,
        bodyId,
        body,
        shadow,
        parts
    }: {
        discs: readonly Disc[]
        view: BoardView
        bodyId?: string
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
        fill="url(#gp-board-shadow)"
    ></ellipse>
    <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * view.tilt} fill="url(#gp-board-contact)"
    ></ellipse>
</g>
<g id={bodyId} {@attach body}>
    <PieceShape {discs} radius={PIECE_RADIUS} {view} {parts} />
</g>
