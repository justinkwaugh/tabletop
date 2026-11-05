<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))
    const mustPlayGipf = $derived(
        session.myPlayer !== undefined && session.gameState.mustPlayGipf(session.myPlayer.id)
    )

    const SELECT_FOR_REMOVAL = 'Tap to keep or remove, then'
    const MUST_BREAK = 'Remove one of the four, then'

    const prompt = $derived.by(() => {
        if (session.resolving && session.canRemove) {
            if (session.chosenRow) {
                if (session.canLeaveRows) return 'Tap to take, then'
                if (session.rowKeepable.length === 0)
                    return `Take ${session.removing.length} pieces`
                return session.mustBreak && !session.breaksRow ? MUST_BREAK : SELECT_FOR_REMOVAL
            }
            return session.rows.length > 1 ? 'Choose a row to take' : 'Take your row'
        }
        if (session.chosenRow) return 'Tap GIPF-pieces to take, then'
        // Skip ends the sentence, as Take row does above.
        if (session.canExtraMove) {
            return session.chosenDot
                ? 'Choose the line to push along'
                : 'Push your TAMSK piece in or'
        }
        if (session.canSkipExtraMove) return 'No room to push TAMSK in'
        if (session.chosenTo) return 'Cover with a'
        if (session.chosenFrom) return 'Choose where it goes'
        if (session.chosenDot) {
            return session.forfeits
                ? 'Choose a line, losing your potentials'
                : 'Choose the line to push along'
        }
        if (session.canPush) {
            if (mustPlayGipf) return 'Push your GIPF-piece in from a dot'
            return session.movable.length > 0
                ? 'Push from a dot, or use a potential'
                : 'Push a piece in from a dot'
        }
        if (session.canMovePotential) return 'Use a potential'
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
                >Tap to <span class="leave">keep</span> or <span class="removal">remove</span>, then</span
            >
        {:else if prompt === MUST_BREAK}
            <span><span class="removal">Remove</span> one of the four, then</span>
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
        {#if session.resolving && session.canLeaveRows}
            <span>or</span>
            <button type="button" class="choice" onclick={() => session.leaveRows()}>Leave</button>
        {/if}
        {#if session.chosenTo}
            <button type="button" class="choice" onclick={() => session.coverWith(1)}>single</button
            >
            <span>or a</span>
            <button type="button" class="choice" onclick={() => session.coverWith(2)}>GIPF</button>
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
        align-content: center;
        justify-content: center;
        gap: 4px 8px;
        min-height: 50px;
        padding: 4px 16px;
        text-align: center;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--gp-ink);
    }

    @media (max-width: 639px) {
        .panel {
            font-size: 16px;
        }
    }

    .removal {
        color: var(--gp-row);
        font-weight: 600;
    }

    .leave {
        color: var(--gp-keep-ink);
        font-weight: 600;
    }

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 3px 12px;
        border-radius: 999px;
        border: 2px solid var(--gp-panel-edge);
        color: var(--gp-ink);
        font-size: 15px;
    }

    .choice:hover:not(:disabled) {
        background: rgb(0 0 0 / 0.05);
    }

    .choice.primary {
        border-color: var(--gp-row);
        background: rgb(240 100 77 / 0.2);
        font-weight: 600;
    }

    .choice:disabled {
        opacity: 0.4;
    }

    /* A prompt and its buttons stay on one row on a 390px phone. */
    @media (max-width: 639px) {
        .panel {
            gap: 4px 6px;
            padding: 4px 8px;
        }

        .choice {
            padding: 2px 9px;
            font-size: 14px;
        }
    }

    /* Narrower, a prompt with buttons can wrap: every message gets two rows, one-row messages
       centred in them, so the board never moves. */
    @media (max-width: 375px) {
        .panel {
            min-height: 70px;
        }
    }
</style>
