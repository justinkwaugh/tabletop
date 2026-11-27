<svelte:options namespace="svg" />

<script lang="ts">
    import { onDestroy, untrack } from 'svelte'
    import { PIECE_RADIUS, type BoardView } from '$lib/board/geometry.js'
    import type { Disc } from '$lib/board/pieceShape.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import BoardShadow from './BoardShadow.svelte'
    import PieceShape from './PieceShape.svelte'

    let {
        discs,
        view,
        drops,
        lifts,
        badge
    }: {
        discs: readonly Disc[]
        view: BoardView
        drops: boolean
        lifts: () => boolean
        badge?: string
    } = $props()

    // Whether it drops is settled when it is first drawn.
    const drop = new StagedDrop(untrack(() => drops))
    onDestroy(() => drop.stop())
</script>

<g out:liftOffShadow|global={{ lifts }}>
    <g {@attach drop.shadow}>
        <BoardShadow {view} bottom={discs[0]} />
    </g>
</g>
<g out:liftOffBody|global={{ lifts }}>
    <PieceShape {discs} radius={PIECE_RADIUS} {view} parts={drop.parts} {badge} />
</g>
