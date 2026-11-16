<svelte:options namespace="svg" />

<script lang="ts">
    import { VIEW } from '$lib/board/geometry.js'
    import { speckClips } from '$lib/board/specks.js'

    // Shared by every piece drawn in one SVG at one radius: the shadow under it, and the clips
    // that keep its specks on it. The pieces themselves are pre-rendered images
    // (board/looks.ts).
    let { prefix, radius }: { prefix: string; radius: number } = $props()

    const clips = $derived(speckClips(VIEW, radius))
</script>

<!-- Right under the disc, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<radialGradient id="{prefix}-shadow">
    <stop offset="0.55" stop-color="rgb(0 0 0 / 0.32)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
<!-- Each disc's specks, kept on it: in its own coordinates, from its base. -->
<clipPath id="{prefix}-top-clip">
    <path d={clips.top}></path>
</clipPath>
<clipPath id="{prefix}-side-clip">
    <path d={clips.side} clip-rule="evenodd"></path>
</clipPath>
