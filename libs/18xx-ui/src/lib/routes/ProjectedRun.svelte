<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import TrainRunTable from './TrainRunTable.svelte'

    let {
        session,
        onFocusRoute
    }: {
        session: EighteenXXSessionView
        onFocusRoute: (trainId: string) => void
    } = $props()
    const projection = $derived(session.projectedRun.latest)
</script>

{#if projection && session.projectedRun.request}
    <section
        class="projected-run"
        aria-label="Projected run"
        aria-busy={!session.projectedRun.current}
    >
        <h3>Projected run</h3>
        <TrainRunTable
            money={session.presentation.money}
            result={projection.solution.result}
            trains={projection.request.trains}
            trainColors={session.presentation.trainColors}
            {onFocusRoute}
            label="Projected train income"
            trainName={(id) => session.trainDepot.trainDefinition(id).name}
        />
        {#if !projection.solution.exhaustive}<small>Best routes found within the search time.</small
            >{/if}
    </section>
{/if}

<style>
    .projected-run {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 12px 2px;
        color: var(--rail-text, #463e35);
    }
    /* GameTable clears the margins and padding of every section in its action panel. */
    h3 {
        margin: 14px 0 0;
        color: var(--rail-muted, #817565);
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    small {
        color: var(--rail-muted, #817565);
        text-align: center;
    }
</style>
