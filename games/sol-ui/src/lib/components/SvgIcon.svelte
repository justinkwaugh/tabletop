<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        width = 48,
        height = 100,
        children
    }: {
        width?: number
        height?: number
        children: Snippet
    } = $props()
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    width="{width}px"
    height="{height}px"
    viewBox="0 0 {width} {height}"
>
    {@render children()}
</svg>
