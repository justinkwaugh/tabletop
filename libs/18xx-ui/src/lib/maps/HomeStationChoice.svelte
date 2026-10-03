<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const choice = $derived(session.stations.homeChoice)
</script>

{#if choice}
    <section aria-label="Home city choice">
        <p>
            {getCompany(session.gameState, choice.companyId).name}: choose a highlighted city on the
            map for its home station.
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
