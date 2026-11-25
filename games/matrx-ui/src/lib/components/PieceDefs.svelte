<svelte:options namespace="svg" />

<script lang="ts">
    import { PIECE_RADIUS, SHADOW_BLUR } from '$lib/board/geometry.js'
    import { CONTACT_SHADE, SHADOW_SHADE } from '$lib/board/pieceShape.js'

    let { prefix }: { prefix: string } = $props()

    const SHADOW_SOLID = (PIECE_RADIUS - SHADOW_BLUR) / (PIECE_RADIUS + SHADOW_BLUR)
</script>

<!-- A gradient rather than a blur, which is slow to paint on phones. -->
<radialGradient id="{prefix}-shadow">
    <stop offset="0" stop-color="rgb(0 0 0 / {SHADOW_SHADE})"></stop>
    <stop offset={SHADOW_SOLID} stop-color="rgb(0 0 0 / {SHADOW_SHADE - 0.03})"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / {CONTACT_SHADE})"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / {CONTACT_SHADE - 0.1})"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
