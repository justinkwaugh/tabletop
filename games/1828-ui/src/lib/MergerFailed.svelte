<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { FailedMerger } from './mergers.js'
    import type { Session1828 } from './session.svelte.js'
    let { session, merger }: { session: Session1828; merger: FailedMerger } = $props()
    const [first, second] = $derived(merger.companyIds)
</script>

<section class="merger-failed" role="status" aria-label="Merger failed">
    <h3>Merger failed</h3>
    <p class="companies">
        <CompanyToken appearance={session.mapView.stations[first]} size={20} />
        {session.companyInitials(first)}
        <span>and</span>
        <CompanyToken appearance={session.mapView.stations[second]} size={20} />
        {session.companyInitials(second)}
    </p>
    <p>{merger.failure}</p>
    <p>Counts as {session.getPlayerName(merger.playerId)}’s pass.</p>
</section>

<style>
    .merger-failed {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 6px 12px;
        padding: 8px 12px;
        border: 1px solid var(--rail-negative, #b33a32);
        border-radius: 6px;
        color: var(--rail-text, #514536);
        font-size: 12px;
        text-align: center;
    }
    h3 {
        margin: 0;
        color: var(--rail-negative, #b33a32);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    p {
        margin: 0;
    }
    .companies {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
    }
    .companies span {
        font-weight: 400;
    }
</style>
