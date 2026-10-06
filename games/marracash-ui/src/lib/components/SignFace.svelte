<script lang="ts">
    import type { Snippet } from 'svelte'
    import { SignCream, SignFrame, SignOrnaments } from '$lib/utils/shopSign.js'

    let {
        outline,
        fill,
        edge,
        edgeWidth = 1.5,
        children
    }: {
        outline: string
        fill: string
        edge: string
        edgeWidth?: number
        children: Snippet
    } = $props()
</script>

<path d={outline} {fill} stroke={edge} stroke-width={edgeWidth} stroke-linejoin="round"></path>
<path
    d={outline}
    transform={SignFrame.transform}
    fill="none"
    stroke={SignCream}
    stroke-width={SignFrame.strokeWidth}
    stroke-linejoin="round"
    opacity="0.9"
></path>
{#each SignOrnaments as ornament (ornament)}
    <path d={ornament} fill={SignCream} opacity="0.9"></path>
{/each}
{@render children()}
