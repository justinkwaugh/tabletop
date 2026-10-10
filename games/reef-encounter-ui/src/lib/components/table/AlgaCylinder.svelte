<script lang="ts">
    import type { Point } from '@tabletop/common'
    import type { AlgaColor } from '@tabletop/reef-encounter'
    import { AlgaPaint } from '$lib/utils/artGeometry.js'

    let { center, size, color }: { center: Point; size: number; color: AlgaColor } = $props()

    const paint = $derived(AlgaPaint[color])
    const rx = $derived(size / 2)
    const ry = $derived(size / 5)
    const height = $derived(size * 0.7)
</script>

<g transform="translate({center.x} {center.y - height / 2})" stroke="#1f2f2b" stroke-width="1.5">
    <path
        d="M{-rx} 0 L{-rx} {height} A{rx} {ry} 0 0 0 {rx} {height} L{rx} 0 Z"
        style:fill="color-mix(in srgb, {paint} 78%, black)"
    ></path>
    <ellipse cx="0" cy="0" {rx} {ry} fill={paint}></ellipse>
</g>
