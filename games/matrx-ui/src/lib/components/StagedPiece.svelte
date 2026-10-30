<svelte:options namespace="svg" />

<script lang="ts">
    import { onDestroy, untrack } from 'svelte'
    import { PIECE_RADIUS, SHADOW_BLUR, type BoardView } from '$lib/board/geometry.js'
    import type { Disc } from '$lib/board/pieceShape.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import PieceShape from './PieceShape.svelte'

    // The stack you are about to bring in, dropping onto the dot you chose unless Undo took it
    // back out there. Taken back, it lifts off again, unless it is going in (lifts says which).
    let {
        discs,
        view,
        drops,
        lifts
    }: { discs: readonly Disc[]; view: BoardView; drops: boolean; lifts: () => boolean } = $props()

    // Whether it drops is settled when it is first drawn.
    const drop = new StagedDrop(untrack(() => drops))
    onDestroy(() => drop.stop())
</script>

<g out:liftOffShadow|global={{ lifts }}>
    <g {@attach drop.shadow}>
        <ellipse
            rx={PIECE_RADIUS + SHADOW_BLUR}
            ry={PIECE_RADIUS * view.tilt + SHADOW_BLUR}
            cy={2}
            fill="url(#matrx-board-shadow)"
        ></ellipse>
        <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * view.tilt} fill="url(#matrx-board-contact)"
        ></ellipse>
    </g>
</g>
<g out:liftOffBody|global={{ lifts }}>
    <PieceShape {discs} radius={PIECE_RADIUS} {view} parts={drop.parts} />
</g>
