<script lang="ts">
    import { tick } from 'svelte'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { historyEntries, type HistoryEntry } from '$lib/utils/historyEntries.js'
    import { capitalised, describeActions } from '$lib/utils/actionDescription.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()
    const entries = $derived(historyEntries(gameSession.actions).toReversed())

    let scrollContainer: HTMLDivElement | undefined = $state()

    // Shows the table as the entry's player left it.
    async function jumpTo(entry: HistoryEntry) {
        const index = entry.actions.at(-1)?.index
        if (index === undefined) {
            return
        }
        await gameSession.history.goToActionIndex(index)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
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
        <article class="entry">
            {#if entry.playerId}
                <header
                    class="jumps"
                    role="button"
                    tabindex="0"
                    aria-label="Show the table as {gameSession.getPlayerName(
                        entry.playerId
                    )} left it"
                    title="Show the table at this point"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onActivate(event, () => jumpTo(entry))}
                >
                    <PlayerName playerId={entry.playerId} />
                    {#if lastAt}<time class="when">{timeAgo.format(lastAt)}</time>{/if}
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
