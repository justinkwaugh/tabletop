<script lang="ts">
    import { translateFromCenter } from '$lib/utils/boardGeometry.js'
    import { type Point } from '@tabletop/common'
    import type { Snippet } from 'svelte'

    let {
        width,
        height,
        location = { x: 0, y: 0 },
        children
    }: {
        width: number
        height: number
        location?: Point
        children?: Snippet
    } = $props()
</script>

<g transform={translateFromCenter(location.x - width / 2, location.y - height / 2)}>
    {#if children}
        {@render children()}
    {/if}
</g>
