<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const ms = $derived(state.machineState)

    const canUndo = $derived(!!session.undoableAction)

    const activePlayerId = $derived(state.activePlayerIds[0])
    // 45 tiles total, one drawn per player per round
    const totalRounds = $derived(Math.floor(45 / Math.max(4, state.players.length)))

    function phaseName(ms: MachineState): string {
        switch (ms) {
            case MachineState.SpringPlacement: return 'Spring placement'
            case MachineState.Bidding:         return 'Bidding phase'
            case MachineState.PlantingPhase:   return 'Planting phase'
            case MachineState.CanalBuilding:   return 'Canal building phase'
            case MachineState.ExtraIrrigation: return 'Extra irrigation phase'
            default:                           return ''
        }
    }

</script>

<!-- Status bar -->
<div class="shrink-0 px-3 h-[44px] bg-transparent border-2 border-amber-800 rounded-lg flex items-center gap-2 text-base uppercase tracking-wider">
    {#if ms === MachineState.EndOfGame}
        <span class="text-sm text-amber-300 uppercase tracking-wider">Game over</span>
    {:else if activePlayerId}
        <span class="font-bold text-amber-300"><PlayerName playerId={activePlayerId} possessive capitalization="uppercase" /> turn</span>
        <span class="text-sm text-amber-400">·</span>
        <span class="text-sm text-amber-300">Round {state.round} of {totalRounds}</span>
        {#if phaseName(ms)}
            <span class="text-sm text-amber-400">·</span>
            <span class="text-sm text-amber-300">{phaseName(ms)}</span>
        {/if}
    {/if}
    {#if canUndo}
        <button class="ml-auto px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-semibold transition-colors shrink-0"
            onclick={() => session.undo()}>
            Undo
        </button>
    {/if}
</div>
