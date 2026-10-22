<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        showUndo = true,
        onSkip = () => session.stations.finish(),
        canSkip
    }: {
        showUndo?: boolean
        onSkip?: () => Promise<void>
        canSkip?: boolean
        session: EighteenXXSessionView
    } = $props()
    const step = $derived(session.gameState.stationStep)
    const selection = $derived(session.stations.selection)
    const titlePlacements = $derived([
        ...session.privateActions.titlePowers.flatMap((power) =>
            power.kind === 'location' && power.stationStepLabel
                ? [
                      {
                          id: power.privateCompanyId,
                          label: power.stationStepLabel,
                          run: () => session.privateActions.startTitlePower(power)
                      }
                  ]
                : []
        ),
        ...session.titleStationActions
    ])
</script>

{#if step}
    <section aria-label="Station placement">
        <header>
            <span>Choose a city to place a station or</span>
            <button
                class="action-button inline-action"
                onclick={onSkip}
                disabled={!(canSkip ?? session.stations.canPlace) || !!selection.placement}
                >skip</button
            >
            {#if showUndo}<button
                    onclick={() => session.undo()}
                    disabled={session.busy ||
                        session.isViewingHistory ||
                        (!selection.placement && !session.actions.length)}>Undo</button
                >{/if}
        </header>
        {#if step.completed}<p>Station placement complete.</p>
        {:else if !session.isViewingHistory}
            {#if session.stations.requiresTokenChoice && !selection.stationId}
                <div class="choices">
                    {#each session.stations.available as station, index (station.id)}
                        <button
                            data-station-id={station.id}
                            onclick={() => session.stations.select(station.id)}
                            disabled={!session.stations.canPlace ||
                                !session.stations.model.choices(station.id).length}
                        >
                            Station {index + 1}
                        </button>
                    {/each}
                </div>
            {/if}
            <!-- Offered whether or not a station token is chosen, as the station is placed on the map. -->
            {#if titlePlacements.length}
                {#if !selection.placement}
                    <div class="choices">
                        {#each titlePlacements as { id, label, run } (id)}
                            <button disabled={!session.stations.canPlace} onclick={() => void run()}
                                >{label}</button
                            >
                        {/each}
                    </div>
                {/if}
            {:else if session.stations.canPlace && !session.validActionTypes.includes('PlaceStation')}<p
                >
                    No legal station placement is available.
                </p>{/if}
        {/if}
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    p {
        text-align: center;
    }
    header,
    .choices {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: center;
    }
    button {
        font: inherit;
        padding: 7px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fffdf8);
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    p {
        margin: 8px 0;
    }
</style>
