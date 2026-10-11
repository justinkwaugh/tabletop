<script lang="ts">
    import { historyChapters, type HistoryLine } from '$lib/model/historyChapters.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const chapters = $derived(
        historyChapters(gameSession.actions, game.rounds.series, game.scenario, (action) =>
            describeAction(action, game)
        )
    )
</script>

{#snippet line(entry: HistoryLine, time: string, step: boolean)}
    <button
        type="button"
        class="nt-history-entry"
        class:nt-history-step={step}
        onclick={() => gameSession.openHistoryLine(entry, time)}
    >
        <span
            class="nt-history-mark"
            style="background: {entry.playerId
                ? gameSession.colors.getPlayerUiColor(entry.playerId)
                : '#8a857a'};"
        ></span>
        <span>{entry.text}</span>
    </button>
{/snippet}

<div class="nt-history">
    {#each chapters.toReversed() as chapter (chapter.title)}
        <h3>{chapter.title}</h3>
        {#each chapter.entries.toReversed() as entry (entry.index)}
            {@render line(entry, chapter.title, false)}
            {#each entry.steps as step (step.index)}
                {@render line(step, chapter.title, true)}
            {/each}
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

    .nt-history-step {
        margin-left: 12px;
        font-size: 12px;
    }

    .nt-history-entry:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-mark {
        border-radius: 1px;
    }
</style>
