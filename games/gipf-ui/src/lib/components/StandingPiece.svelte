<svelte:options namespace="svg" />

<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { Attachment } from 'svelte/attachments'
    import { PIECE_RADIUS, VIEW } from '$lib/board/geometry.js'
    import type { PieceParts } from '$lib/animators/drop.js'
    import { SHADOW } from '$lib/board/softShadow.js'
    import PieceShape from './PieceShape.svelte'

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
    <ellipse rx={SHADOW.rx} ry={SHADOW.ry} cy={SHADOW.cy} fill="url(#gipf-soft-shadow)"></ellipse>
    <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * VIEW.tilt} fill="url(#gipf-board-contact)"
    ></ellipse>
</g>
<g {@attach body}>
    <PieceShape {color} {gipf} radius={PIECE_RADIUS} {parts} />
</g>
