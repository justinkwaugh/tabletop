<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    const pending = $derived(session.stations.privateStation)
</script>

{#if pending}
    <section aria-label="Private station choice">
        <p>
            {getCompany(session.gameState, pending.companyId).name}: click the highlighted city for
            {getCompany(session.gameState, pending.privateCompanyId).name}’s free station, or
        </p>
        <button class="action-button" onclick={() => session.stations.declinePrivateStation()}
            >Decline</button
        >
    </section>
{/if}

<style>
    section {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    p {
        margin: 8px 0;
    }
</style>
