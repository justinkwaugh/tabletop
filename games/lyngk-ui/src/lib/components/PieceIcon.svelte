<script lang="ts">
    import type { PieceColor } from '@tabletop/lyngk'
    import StackShape from './StackShape.svelte'
    import { stackBounds } from '$lib/board/pieceGeometry.js'

    let { stack, size = 18 }: { stack: readonly PieceColor[]; size?: number } = $props()

    const RADIUS = 9
    // Room beyond the stack for its edge stroke, and below it for the shadow it casts.
    const MARGIN = 1
    const SHADOW = 2.5
    const bounds = $derived(stackBounds(stack.length, RADIUS))
    const height = $derived(bounds.bottom - bounds.top + MARGIN + SHADOW)
</script>

<svg
    width={size}
    height={(size * height) / (RADIUS * 2 + 2 * MARGIN)}
    viewBox="{-RADIUS - MARGIN} {bounds.top - MARGIN} {RADIUS * 2 + 2 * MARGIN} {height}"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <StackShape {stack} radius={RADIUS} />
</svg>
