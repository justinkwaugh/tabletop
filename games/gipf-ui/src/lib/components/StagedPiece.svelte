<svelte:options namespace="svg" />

<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Color } from '@tabletop/common'
    import { onDestroy, untrack } from 'svelte'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import { liftOffBody, liftOffShadow, StagedDrop } from '$lib/animators/drop.js'
    import { piecesIn } from '@tabletop/gipf'
    import { SHADOW } from '$lib/board/softShadow.js'
    import PieceShape from './PieceShape.svelte'

    let {
        color,
        gipf,
        drops,
        lifts,
        onTop
    }: {
        color: Color
        gipf: boolean
        drops: boolean
        lifts: () => boolean
        onTop?: Snippet<[number]>
    } = $props()

    // Whether it drops is settled when it is first drawn.
    const drop = new StagedDrop(
        untrack(() => drops),
        untrack(() => piecesIn(gipf))
    )
    onDestroy(() => drop.stop())
</script>

<g out:liftOffShadow|global={{ lifts }}>
    <g {@attach drop.shadow}>
        <ellipse rx={SHADOW.rx} ry={SHADOW.ry} cy={SHADOW.cy} fill="url(#gipf-soft-shadow)"
        ></ellipse>
        <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * VIEW.tilt} fill="url(#gipf-board-contact)"
        ></ellipse>
    </g>
</g>
<g out:liftOffBody|global={{ lifts }}>
    <PieceShape {color} {gipf} radius={PIECE_RADIUS} parts={drop.parts} {onTop} />
</g>
