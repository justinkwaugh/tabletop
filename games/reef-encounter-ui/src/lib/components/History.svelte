<script lang="ts">
    import { tick } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { historyEntries, movesPieces, type HistoryEntry } from '$lib/utils/historyEntries.js'
    import { capitalised, describeActions } from '$lib/utils/actionDescription.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()
    let scrollContainer: HTMLDivElement | undefined = $state()

    // While an entry replays, the session steps through history, so the list holds still on the
    // actions it showed when the replay began.
    type Replay = { entryId: string; frozenActions: GameAction[]; frozenScrollTop: number }
    let replay = $state<Replay | undefined>()

    const entries = $derived(
        historyEntries(replay?.frozenActions ?? gameSession.actions).toReversed()
    )

    // Shows the table as the entry's player left it.
    async function jumpTo(entry: HistoryEntry) {
        const index = entry.actions.at(-1)?.index
        if (index === undefined || replay) {
            return
        }
        await gameSession.history.goToActionIndex(index)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }

    // Plays the entry's actions on the table, then returns to where the viewer was.
    async function replayEntry(entry: HistoryEntry) {
        const start = entry.actions[0]?.index
        const end = entry.actions.at(-1)?.index
        if (start === undefined || end === undefined || replay) {
            return
        }
        const frozenScrollTop = scrollContainer?.scrollTop ?? 0
        replay = {
            entryId: entry.actions[0].id,
            frozenActions: gameSession.actions.slice(),
            frozenScrollTop
        }
        try {
            await gameSession.history.replayRange(start, end)
        } finally {
            replay = undefined
            await tick()
            scrollContainer?.scrollTo({ top: frozenScrollTop, behavior: 'auto' })
        }
    }

    function onActivate(event: KeyboardEvent, activate: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }
        event.preventDefault()
        activate()
    }
</script>

<div class="history" bind:this={scrollContainer}>
    {#each entries as entry (entry.actions[0].id)}
        {@const lastAt = entry.actions.at(-1)?.createdAt}
        {@const replaying = replay?.entryId === entry.actions[0].id}
        <article class="entry" class:replaying class:dimmed={replay && !replaying}>
            {#if entry.playerId}
                {@const name = gameSession.getPlayerName(entry.playerId)}
                <header>
                    <div
                        class="jumps"
                        role="button"
                        tabindex={replay ? -1 : 0}
                        aria-label="Show the table as {name} left it"
                        title="Show the table at this point"
                        onclick={() => jumpTo(entry)}
                        onkeydown={(event) => onActivate(event, () => jumpTo(entry))}
                    >
                        <PlayerName playerId={entry.playerId} />
                        {#if lastAt}<time class="when">{timeAgo.format(lastAt)}</time>{/if}
                    </div>
                    {#if replaying}
                        <span class="replaying">Replaying</span>
                    {:else if movesPieces(entry)}
                        <button
                            class="replay"
                            disabled={replay !== undefined}
                            aria-label="Replay {name}'s moves"
                            title="Replay these moves on the table"
                            onclick={() => replayEntry(entry)}>Replay</button
                        >
                    {/if}
                </header>
            {:else}
                <header>
                    <span class="reef-display">End of the game</span>
                    {#if lastAt}<time class="when">{timeAgo.format(lastAt)}</time>{/if}
                </header>
            {/if}
            <ul>
                {#each describeActions(entry.actions, entry.playerId === gameSession.myPlayer?.id ? 'your' : 'their') as phrase, index (index)}
                    <li>{capitalised(phrase)}</li>
                {/each}
            </ul>
        </article>
    {:else}
        <p class="empty">Nothing has happened yet.</p>
    {/each}
</div>

<style>
    .history {
        display: grid;
        gap: 8px;
        height: 100%;
        overflow-y: auto;
        padding: 2px;
        align-content: start;
    }

    .entry {
        border-radius: 8px;
        background: rgb(0 0 0 / 0.26);
        box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.55);
        padding: 8px 10px;
        text-align: left;
    }

    .jumps {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
        margin: -4px -6px 4px;
        padding: 4px 6px;
        border-radius: 6px;
    }

    .jumps:hover,
    .jumps:focus-visible {
        background: rgb(255 255 255 / 0.16);
        outline: none;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    }

    .replay {
        border-radius: 6px;
        padding: 1px 8px;
        font-size: 12px;
        box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.7);
    }

    .replay:hover:not(:disabled),
    .replay:focus-visible {
        background: rgb(255 255 255 / 0.16);
        outline: none;
    }

    .replay:disabled {
        opacity: 0.5;
    }

    .replaying {
        font-size: 12px;
        color: var(--reef-accent);
    }

    .entry.replaying {
        box-shadow: inset 0 0 0 2px var(--reef-accent);
    }

    .entry.dimmed {
        opacity: 0.55;
    }

    .when {
        font-size: 12px;
        color: var(--reef-muted);
    }

    ul {
        display: grid;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 14px;
    }

    .empty {
        color: var(--reef-muted);
        font-size: 14px;
    }
</style>
