<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import MoneyBadge from './MoneyBadge.svelte'
    import PlayerNameChip from './PlayerNameChip.svelte'

    let { boardCenterX = null }: { boardCenterX?: number | null } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)
    const ms = $derived(state.machineState)
    const myId = $derived(session.myPlayer?.id)
    const me = $derived(session.mySantiagoPlayer)

    const isBiddingMyTurn = $derived(ms === MachineState.Bidding && session.isMyTurn)
    const isBuilding = $derived(ms === MachineState.CanalBuilding)
    const isCurrentProposer = $derived(isBuilding && session.isMyTurn && !session.isOverseerDecisionPhase)
    const isOverseerDeciding = $derived(isBuilding && session.isMyTurn && session.isOverseerDecisionPhase)
    const isExtraIrrigationMyTurn = $derived(ms === MachineState.ExtraIrrigation && session.isMyTurn)
    const isMyPlantTurn = $derived(
        ms === MachineState.PlantingPhase &&
        state.plantersOrder[state.planterIndex] === myId
    )
    const isMyNeutralPlacementTurn = $derived(session.isNeutralPlacementTurn)
    const isMySpringPlacementTurn = $derived(session.isSpringPlacementTurn)
    const hasActionContent = $derived(
        isMySpringPlacementTurn || isBiddingMyTurn || isMyPlantTurn || isMyNeutralPlacementTurn ||
        isCurrentProposer || isOverseerDeciding || isExtraIrrigationMyTurn
    )

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
        <span class="font-bold text-amber-300"><PlayerNameChip playerId={activePlayerId} possessive uppercase /> turn</span>
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

<!-- Action area -->
{#if hasActionContent}
    <div class="relative shrink-0 mt-1 min-h-[56px]">
    <div class="absolute top-0 max-w-[90%] px-3 py-2 flex flex-wrap items-center gap-3 text-white text-base"
         style="left: {boardCenterX ?? '50%'}px; transform: translateX(-50%)">

        <!-- SPRING PLACEMENT -->
        {#if isMySpringPlacementTurn}
            <span class="text-amber-300 font-semibold">Place the spring</span>
            <span class="text-sm text-amber-500">Click a highlighted intersection on the board (corners aren't allowed)</span>

        <!-- BIDDING -->
        {:else if isBiddingMyTurn}
            <div class="flex items-center gap-2">
                <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                    onclick={() => session.setBidValue(session.bidValue - 1)} disabled={session.bidValue <= 0}>−</button>
                <span style="font-size: 1.3em" class="inline-flex items-center">
                    <MoneyBadge amount={session.bidValue} />
                </span>
                <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                    onclick={() => session.setBidValue(session.bidValue + 1)} disabled={session.bidValue >= session.maxBid}>+</button>
                <button class="px-4 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    onclick={() => session.placeBid()} disabled={session.bidIsInvalid}>
                    Place Bid
                </button>
            </div>

        <!-- PLANTING: CHOOSE AND PLACE A FIELD -->
        {:else if isMyPlantTurn}
            <span class="font-semibold text-amber-300">Choose a field and plant it on the board</span>

        <!-- PLANTING: NEUTRAL TILE PLACEMENT (3-player highest bidder) -->
        {:else if isMyNeutralPlacementTurn}
            <span class="font-semibold text-amber-300">Place the fourth field next to an existing tile</span>

        <!-- CANAL BUILDING: PROPOSER (bribe) -->
        {:else if isCurrentProposer}
            <span class="text-amber-300 font-semibold">You may set a bribe and click a canal</span>
            <div class="flex items-center gap-2">
                <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                    onclick={() => session.setProposalAmount(session.proposalAmount - 1)} disabled={session.proposalAmount <= 1}>−</button>
                <span style="font-size: 1.3em" class="inline-flex items-center">
                    <MoneyBadge amount={session.proposalAmount} />
                </span>
                <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                    onclick={() => session.setProposalAmount(session.proposalAmount + 1)} disabled={session.proposalAmount >= (me?.money ?? 0)}>+</button>
                <span class="text-amber-300 font-semibold">or</span>
                <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    onclick={() => session.passProposal()}>Pass</button>
            </div>

        <!-- CANAL BUILDING: OVERSEER DECISION -->
        {:else if isOverseerDeciding}
            <span class="text-amber-300 font-semibold">Click a bribe to accept it, or pay the bank</span>

        <!-- EXTRA IRRIGATION: PERSONAL CANAL -->
        {:else if isExtraIrrigationMyTurn}
            {#if me?.hasPersonalCanal}
                <span class="text-amber-300 font-semibold">Place your personal canal or</span>
                <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    onclick={() => session.passPersonalCanal()}>Pass</button>
            {:else}
                <span class="text-amber-600">Personal canal already used</span>
            {/if}
        {/if}

    </div>
    </div>
{/if}
