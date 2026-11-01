<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        size,
        width = size,
        pending = false,
        dark = false,
        children
    }: {
        size: number
        width?: number
        pending?: boolean
        dark?: boolean
        children: Snippet
    } = $props()
</script>

<div
    class="tile"
    class:pending
    class:dark
    style:width="{width}px"
    style:height="{size}px"
    style:border-radius="{Math.max(2, size * 0.08)}px"
>
    {@render children()}
</div>

<style>
    .tile {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid #b9b4a6;
        background: #fbfaf5;
        box-shadow:
            inset -1px -1px 0 rgba(0, 0, 0, 0.12),
            1px 2px 3px rgba(20, 30, 0, 0.45);
    }

    .tile.dark {
        border-color: #111;
        background: #161616;
    }

    .tile.pending {
        opacity: 0.6;
        outline: 2px dashed #fff3b0;
        outline-offset: 1px;
    }

    .tile :global(img) {
        display: block;
        max-width: 88%;
        max-height: 88%;
        object-fit: contain;
        pointer-events: none;
    }
</style>
