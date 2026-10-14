<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const pending = $derived(session.stations.privateStation)
</script>

{#if pending}
    <section aria-label="Private station choice">
        <p>
            {session.companyName(pending.companyId)}: click the highlighted city for
            {session.companyName(pending.privateCompanyId)}’s free station, or
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
