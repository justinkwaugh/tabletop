<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { CoralColor } from '@tabletop/reef-encounter'
    import { CoralPaint } from '$lib/utils/artGeometry.js'

    let { center, size, color }: { center: Point; size: number; color: CoralColor } = $props()

    const paint = $derived(CoralPaint[color])
    const h = $derived(size / 2)
    const q = $derived(size / 4)
    const left = $derived(`color-mix(in srgb, ${paint} 82%, black)`)
    const right = $derived(`color-mix(in srgb, ${paint} 64%, black)`)
</script>

<!-- No outline: the three shaded faces shape the cube. Each face is stroked in its own colour so
     no seam shows between them. -->
<g transform="translate({center.x} {center.y})" stroke-width="0.6" stroke-linejoin="round">
    <path d="M0 {-h} L{h} {-q} L0 0 L{-h} {-q} Z" fill={paint} stroke={paint}></path>
    <path d="M{-h} {-q} L0 0 L0 {h} L{-h} {q} Z" style:fill={left} style:stroke={left}></path>
    <path d="M{h} {-q} L0 0 L0 {h} L{h} {q} Z" style:fill={right} style:stroke={right}></path>
</g>
