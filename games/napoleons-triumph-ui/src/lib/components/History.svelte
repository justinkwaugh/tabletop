<script lang="ts">
    import type { HistoryLine } from '$lib/model/historyChapters.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const chapters = $derived(gameSession.chapters)
</script>

{#snippet told(entry: HistoryLine)}
    <span
        class="nt-history-mark"
        style="background: {entry.playerId
            ? gameSession.colors.getPlayerUiColor(entry.playerId)
            : '#8a857a'};"
    ></span>
    <span>{entry.text}</span>
{/snippet}

{#snippet line(entry: HistoryLine, time: string, step: boolean)}
    {#if entry.pictured}
        <button
            type="button"
            class="nt-history-entry nt-history-pictured"
            class:nt-history-step={step}
            onclick={() => gameSession.openHistoryLine(entry, time)}
        >
            {@render told(entry)}
        </button>
    {:else}
        <div class="nt-history-entry" class:nt-history-step={step}>{@render told(entry)}</div>
    {/if}
{/snippet}

<div class="nt-history">
    {#each chapters.toReversed() as chapter (chapter.title)}
        <h3>{chapter.title}</h3>
        {#each chapter.turns.toReversed() as turn (`${turn.playerId}@${turn.start}`)}
            {#if turn.title}
                <h4>{turn.title}</h4>
            {/if}
            {#each turn.entries.toReversed() as entry (entry.index)}
                {@render line(entry, chapter.title, false)}
                {#each entry.steps as step (step.index)}
                    {@render line(step, chapter.title, true)}
                {/each}
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

    h4 {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 600;
        color: rgba(43, 38, 32, 0.7);
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

    .nt-history-pictured:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-mark {
        border-radius: 1px;
    }
</style>
