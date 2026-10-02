<script lang="ts">
    import TokenBadge from '$lib/components/TokenBadge.svelte'

    let { count, size }: { count: number; size: number } = $props()
</script>

{#if count === 0}
    <span
        class="bank-empty"
        style="width:{size}px; height:{size}px; font-size:{Math.round(size * 0.5)}px;"
        aria-label="empty"
        title="empty">0</span
    >
{:else}
    <TokenBadge kind="favor" {count} {size} />
{/if}

<style>
    .bank-empty {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        line-height: 1;
        color: var(--oath-text);
        text-shadow:
            0 0 3px rgba(0, 0, 0, 0.98),
            0 0 2px rgba(0, 0, 0, 0.98),
            0 1px 1px rgba(0, 0, 0, 0.98);
        pointer-events: none;
    }
</style>
