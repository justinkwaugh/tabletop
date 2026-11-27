<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { PIECE_RADIUS, type BoardView } from '$lib/board/geometry.js'
    import type { Disc } from '$lib/board/pieceShape.js'
    import type { PieceParts } from '$lib/animators/drop.js'
    import BoardShadow from './BoardShadow.svelte'
    import PieceShape from './PieceShape.svelte'

    let {
        discs,
        view,
        bodyId,
        body,
        shadow,
        parts,
        badge
    }: {
        discs: readonly Disc[]
        view: BoardView
        bodyId?: string
        body?: Attachment<SVGGElement>
        shadow?: Attachment<SVGGElement>
        parts?: PieceParts
        badge?: string
    } = $props()
</script>

<g {@attach shadow}>
    <BoardShadow {view} bottom={discs[0]} />
</g>
<g id={bodyId} {@attach body}>
    <PieceShape {discs} radius={PIECE_RADIUS} {view} {parts} {badge} />
</g>
