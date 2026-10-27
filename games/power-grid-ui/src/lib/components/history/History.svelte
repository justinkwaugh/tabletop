<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyRounds } from '$lib/utils/historyEntries.js'
    import { PHASES } from '$lib/utils/phases.js'
    import Description from '../Description.svelte'
    import House from '../House.svelte'

    const session = getGameSession()
    const rounds = $derived(
        historyRounds(session.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0)))
            .map((round) => ({
                ...round,
                phases: round.phases
                    .map((phase) => ({ ...phase, entries: phase.entries.toReversed() }))
                    .toReversed()
            }))
            .toReversed()
    )

    async function jump(index: number) {
        if (index > 0) {
            await session.history.goToActionIndex(index - 1)
        }
    }
</script>

<div class="history">
    {#each rounds as round (round.round)}
        <button
            type="button"
            class="round"
            onclick={() => jump(round.firstIndex)}
            title="See the table as round {round.round} began"
        >
            Round {round.round}
        </button>
        {#each round.phases as phase, phaseIndex (phaseIndex)}
            <div class="phase">
                {phase.phase === 1 ? 'Placing the Trust' : PHASES[phase.phase - 1]}
            </div>
            {#each phase.entries as entry (entry.key)}
                <div
                    class="entry"
                    class:system={!entry.playerId}
                    class:step={entry.kind === 'step'}
                >
                    {#if entry.playerId}
                        <svg
                            class="marker"
                            width="18"
                            height="18"
                            viewBox="-9 -9 18 18"
                            aria-hidden="true"
                        >
                            <House
                                x={0}
                                y={0}
                                color={session.colors.getPlayerUiColor(entry.playerId)}
                                size={1.15}
                            />
                        </svg>
                    {/if}
                    <div class="lines">
                        {#each entry.lines as line, index (index)}
                            <p class:detail={index > 0 && entry.kind === 'auction'}>
                                <Description {line} />
                            </p>
                        {/each}
                    </div>
                </div>
            {/each}
        {/each}
    {:else}
        <p class="empty">Nothing has happened yet.</p>
    {/each}
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-top: 6px;
        font-size: 15px;
    }
    .round {
        text-align: left;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 20px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        background: #56643f;
        color: #ecebe1;
        border-radius: 6px;
        padding: 2px 10px;
        margin-top: 6px;
    }
    .round:hover {
        background: #65744b;
    }
    .phase {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #aab198;
        margin: 2px 0 0 4px;
    }
    .entry {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        background: #1b201b;
        border-radius: 6px;
        padding: 5px 8px;
    }
    .entry.system {
        background: transparent;
        border: 1px dashed #3b4529;
        color: #cfd4bd;
    }
    .entry.step {
        border: 2px solid #f3c534;
        color: #ecebe1;
    }
    .marker {
        flex: none;
        margin-top: 2px;
    }
    .lines {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .detail {
        font-size: 13px;
        color: #aab198;
    }
    .empty {
        color: #8d987a;
    }
</style>
