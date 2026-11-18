<script lang="ts">
    import { TrainRunTable } from '@tabletop/18xx-ui'
    import { trainsOwnedBy } from '@tabletop/18xx'
    import { CobourgRailwayId } from '@tabletop/1828'
    import type { Session1828 } from './session.svelte.js'
    let { session }: { session: Session1828 } = $props()
    const money = $derived(session.presentation.money)
    const choices = $derived(session.cobourgRunChoices)
    const trains = $derived(
        trainsOwnedBy(session.gameState, { kind: 'company', companyId: CobourgRailwayId })
    )
    const places = (stops: readonly { locationId: string }[]) =>
        stops.map((stop) => session.placeName(stop.locationId)).join(' – ')
</script>

<section class="runs" aria-label="C&P run">
    {#if choices.length}
        <div class="choices">
            {#each choices as { run, half, result }, index (run.revenue)}
                <div class="choice" role="group" aria-label={places(run.stops)}>
                    <p class="stops">{places(run.stops)}</p>
                    <TrainRunTable
                        {money}
                        {result}
                        {trains}
                        colorOffset={index}
                        label="C&P run income"
                        trainColors={session.presentation.trainColors}
                        trainName={(id) => session.trainDepot.trainDefinition(id).name}
                    />
                    <p class="split">
                        You {money(half)} · Treasury {money(half)}
                    </p>
                    <button
                        class="action-button run"
                        disabled={session.actionsLocked}
                        onclick={() => session.chooseCobourgRun(run)}
                        >{choices.length > 1 ? 'Run this route' : 'Run train'}</button
                    >
                </div>
            {/each}
        </div>
    {:else}
        <p class="waiting">The C&P’s owner chooses its run through its tile.</p>
    {/if}
</section>

<style>
    .runs {
        padding: 10px 12px;
        color: var(--rail-text, #463e35);
        font-size: 12px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        justify-content: center;
        gap: 12px 24px;
    }
    .choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 150px;
    }
    p {
        margin: 0;
        text-align: center;
    }
    .stops {
        font-weight: 600;
    }
    .split,
    .waiting {
        color: var(--rail-muted, #817565);
    }
    .run {
        margin-top: auto;
        padding: 7px 14px;
        border: 1px solid;
        border-radius: 5px;
        font: inherit;
    }
    .run:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
