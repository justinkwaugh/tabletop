<script lang="ts">
    import type { Snippet } from 'svelte'

    let { children }: { children: Snippet } = $props()
</script>

<div class="tile">
    {@render children()}
</div>

<style>
    .tile {
        border-radius: 8px;
        overflow: hidden;
        transform: rotate(-4deg);
        box-shadow:
            0 0 0 1.5px #e9d9b0,
            0 6px 12px rgba(0, 0, 0, 0.45);
    }
</style>
