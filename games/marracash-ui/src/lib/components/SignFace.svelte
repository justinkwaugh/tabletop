<script lang="ts">
    import type { Snippet } from 'svelte'
    import {
        SignBottomOrnament,
        SignCream,
        SignFrame,
        SignTopOrnament
    } from '$lib/utils/shopSign.js'

    let {
        outline,
        fill,
        edge,
        edgeWidth = 1.5,
        frame = SignCream,
        ornaments = [SignTopOrnament, SignBottomOrnament],
        children
    }: {
        outline: string
        fill: string
        edge: string
        edgeWidth?: number
        frame?: string
        ornaments?: readonly string[]
        children: Snippet
    } = $props()
</script>

<path d={outline} {fill} stroke={edge} stroke-width={edgeWidth} stroke-linejoin="round"></path>
<path
    d={outline}
    transform={SignFrame.transform}
    fill="none"
    stroke={frame}
    stroke-width={SignFrame.strokeWidth}
    stroke-linejoin="round"
    opacity="0.9"
></path>
{#each ornaments as ornament (ornament)}
    <path d={ornament} fill={frame} opacity="0.9"></path>
{/each}
{@render children()}
