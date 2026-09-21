<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, showUndo = true }: { showUndo?: boolean; session: EighteenXXSession } =
        $props()
    const step = $derived(session.financialState.stationStep)
    const selection = $derived(session.stationSelection)
</script>

{#if step}
    <section aria-label="Station placement">
        <header>
            <span>Choose a city to place a station or</span>
            <button class="action-button inline-action" onclick={() => session.finishStations()}
                disabled={!session.canPlaceStation || !!selection.placement}>skip</button>
            {#if showUndo}<button onclick={() => session.undo()}
                disabled={session.busy || session.isViewingHistory ||
                    (!selection.placement && !session.actions.length)}>Undo</button>{/if}
        </header>
        {#if step.completed}<p>Station placement complete.</p>
        {:else if !session.isViewingHistory && !selection.stationId}
            {#if session.requiresStationTokenChoice}
                <div class="choices">
                    {#each session.availableStations as station, index}
                        <button data-station-id={station.id}
                            onclick={() => session.selectStation(station.id)}
                            disabled={!session.canPlaceStation || !session.stationPlacement.choices(station.id).length}>
                            Station {index + 1}
                        </button>
                    {/each}
                </div>
            {/if}
            {#if session.canPlaceStation && !session.validActionTypes.includes('PlaceStation')}<p>
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
    button:hover:not(:disabled) { background: var(--rail-surface-raised, #efe7db); }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    p {
        margin: 8px 0;
    }
</style>
