<svelte:options namespace="svg" />

<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { MARKER_RADIUS } from '$lib/board/pieceGeometry.js'
    import { MARKER_FACE } from '$lib/board/pieceShape.js'
    import { MARKER_BLUE } from '$lib/board/pieceStyle.js'
    import type { Tone } from '$lib/board/pieceStyle.js'
    import type { FlipPart } from '$lib/animators/boardAnimator.svelte.js'
    import MarkerShape from './MarkerShape.svelte'

    // A marker about to turn over: lying `tone` up until it starts, then turning, drawn from its
    // pose each frame, then lying `toTone` up. The animator shows one at a time.
    let {
        tone,
        toTone,
        seedKey,
        prefix,
        part
    }: {
        tone: Tone
        toTone: Tone
        seedKey: string
        prefix: string
        part: (name: FlipPart) => Attachment<SVGElement>
    } = $props()
</script>

<g {@attach part('before')}>
    <MarkerShape {tone} {seedKey} {prefix} />
</g>
<g {@attach part('turning')} visibility="hidden">
    <path
        {@attach part('side')}
        fill={MARKER_BLUE.lip}
        stroke={MARKER_BLUE.edge}
        stroke-width="0.8"
        stroke-linejoin="round"
    ></path>
    <g {@attach part('face')}>
        <circle
            r={MARKER_RADIUS}
            fill={MARKER_BLUE.lip}
            stroke={MARKER_BLUE.edge}
            stroke-width="0.6"
        ></circle>
        <circle
            {@attach part('upper')}
            r={MARKER_RADIUS * MARKER_FACE}
            fill="url(#{prefix}-{tone}-face)"
        ></circle>
        <circle
            {@attach part('lower')}
            r={MARKER_RADIUS * MARKER_FACE}
            fill="url(#{prefix}-{toTone}-face)"
            visibility="hidden"
        ></circle>
    </g>
</g>
<g {@attach part('after')} visibility="hidden">
    <MarkerShape tone={toTone} {seedKey} {prefix} />
</g>
