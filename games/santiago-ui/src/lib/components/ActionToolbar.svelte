<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import CoinIcon from './CoinIcon.svelte'
    import SproutIcon from './SproutIcon.svelte'
    import DropIcon from './DropIcon.svelte'

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

    // A small phase-appropriate icon next to the phase name — coin for bidding (an
    // escudo changes hands), sprout for planting, water drop for the two canal/water
    // phases. Spring placement has no icon; it's a one-time setup step, not a "phase."
    function phaseIcon(ms: MachineState) {
        switch (ms) {
            case MachineState.Bidding:         return CoinIcon
            case MachineState.PlantingPhase:   return SproutIcon
            case MachineState.CanalBuilding:
            case MachineState.ExtraIrrigation: return DropIcon
            default:                           return undefined
        }
    }

</script>

<!-- Status bar -->
<div class="font-ui paper-texture shrink-0 px-3 h-[44px] bg-amber-950/40 border-2 border-amber-800 rounded-lg flex items-center gap-2 text-base uppercase tracking-wider">
    {#if ms === MachineState.EndOfGame}
        <span class="text-sm text-amber-300 uppercase tracking-wider">Game over</span>
    {:else if activePlayerId}
        {@const Icon = phaseIcon(ms)}
        <span class="font-bold text-amber-300"><PlayerName playerId={activePlayerId} possessive capitalization="uppercase" /> turn</span>
        {#if Icon}
            <Icon class="w-4 h-4 shrink-0" />
        {:else}
            <span class="text-sm text-amber-400">·</span>
        {/if}
        <span class="text-sm text-green-300">Round {state.round} of {totalRounds}</span>
        {#if phaseName(ms)}
            {#if Icon}
                <Icon class="w-4 h-4 shrink-0" />
            {:else}
                <span class="text-sm text-amber-400">·</span>
            {/if}
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
