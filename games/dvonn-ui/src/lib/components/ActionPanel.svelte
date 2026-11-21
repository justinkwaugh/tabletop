<script lang="ts">
    import { Color } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import { holdTallest } from './holdTallest.js'
    import GameEndPanel from './GameEndPanel.svelte'

    const session = getGameSession()

    const CHOICES = [Color.White, Color.Black] as const

    // The ending takes the panel's place, so the height it holds keeps the board still.
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)

    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    // Rule E8: a player without a move passes, and the other moves again.
    const passedPlayerId = $derived(
        lastEntry?.kind === 'call' ? undefined : lastEntry?.passedPlayerId
    )
    const opponentPassed = $derived(
        passedPlayerId !== undefined && passedPlayerId !== session.myPlayer?.id
    )

    const prompt = $derived.by(() => {
        if (session.placingColor) {
            return `Place a ${session.placingColor.toLowerCase()} piece on any empty space`
        }
        if (session.canPlace) {
            return session.placingDvonn
                ? 'Place a DVONN piece on any space'
                : 'Place a piece on any empty space'
        }
        if (session.canChooseColor) return 'Take a colour; White moves first:'
        if (session.chosenFrom) return 'Choose where the stack lands'
        if (session.canMove && opponentPassed && passedPlayerId) {
            return `${session.getPlayerName(passedPlayerId)} cannot move; move again`
        }
        if (session.canMove) return 'Choose a piece or stack to move'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt on your turn. -->
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
        {#if session.canChooseColor}
            {#each CHOICES as color (color)}
                <button type="button" class="choice" onclick={() => session.chooseColor(color)}
                    >{color === Color.White ? 'White' : 'Black'}</button
                >
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
        color: var(--dvonn-ink);
    }

    .choice {
        border-radius: 8px;
        padding: 2px 14px;
        background: var(--dvonn-ink);
        color: var(--dvonn-panel);
        font-weight: 600;
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }
</style>
