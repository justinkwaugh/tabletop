<svelte:options namespace="svg" />

<script lang="ts">
    // Shared by every piece drawn on the board: the shadow right under it. The pieces themselves
    // are pre-rendered images (board/looks.ts).
    let { prefix }: { prefix: string } = $props()
</script>

<!-- Right under a piece, the board in its shadow, seen through the gap below it. -->
<radialGradient id="{prefix}-contact">
    <stop offset="0" stop-color="rgb(0 0 0 / 0.55)"></stop>
    <stop offset="0.85" stop-color="rgb(0 0 0 / 0.45)"></stop>
    <stop offset="1" stop-color="rgb(0 0 0 / 0)"></stop>
</radialGradient>
