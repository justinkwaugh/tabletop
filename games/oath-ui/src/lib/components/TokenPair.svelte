<script lang="ts">
    import TokenBadge from '$lib/components/TokenBadge.svelte'

    // R-7.1.2 — the favor and secrets on a card, each drawn only when there is some.
    let { favor, secrets, size }: { favor: number; secrets: number; size: number } = $props()
</script>

{#if favor > 0}
    <TokenBadge kind="favor" count={favor} {size} />
{/if}
{#if secrets > 0}
    <TokenBadge kind="secret" count={secrets} {size} />
{/if}
