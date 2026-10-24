<svelte:options namespace="svg" />

<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { Attachment } from 'svelte/attachments'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import type { PieceParts } from '$lib/animators/drop.js'
    import PieceShape from './PieceShape.svelte'

    // A piece on the board with its shadow under it. The body is the whole piece, which rises off
    // the board; its parts fall onto it one at a time.
    let {
        color,
        gipf,
        body,
        shadow,
        parts
    }: {
        color: Color
        gipf: boolean
        body?: Attachment<SVGGElement>
        shadow?: Attachment<SVGGElement>
        parts?: PieceParts
    } = $props()
</script>

<g {@attach shadow}>
    <ellipse
        rx={PIECE_RADIUS}
        ry={PIECE_RADIUS * VIEW.tilt}
        cy={2}
        class="shadow"
        filter="url(#gipf-soft)"
    ></ellipse>
</g>
<g {@attach body}>
    <PieceShape {color} {gipf} radius={PIECE_RADIUS} prefix="gipf-board" {parts} />
</g>

<style>
    .shadow {
        fill: rgb(0 0 0 / 0.3);
    }
</style>
