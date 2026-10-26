<svelte:options namespace="svg" />

<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { onDestroy, untrack } from 'svelte'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import { discsOf } from '$lib/board/pieceShape.js'
    import PieceShape from './PieceShape.svelte'

    // The piece you are about to bring in, dropping onto the dot you chose unless Undo took it
    // back out there. Taken back, it lifts off again, unless it is going in (lifts says which).
    // Made a GIPF-piece, its second disc drops onto it; made single again, that disc lifts off.
    let {
        color,
        gipf,
        drops,
        lifts
    }: { color: Color; gipf: boolean; drops: boolean; lifts: () => boolean } = $props()

    // Whether it drops is settled when it is first drawn; a disc added later drops onto it.
    const drop = new StagedDrop(
        untrack(() => drops),
        untrack(() => discsOf(gipf))
    )
    onDestroy(() => drop.stop())
</script>

<g out:liftOffShadow|global={{ lifts }}>
    <g {@attach drop.shadow}>
        <ellipse
            rx={PIECE_RADIUS}
            ry={PIECE_RADIUS * VIEW.tilt}
            cy={2}
            class="shadow"
            filter="url(#gipf-soft)"
        ></ellipse>
        <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * VIEW.tilt} fill="url(#gipf-board-contact)"
        ></ellipse>
    </g>
</g>
<g out:liftOffBody|global={{ lifts }}>
    <PieceShape {color} {gipf} radius={PIECE_RADIUS} prefix="gipf-board" parts={drop.parts} />
</g>

<style>
    .shadow {
        fill: rgb(0 0 0 / 0.3);
    }
</style>
