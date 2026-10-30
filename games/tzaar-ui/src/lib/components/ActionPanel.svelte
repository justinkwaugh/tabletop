<script lang="ts">
    import { MachineState, PIECE_KINDS, type PieceKind } from '@tabletop/tzaar'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import { KIND_NAMES } from '$lib/history/entryText.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const myTone = $derived(session.myPlayer ? session.toneOfPlayer(session.myPlayer.id) : 'white')
    const opening = $derived(session.gameState.isOpeningTurn())
    const second = $derived(session.gameState.machineState === MachineState.SecondMove)

    const prompt = $derived.by(() => {
        if (session.canPlace) return 'Place'
        if (session.canCapture && !second) {
            if (session.chosenFrom) return 'Choose a stack to capture'
            return opening ? 'Opening move: capture' : 'Capture'
        }
        if (second) {
            return session.chosenFrom ? 'Capture, or stack on your own' : 'Capture, stack or'
        }
        return undefined
    })

    function inHand(kind: PieceKind): number {
        const playerId = session.myPlayer?.id
        return playerId === undefined ? 0 : session.gameState.piecesInHand(playerId, kind)
    }
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        <span>{prompt}</span>
        {#if session.canPlace}
            {#each PIECE_KINDS as kind (kind)}
                <button
                    type="button"
                    class="kind"
                    class:chosen={session.placingKind === kind}
                    disabled={inHand(kind) === 0}
                    aria-pressed={session.placingKind === kind}
                    aria-label="{KIND_NAMES[kind]}, {inHand(kind)} left"
                    onclick={() => session.chooseKind(kind)}
                >
                    <PieceIcon tone={myTone} {kind} size={30} />
                    <span>{inHand(kind)}</span>
                </button>
            {/each}
        {/if}
        {#if session.canPass && !session.chosenFrom}
            <button type="button" class="pass" onclick={() => session.pass()}>Pass</button>
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

    .pass {
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
