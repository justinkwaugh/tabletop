<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    const choice = $derived(session.stations.homeChoice)
    const company = $derived(
        session.gameState.companies.find((company) => company.id === choice?.companyId)
    )
</script>

{#if choice}
    <section aria-label="Home city choice">
        <p>
            {company?.name ?? choice.companyId}: choose a highlighted city on the map for its home
            station.
        </p>
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    p {
        margin: 8px 0;
    }
</style>
