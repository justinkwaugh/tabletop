<svelte:options namespace="svg" />

<script lang="ts">
    import {
        MARKER_HEIGHT,
        MARKER_RADIUS,
        RING_INNER,
        RING_OUTER
    } from '$lib/board/pieceGeometry.js'
    import { SHADOW_SOFTNESS } from './PieceShadow.svelte'
    import { SHADE_LEVELS, sideStops, type Material } from '$lib/board/pieceShape.js'
    import { VIEW } from '$lib/board/geometry.js'
    import { markerDrawing, ringDrawing } from '$lib/board/pieceShape.js'

    // Shared by every piece drawn in one SVG: the sides' shades, each tone's top and the hole's
    // far wall, and the clip for the near half of a ring with a marker in it.
    let { prefix }: { prefix: string } = $props()

    const materials: Material[] = ['white', 'black', 'blue']
    const levels = Array.from({ length: SHADE_LEVELS }, (_, level) => level)
    const ring = ringDrawing(VIEW, RING_OUTER)
    const marker = markerDrawing(VIEW, MARKER_RADIUS, MARKER_HEIGHT)
    const nearFrom = ring.nearFrom
    const reach = RING_OUTER * 1.5
    const DISC_SHADOW = MARKER_RADIUS + SHADOW_SOFTNESS
    const RING_SHADOW = RING_OUTER + SHADOW_SOFTNESS
</script>

{#each materials as material (material)}
    {#each levels as level (level)}
        <linearGradient id="{prefix}-{material}-side-{level}" x1="0" y1="0" x2="1" y2="0">
            {#each sideStops(material, level) as stop (stop.offset)}
                <stop offset={stop.offset} stop-color={stop.color}></stop>
            {/each}
        </linearGradient>
    {/each}
{/each}

<!-- Flat tops: one gentle fall-off away from the light. -->
<radialGradient id="{prefix}-white-top" cx="0.4" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#f6f7fa"></stop>
    <stop offset="1" stop-color="#e1e5ed"></stop>
</radialGradient>
<radialGradient id="{prefix}-black-top" cx="0.4" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#2a2b2f"></stop>
    <stop offset="1" stop-color="#111214"></stop>
</radialGradient>
<!-- The far wall of a ring's hole, lit at its rim and in shadow lower down. -->
<linearGradient id="{prefix}-white-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c9ced9"></stop>
    <stop offset="1" stop-color="#9097a6"></stop>
</linearGradient>
<linearGradient id="{prefix}-black-wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a3b40"></stop>
    <stop offset="1" stop-color="#0b0b0c"></stop>
</linearGradient>
<!-- A marker's faces: flat, with only a gentle fall-off away from the light. -->
<radialGradient id="{prefix}-white-face" cx="0.4" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#f7f7f4"></stop>
    <stop offset="1" stop-color="#e6e7e3"></stop>
</radialGradient>
<radialGradient id="{prefix}-black-face" cx="0.4" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#26272a"></stop>
    <stop offset="1" stop-color="#131416"></stop>
</radialGradient>
<radialGradient id="{prefix}-blue-top" cx="0.4" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#3f73da"></stop>
    <stop offset="1" stop-color="#2a56b4"></stop>
</radialGradient>
<clipPath id="{prefix}-ring-wall">
    <path d={ring.farWall} clip-rule="evenodd"></path>
</clipPath>
<clipPath id="{prefix}-marker-wall">
    <path d={marker.innerWall} clip-rule="evenodd"></path>
</clipPath>
<clipPath id="{prefix}-near-half">
    <rect x={-reach} y={nearFrom} width={reach * 2} height={reach}></rect>
</clipPath>
<!-- Soft shadows as gradients rather than a blur filter: WebKit leaves the pixels of a removed
     piece under a filter on screen until something else repaints there. -->
<radialGradient id="{prefix}-shadow-disc">
    <stop
        offset={(MARKER_RADIUS - SHADOW_SOFTNESS) / DISC_SHADOW}
        stop-color="#000"
        stop-opacity="0.35"
    ></stop>
    <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
</radialGradient>
<radialGradient id="{prefix}-shadow-ring">
    <stop offset={(RING_INNER - SHADOW_SOFTNESS) / RING_SHADOW} stop-color="#000" stop-opacity="0"
    ></stop>
    <stop
        offset={(RING_INNER + SHADOW_SOFTNESS) / RING_SHADOW}
        stop-color="#000"
        stop-opacity="0.35"
    ></stop>
    <stop
        offset={(RING_OUTER - SHADOW_SOFTNESS) / RING_SHADOW}
        stop-color="#000"
        stop-opacity="0.35"
    ></stop>
    <stop offset="1" stop-color="#000" stop-opacity="0"></stop>
</radialGradient>
