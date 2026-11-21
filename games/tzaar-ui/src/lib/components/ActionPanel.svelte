<script lang="ts">
    import { Color } from '@tabletop/common'
    import { MachineState, PIECE_KINDS } from '@tabletop/tzaar'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import { COLOR_NAMES, KIND_NAMES } from '$lib/history/entryText.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import PieceIcon from './PieceIcon.svelte'
    import { holdTallest } from './holdTallest.js'
    import GameEndPanel from './GameEndPanel.svelte'

    const session = getGameSession()

    const CHOICES = [Color.White, Color.Black] as const

    // The ending takes the panel's place, so the height it holds keeps the board still.
    const ended = $derived(session.gameState.result !== undefined && !session.isViewingHistory)

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const opening = $derived(session.gameState.isOpeningTurn())
    const second = $derived(session.gameState.machineState === MachineState.SecondMove)

    const prompt = $derived.by(() => {
        if (session.placingColor) return `Place ${session.placingColor.toLowerCase()}`
        if (session.canPlace) return 'Place'
        if (session.canChooseColor) return 'Take a colour; White moves first:'
        if (session.canCapture && !second) {
            if (session.chosenFrom) return 'Choose a stack to capture'
            return opening ? 'Opening move: capture' : 'Capture'
        }
        if (second && session.canPass) {
            return session.chosenFrom ? 'Capture, or stack on your own' : 'Capture, stack or'
        }
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
            {@const tone = session.placingTone()}
            {#each PIECE_KINDS as kind (kind)}
                {@const inHand = session.piecesInHand(kind)}
                <button
                    type="button"
                    class="kind"
                    class:chosen={session.placingKind === kind}
                    disabled={inHand === 0}
                    aria-pressed={session.placingKind === kind}
                    aria-label="{KIND_NAMES[kind]}, {inHand} left"
                    onclick={() => session.chooseKind(kind)}
                >
                    <PieceIcon {tone} {kind} size={30} />
                    <span>{inHand}</span>
                </button>
            {/each}
        {/if}
        {#if session.canChooseColor}
            {#each CHOICES as color (color)}
                <button type="button" class="command" onclick={() => session.chooseColor(color)}
                    >{COLOR_NAMES[color]}</button
                >
            {/each}
        {/if}
        {#if session.canPass && !session.chosenFrom}
            <button type="button" class="command" onclick={() => session.pass()}>Pass</button>
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
        color: var(--tzaar-ink);
    }

    .command {
        border-radius: 8px;
        padding: 2px 14px;
        background: var(--tzaar-ink);
        color: var(--tzaar-panel);
        font-weight: 600;
    }

    .kind {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: 8px;
        padding: 1px 6px;
        border: 2px solid transparent;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .kind.chosen {
        border-color: var(--tzaar-ink);
        background: var(--tzaar-panel-inset);
    }

    .kind:disabled {
        opacity: 0.35;
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
            padding: 4px 8px;
        }
    }
</style>
