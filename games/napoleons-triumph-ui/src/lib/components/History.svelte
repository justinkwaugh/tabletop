<script lang="ts">
    import { historyChapters } from '$lib/model/historyChapters.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const chapters = $derived(
        historyChapters(gameSession.actions, game.rounds.series, game.scenario, (action) =>
            describeAction(action, {
                map: game.map,
                sideOf: (playerId) => game.findPlayerState(playerId ?? '')?.side
            })
        )
    )
</script>

<div class="nt-history">
    {#each chapters.toReversed() as chapter (chapter.title)}
        <h3>{chapter.title}</h3>
        {#each chapter.entries.toReversed() as entry (entry.index)}
            <button
                type="button"
                class="nt-history-entry"
                onclick={() => gameSession.history.goToActionIndex(entry.index)}
            >
                <span
                    class="nt-history-mark"
                    style="background: {entry.playerId
                        ? gameSession.colors.getPlayerUiColor(entry.playerId)
                        : '#8a857a'};"
                ></span>
                <span>{entry.text}</span>
            </button>
        {/each}
    {:else}
        <p>Nothing has happened yet.</p>
    {/each}
</div>

<style>
    .nt-history {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 6px 4px;
        color: #2b2620;
        font-size: 13px;
        line-height: 1.3;
    }

    h3 {
        margin-top: 6px;
        font-size: 14px;
        font-style: italic;
        border-bottom: 1px solid rgba(43, 38, 32, 0.3);
    }

    .nt-history-entry {
        display: grid;
        grid-template-columns: 6px 1fr;
        gap: 6px;
        text-align: left;
        padding: 2px 0;
    }

    .nt-history-entry:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-mark {
        border-radius: 1px;
    }
</style>
