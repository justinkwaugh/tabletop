<script lang="ts">
    import { MachineState } from '@tabletop/zertz'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyEntries } from '$lib/history/historyEntries.js'
    import PoolStrip from './PoolStrip.svelte'
    import HistoryEntryLine from './HistoryEntryLine.svelte'

    const session = getGameSession()

    const activePlayerId = $derived(session.gameState.activePlayerIds[0])
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

    const waitingFor = $derived.by(() => {
        switch (session.gameState.machineState) {
            case MachineState.RemovingRing:
                return 'remove a ring'
            case MachineState.ContinuingCapture:
                return 'keep jumping'
            default:
                return session.gameState.board.hasAnyJump() ? 'capture' : 'place a marble'
        }
    })
</script>

<div class="flex flex-col items-center gap-2 px-3 py-2 text-center text-(--zertz-ink)">
    {#if session.isViewingHistory}
        {#if lastEntry}
            <div class="text-[16px]"><HistoryEntryLine entry={lastEntry} /></div>
        {:else}
            <div class="text-[16px] italic text-(--zertz-ink-quiet)">The game begins</div>
        {/if}
    {:else if prompt}
        <div class="text-[18px] max-sm:text-[16px] font-semibold">{prompt}</div>
    {:else if activePlayerId}
        <div class="text-[17px] max-sm:text-[15px]">
            Waiting for <PlayerName playerId={activePlayerId} /> to {waitingFor}
        </div>
        {#if lastEntry}
            <div class="text-[14px] text-(--zertz-ink-quiet)">
                Last: <HistoryEntryLine entry={lastEntry} />
            </div>
        {/if}
    {/if}
    <PoolStrip />
</div>
