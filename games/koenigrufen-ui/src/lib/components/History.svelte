<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/utils/history.js'

    const gameSession = getGameSession()
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }

    const entries = $derived(historyEntries(gameSession.actions, names, gameSession.cardStyle))

    function seatColor(playerId: string | undefined): string {
        return playerId ? gameSession.colors.getPlayerBgColorValue(playerId) : 'transparent'
    }
</script>

<ol class="history">
    {#each entries as entry (entry.key)}
        {#if entry.kind === 'call'}
            <li class="entry called"><CalledGameDescription action={entry.action} /></li>
        {:else}
            {#if entry.deal !== undefined}
                <li class="deal">Hand {entry.deal}</li>
            {/if}
            <li class="entry" style:--seat={seatColor(entry.playerId)}>{entry.text}.</li>
        {/if}
    {/each}
    {#if gameSession.hasCompleteHistory}
        <li class="deal">Hand 1</li>
    {:else}
        <li class="deal loading">Reading earlier history…</li>
    {/if}
</ol>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 4px 8px;
        font-size: 0.85rem;
    }

    .entry {
        padding-left: 8px;
        border-left: 3px solid var(--seat);
    }

    .called {
        --seat: transparent;
        font-weight: 600;
        color: #f2c94c;
    }

    .deal {
        margin-top: 6px;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }
</style>
