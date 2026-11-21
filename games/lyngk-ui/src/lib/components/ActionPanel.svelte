<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import { PIECE_COLORS } from '@tabletop/lyngk'
    import { piecesForColors, PIECE_STYLES } from '$lib/board/pieceStyle.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import PieceIcon from './PieceIcon.svelte'
    import { holdTallest } from './holdTallest.js'
    import GameEndPanel from './GameEndPanel.svelte'

    const session = getGameSession()

    // The ending takes the panel's place, so the height it holds keeps the board still.
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)

    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    const prompt = $derived.by(() => {
        if (session.canPlace) return 'Place'
        if (session.chosenFrom) return 'Choose where it lands'
        if (session.canMove && session.canClaim) return 'Claim a color or move a stack'
        if (session.canMove) return 'Choose a stack to move'
        if (session.canClaim) return 'Claim a color to be able to move'
        return undefined
    })
</script>

<!-- One row: the last move while you wait, the prompt on your turn. -->
<div class="panel" {@attach holdTallest}>
    {#if ended}
        <GameEndPanel />
    {:else if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        <span>{prompt}</span>
        {#if session.canPlace}
            {#each PIECE_COLORS as color (color)}
                {@const left = session.piecesLeft(color)}
                <button
                    type="button"
                    class="color"
                    class:chosen={session.placingColor === color}
                    disabled={left === 0}
                    aria-pressed={session.placingColor === color}
                    aria-label="{PIECE_STYLES[color].name}, {left} left"
                    onclick={() => session.choosePlacingColor(color)}
                >
                    <PieceIcon pieces={piecesForColors([color])} size={26} />
                    <span>{left}</span>
                </button>
            {/each}
        {/if}
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
        color: var(--lyngk-ink);
    }

    .color {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        border-radius: 8px;
        padding: 1px 5px;
        border: 2px solid transparent;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .color.chosen {
        border-color: var(--lyngk-ink);
    }

    .color:disabled {
        opacity: 0.35;
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }
</style>
