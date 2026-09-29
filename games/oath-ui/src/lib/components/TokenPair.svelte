<script lang="ts">
    import TokenBadge from '$lib/components/TokenBadge.svelte'

    // R-7.1.2 — the favor and secrets on a card, each drawn only when there is some.
    let {
        favor,
        secrets,
        size,
        on
    }: { favor: number; secrets: number; size: number; on?: string } = $props()

    let where = $derived(on ? ` on ${on}` : '')
</script>

{#if favor > 0}
    <TokenBadge kind="favor" count={favor} {size} title="{favor} favor{where}" />
{/if}
{#if secrets > 0}
    <TokenBadge kind="secret" count={secrets} {size} title="{secrets} secrets{where}" />
{/if}
