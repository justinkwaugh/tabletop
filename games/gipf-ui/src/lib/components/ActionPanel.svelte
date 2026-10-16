<script lang="ts">
    import { MachineState } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const myColor = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id).color : undefined
    )
    const resolving = $derived(session.gameState.machineState === MachineState.ResolvingRows)

    const SELECT_FOR_REMOVAL = 'Leave GIPF-pieces, or mark them for removal, then'

    const prompt = $derived.by(() => {
        if (resolving && session.canRemove) {
            if (session.chosenRow) {
                return session.rowGipfPieces.length > 0
                    ? SELECT_FOR_REMOVAL
                    : `Take ${session.removing.length} pieces`
            }
            return session.rows.length > 1 ? 'Choose a row to take' : 'Take your row'
        }
        if (session.canPush) {
            if (session.chosenGipf === undefined) return 'Bring in a'
            if (session.chosenDot) return 'Choose the line to push along'
            return session.rows.length > 0
                ? 'Push from a dot, or tap your GIPF-pieces to take them'
                : 'Choose a dot to push from'
        }
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt and its buttons on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        {#if prompt === SELECT_FOR_REMOVAL}
            <span
                ><span class="leave">Leave</span> GIPF-pieces, or mark them for
                <span class="removal">removal</span>, then</span
            >
        {:else}
            <span>{prompt}</span>
        {/if}
        {#if session.pieceTypes.length > 1 && myColor}
            {#each session.pieceTypes as gipf, index (gipf)}
                {#if index > 0}<span>or</span>{/if}
                <button
                    type="button"
                    class="choice"
                    class:chosen={session.chosenGipf === gipf}
                    aria-pressed={session.chosenGipf === gipf}
                    onclick={() => session.chooseGipf(gipf)}
                >
                    <PieceIcon color={myColor} {gipf} size={20} />
                    {gipf ? 'GIPF-piece' : 'single piece'}
                </button>
            {/each}
        {/if}
        {#if session.chosenRow}
            <button
                type="button"
                class="choice primary"
                disabled={session.removing.length === 0}
                onclick={() => session.removeChosenRow()}>Take row</button
            >
        {/if}
        {#if session.canFinish}
            <span>or</span>
            <button type="button" class="choice" onclick={() => session.finishRemoving()}
                >leave GIPF-pieces</button
            >
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
        color: var(--gipf-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }

    .removal {
        color: var(--gipf-row);
        font-weight: 600;
    }

    .leave {
        color: var(--gipf-keep);
        font-weight: 600;
    }

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 3px 12px;
        border-radius: 999px;
        border: 2px solid var(--gipf-panel-edge);
        color: var(--gipf-ink);
        font-size: 15px;
    }

    .choice:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.08);
    }

    .choice.chosen {
        border-color: var(--gipf-target);
        background: rgb(240 176 74 / 0.14);
    }

    .choice.primary {
        border-color: var(--gipf-row);
        background: rgb(240 100 77 / 0.2);
        font-weight: 600;
    }

    .choice:disabled {
        opacity: 0.4;
    }
</style>
