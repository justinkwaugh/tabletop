<script lang="ts">
    import { MachineState } from '@tabletop/zertz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import PoolStrip from './PoolStrip.svelte'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const lastEntry = $derived(historyEntries(session.actions).at(-1))

    const prompt = $derived.by(() => {
        if (session.canRemove) return 'Remove a free ring'
        if (session.canCapture) {
            if (session.gameState.machineState === MachineState.ContinuingCapture) {
                return 'Keep jumping: choose where to land'
            }
            return session.chosenJumper
                ? 'Capture: choose where to land'
                : 'You must capture: choose a marble to jump with'
        }
        if (session.canPlace) {
            return session.chosenColor
                ? `Place the ${session.chosenColor} marble on a vacant ring`
                : 'Choose a marble, then a vacant ring'
        }
        return undefined
    })
</script>

<!-- One message row, as Bus and Magna Grecia do: the last move while you wait, the prompt on
     your turn. The pool strip below is the same height in every state, so the board never moves. -->
<div class="flex flex-col items-center gap-1 px-3 py-1 text-center text-(--zertz-ink)">
    <div class="message">
        {#if session.isViewingHistory || !prompt}
            {#if lastEntry}
                <HistoryEntryLine entry={lastEntry} />
            {:else}
                <span>{session.isViewingHistory ? 'The game begins' : 'Waiting for turn'}</span>
            {/if}
        {:else}
            <span>{prompt}</span>
        {/if}
    </div>
    <PoolStrip />
</div>

<style>
    .message {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        font-size: 18px;
        letter-spacing: 0.02em;
    }

    @media (max-width: 639px) {
        .message {
            font-size: 16px;
        }
    }
</style>
