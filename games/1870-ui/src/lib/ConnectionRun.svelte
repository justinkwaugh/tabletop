<script lang="ts">
    import { CompanyToken, contrastingTextColor, DecisionResponse } from '@tabletop/18xx-ui'
    import type { Session1870 } from './session.svelte.js'
    let { session }: { session: Session1870 } = $props()
    const run = $derived(session.connectionRun)
    const choice = $derived(session.destinationChoice)
</script>

{#if choice}
    <section class="centered-panel" aria-label="Connection run">
        <DecisionResponse
            label="Destination station"
            acceptLabel="Place station"
            declineLabel="Keep on charter"
            disabled={session.busy || !session.canChooseDestination}
            onAccept={() => session.chooseDestinationStation(true)}
            onDecline={() => session.chooseDestinationStation(false)}
        >
            <CompanyToken appearance={session.mapView.stations[choice.companyId]} size={24} />
            <strong>{session.companyName(choice.companyId)}</strong>
            <span>can run to {choice.destination}.</span>
            <span class="question"
                >Place its destination station there, free, doubling the city at the end of a run,
                or keep it as a later $100 station?</span
            >
        </DecisionResponse>
    </section>
{:else if run}
    {@const color = session.mapView.stations[run.companyId].color}
    <header
        class="connection-run"
        style:background-color={color}
        style:color={contrastingTextColor(color)}
    >
        <CompanyToken appearance={session.mapView.stations[run.companyId]} size={26} />
        <strong>Connection run</strong>
        {#if session.gameState.machineState === 'RunningTrains'}
            <span>One train runs from {run.home} to {run.destination} and no further.</span>
        {:else}
            <span>Pay in full or withhold; a half dividend is not allowed.</span>
        {/if}
    </header>
{/if}

<style>
    .question {
        flex-basis: 100%;
    }
    .connection-run {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 4px 0;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        text-align: center;
    }
    .connection-run strong {
        font-size: 15px;
        font-weight: 700;
    }
</style>
