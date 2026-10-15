<script lang="ts">
    import { tick } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import {
        finalTurnEntries,
        historyEntries,
        isSetupEntry,
        movesPieces,
        type HistoryEntry
    } from '$lib/utils/historyEntries.js'
    import { describeActions } from '$lib/utils/actionDescription.js'
    import { boardName } from '$lib/utils/reefSquare.js'
    import PhraseLine from './PhraseLine.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()
    let scrollContainer: HTMLDivElement | undefined = $state()

    // Replay steps the session through history, which would rewrite the list mid-replay.
    type Replay = { entryId: string; frozenActions: GameAction[]; frozenScrollTop: number }
    let replay = $state<Replay | undefined>()

    const entries = $derived(
        historyEntries(replay?.frozenActions ?? gameSession.actions).toReversed()
    )
    const finalTurns = $derived(finalTurnEntries(entries.toReversed()))

    async function jumpTo(entry: HistoryEntry) {
        const index = entry.actions.at(-1)?.index
        if (index === undefined || replay) {
            return
        }
        await gameSession.history.goToActionIndex(index)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }

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
    {#each entries as entry, index (entry.actions[0].id)}
        {#if isSetupEntry(entry) && (index === 0 || !isSetupEntry(entries[index - 1]))}
            <h4 class="divider reef-display">Setup</h4>
        {/if}
        {#if finalTurns.has(entry) && (index === 0 || !finalTurns.has(entries[index - 1]))}
            <h4 class="divider reef-display">Final turns</h4>
        {/if}
        {@const lastAt = entry.actions.at(-1)?.createdAt}
        {@const replaying = replay?.entryId === entry.actions[0].id}
        <article class="entry reef-glass" class:replaying class:dimmed={replay && !replaying}>
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
                            class="replay reef-display"
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
                {#each describeActions( entry.actions, entry.playerId === gameSession.myPlayer?.id ? 'your' : 'their', gameSession.possessiveName, (boardId) => boardName(gameSession.gameState.reefs, boardId) ) as phrase, index (index)}
                    <li><PhraseLine {phrase} capitalise /></li>
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
        padding: 2px 2px 8px;
        align-content: start;
    }

    .divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 6px 2px 0;
        font-size: 15px;
        color: var(--reef-ink);
        text-shadow: 0 1px 3px rgb(4 30 26 / 0.5);
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.6));
    }

    .divider::after {
        background: linear-gradient(90deg, rgb(255 255 255 / 0.6), transparent);
    }

    .entry {
        position: relative;
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
        border-radius: 8px;
    }

    .jumps:hover,
    .jumps:focus-visible {
        background: rgb(255 255 255 / 0.14);
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
        border-radius: 999px;
        padding: 1px 10px;
        font-size: 12px;
        color: var(--reef-paper-ink);
        background: linear-gradient(180deg, #fff, rgb(255 255 255 / 0) 70%), var(--reef-pearl);
        box-shadow: 0 1px 3px rgb(4 30 26 / 0.35);
    }

    .replay:hover:not(:disabled),
    .replay:focus-visible {
        background: #fff;
        outline: none;
    }

    .replay:disabled {
        opacity: 0.5;
    }

    .replaying {
        font-size: 12px;
        color: var(--reef-sun);
    }

    .entry.replaying {
        box-shadow:
            inset 0 0 0 2px var(--reef-sun),
            0 0 16px rgb(255 217 138 / 0.4);
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
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 14px;
        line-height: 1.45;
    }

    .empty {
        color: var(--reef-muted);
        font-size: 14px;
    }
</style>
