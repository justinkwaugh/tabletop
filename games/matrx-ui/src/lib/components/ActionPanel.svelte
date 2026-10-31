<script lang="ts">
    import { MachineState } from '@tabletop/matrx'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const resolving = $derived(session.gameState.machineState === MachineState.ResolvingRows)
    const mustPlayGipf = $derived(
        session.myPlayer !== undefined && session.gameState.mustPlayGipf(session.myPlayer.id)
    )

    const SELECT_FOR_REMOVAL = 'Tap stacks of two to leave or remove them, then'
    const MUST_BREAK = 'Mark a stack in your row of four for removal'

    const prompt = $derived.by(() => {
        if (resolving && session.canRemove) {
            if (session.chosenRow) {
                if (session.rowPairs.length === 0) return `Take ${session.removing.length} pieces`
                return session.breaksRow ? SELECT_FOR_REMOVAL : MUST_BREAK
            }
            return session.rows.length > 1 ? 'Choose a row to take' : 'Take your row'
        }
        if (session.canExtraMove || session.canSkipExtraMove) {
            return session.chosenDot
                ? 'Choose the line to push along'
                : 'Extra move: push your TAMSK piece in'
        }
        if (session.chosenFrom) return 'Choose where it goes'
        if (session.chosenDot) return 'Choose the line to push along'
        if (session.canPush) {
            if (mustPlayGipf) return 'Push your GIPF piece in from a dot'
            return session.movable.length > 0
                ? 'Push from a dot, or move a potential'
                : 'Push a stack in from a dot'
        }
        if (session.canMovePotential) return 'Move a potential'
        return undefined
    })
</script>

<!-- One row, as Bus and Magna Grecia do: the last move while you wait, the prompt and its buttons on your turn. -->
<div class="panel">
    {#if session.isViewingHistory || !prompt}
        {#if lastEntry}
            <HistoryEntryLine entry={lastEntry} brief />
        {:else}
            <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
        {/if}
    {:else}
        {#if prompt === SELECT_FOR_REMOVAL}
            <span
                >Tap stacks of two to <span class="leave">leave</span> or
                <span class="removal">remove</span> them, then</span
            >
        {:else if prompt === MUST_BREAK}
            <span>Mark a stack in your row of four for <span class="removal">removal</span></span>
        {:else}
            <span>{prompt}</span>
        {/if}
        {#if session.chosenRow}
            <button
                type="button"
                class="choice primary"
                disabled={!session.breaksRow}
                onclick={() => session.removeChosenRow()}>Take row</button
            >
        {/if}
        {#if session.canSkipExtraMove && !session.chosenDot}
            <button type="button" class="choice" onclick={() => session.skipExtraMove()}
                >Skip</button
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
        color: var(--matrx-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }

    .removal {
        color: var(--matrx-row);
        font-weight: 600;
    }

    .leave {
        color: var(--matrx-keep-ink);
        font-weight: 600;
    }

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 3px 12px;
        border-radius: 999px;
        border: 2px solid var(--matrx-panel-edge);
        color: var(--matrx-ink);
        font-size: 15px;
    }

    .choice:hover:not(:disabled) {
        background: rgb(0 0 0 / 0.05);
    }

    .choice.primary {
        border-color: var(--matrx-row);
        background: rgb(240 100 77 / 0.2);
        font-weight: 600;
    }

    .choice:disabled {
        opacity: 0.4;
    }
</style>
