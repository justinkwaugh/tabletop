<script lang="ts">
    import MergerChoice from './MergerChoice.svelte'
    import type { Session1862 } from './session.svelte.js'
    let { session }: { session: Session1862 } = $props()
    const mode = $derived(session.operatingMode.titleModeShown)
    const companyId = $derived(session.gameState.trackStep?.companyId)
</script>

{#if mode === 'small-station'}
    <section class="mode title-panel" aria-label="Small station">
        <p>
            In place of track, place a small station on any line of plain track that has none,
            anywhere on the board. Choose a highlighted hex{session.smallStationLocation
                ? ', then the line beside it'
                : ''}.
        </p>
    </section>
{:else if mode === 'london'}
    <section class="mode title-panel" aria-label="London link">
        <p>
            In place of track and this turn’s station, place a station in one of London’s four
            spaces; the company’s trains may then run into London.
        </p>
        <button class="action-button" onclick={() => session.buildToLondon()}
            >Build to London</button
        >
    </section>
{:else if mode === 'merge' && companyId}
    <MergerChoice
        {session}
        {companyId}
        label="Merge"
        text="Merge with a company joined to this one by track. Shares merge two for one; the other director must agree."
    />
{/if}

<style>
    .mode {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }
    p {
        margin: 0;
        max-width: 34em;
        text-align: center;
    }
</style>
