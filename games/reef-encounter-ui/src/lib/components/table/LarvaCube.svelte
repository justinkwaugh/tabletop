<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { CoralColor } from '@tabletop/reef-encounter'
    import { CoralPaint } from '$lib/utils/artGeometry.js'

    let { center, size, color }: { center: Point; size: number; color: CoralColor } = $props()

    const paint = $derived(CoralPaint[color])
    const h = $derived(size / 2)
    const q = $derived(size / 4)
</script>

<g
    transform="translate({center.x} {center.y})"
    stroke="#1f2f2b"
    stroke-width="1.5"
    stroke-linejoin="round"
>
    <path d="M0 {-h} L{h} {-q} L0 0 L{-h} {-q} Z" fill={paint}></path>
    <path d="M{-h} {-q} L0 0 L0 {h} L{-h} {q} Z" style:fill="color-mix(in srgb, {paint} 82%, black)"
    ></path>
    <path d="M{h} {-q} L0 0 L0 {h} L{h} {q} Z" style:fill="color-mix(in srgb, {paint} 64%, black)"
    ></path>
</g>
