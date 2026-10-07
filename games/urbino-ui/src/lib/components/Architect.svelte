<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { ARCHITECT_HEIGHT, SQUARE_SIZE, shadowOffset } from '$lib/board/geometry.js'

    let { center, selected, selectable }: { center: Point; selected: boolean; selectable: boolean } = $props()

    const shadow = shadowOffset(ARCHITECT_HEIGHT / 2)
    const bodyRadius = 0.36 * SQUARE_SIZE
    const headRadius = 0.17 * SQUARE_SIZE
    const ringRadius = 0.45 * SQUARE_SIZE
</script>

<g transform="translate({center.x} {center.y})">
    <ellipse
        cx={shadow.x}
        cy={shadow.y}
        rx={bodyRadius * 1.45}
        ry={bodyRadius * 0.6}
        transform="rotate(37 {shadow.x} {shadow.y})"
        fill="#3b2410"
        opacity="0.3"
        filter="url(#urbino-soft-shadow)"
    />
    {#if selected}
        <circle r={ringRadius} fill="none" stroke="#f2c14e" stroke-width="3.5" filter="url(#urbino-glow)" />
    {:else if selectable}
        <circle r={ringRadius} fill="none" stroke="#b8860b" stroke-width="2" stroke-dasharray="4 4" />
    {/if}
    <circle r={bodyRadius} fill="url(#urbino-pawn-body)" stroke="#6e0d0d" />
    <circle r={headRadius} fill="url(#urbino-pawn-head)" />
</g>
