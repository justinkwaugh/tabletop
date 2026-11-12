<script lang="ts">
    import { isDealHand } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/actionDescription.js'

    const gameSession = getGameSession()
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }

    // Newest first, with a divider at each new deal.
    const entries = $derived(
        gameSession.actions
            .map((action) => ({
                id: action.id,
                deal: isDealHand(action) ? action.metadata?.deal : undefined,
                color: action.playerId
                    ? gameSession.colors.getPlayerBgColorValue(action.playerId)
                    : 'transparent',
                text: describeAction(action, names, gameSession.cardStyle)
            }))
            .filter((entry) => entry.text !== undefined)
            .reverse()
    )
</script>

<ol class="history">
    {#each entries as entry (entry.id)}
        {#if entry.deal !== undefined}
            <li class="deal">Hand {entry.deal}</li>
        {/if}
        <li class="entry" style:--seat={entry.color}>{entry.text}.</li>
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

    .deal {
        margin-top: 6px;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }
</style>
