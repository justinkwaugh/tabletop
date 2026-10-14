<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        children,
        minHeight = 0,
        centerContent = false
    }: { children: Snippet; minHeight?: number; centerContent?: boolean } = $props()
</script>

<div class={centerContent ? 'flex flex-col justify-center' : ''} style:min-height="{minHeight}px">
    {@render children()}
</div>
