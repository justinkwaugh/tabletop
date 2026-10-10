<script lang="ts">
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { historyEntries } from '$lib/utils/historyEntries.js'
    import { capitalised, describeActions } from '$lib/utils/actionDescription.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()
    const entries = $derived(historyEntries(gameSession.actions).toReversed())
</script>

<div class="history">
    {#each entries as entry (entry.actions[0].id)}
        {@const lastAt = entry.actions.at(-1)?.createdAt}
        <article class="entry">
            <header>
                {#if entry.playerId}
                    <PlayerName playerId={entry.playerId} />
                {:else}
                    <span class="reef-display">End of the game</span>
                {/if}
                {#if lastAt}<time class="when">{timeAgo.format(lastAt)}</time>{/if}
            </header>
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
