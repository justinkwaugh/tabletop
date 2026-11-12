<svelte:options namespace="svg" />

<script lang="ts">
    import { PIECE_RADIUS, SHADOW_BLUR } from '$lib/board/geometry.js'

    let { prefix }: { prefix: string } = $props()

    const SHADOW_SOLID = (PIECE_RADIUS - SHADOW_BLUR) / (PIECE_RADIUS + SHADOW_BLUR)
</script>

<!-- A gradient rather than a blur, which is slow to paint on phones. -->
<radialGradient id="{prefix}-shadow">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.3)"></stop>
    <stop offset={SHADOW_SOLID} stop-color="rgb(0 0 0 / 0.27)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
