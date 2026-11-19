<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const myColor = $derived(session.myPlayer ? session.colorOf(session.myPlayer.id) : undefined)
</script>

<!-- One row: the last move while you wait, the prompt on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !session.canPlace}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else if session.canSwap}
        <span
            >Place a stone or <button
                type="button"
                class="inline"
                onclick={() => session.swapColors()}>Swap</button
            ></span
        >
    {:else}
        <span>Place a {myColor} stone on any empty point</span>
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
        min-height: 50px;
        padding: 4px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--y-ink);
    }

    .inline {
        padding: 0 8px;
        margin-left: 2px;
        border-radius: 8px;
        font-size: inherit;
        font-weight: 600;
        color: var(--y-ink);
        background: var(--y-panel-inset);
        box-shadow:
            inset 0 0 0 1.5px var(--y-toggle-on),
            0 1px 2px rgb(60 40 20 / 0.25);
    }

    @media (hover: hover) {
        .inline:hover {
            background: var(--y-panel-hover);
        }
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
            padding: 4px 8px;
        }
    }
</style>
