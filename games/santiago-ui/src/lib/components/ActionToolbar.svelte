<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const ms = $derived(state.machineState)
    const myId = $derived(session.myPlayer?.id)
    const me = $derived(session.mySantiagoPlayer)

    const isBiddingMyTurn = $derived(ms === MachineState.Bidding && session.isMyTurn)
    const isMyPlaceTurn = $derived(
        ms === MachineState.PlantingPhase &&
        state.plantersOrder[state.planterIndex] === myId &&
        !!state.currentPlantingTile
    )
    const isCurrentProposer = $derived(ms === MachineState.CanalBuilding && session.isMyTurn && !session.isOverseerDecisionPhase)
    const isOverseerDeciding = $derived(ms === MachineState.CanalBuilding && session.isMyTurn && session.isOverseerDecisionPhase)
    const isMyExtraIrrigationTurn = $derived(
        ms === MachineState.ExtraIrrigation && session.isMyTurn &&
        !!myId && !state.extraIrrigationPassed.includes(myId)
    )

    const isMySelectTurn = $derived(
        ms === MachineState.PlantingPhase &&
        state.plantersOrder[state.planterIndex] === myId &&
        !state.currentPlantingTile
    )

    const canUndo = $derived(!!session.undoableAction)

    function phaseName(ms: MachineState): string {
        switch (ms) {
            case MachineState.Bidding:         return 'Bidding'
            case MachineState.PlantingPhase:   return 'Planting'
            case MachineState.CanalBuilding:   return 'Canal Building'
            case MachineState.ExtraIrrigation: return 'Extra Irrigation'
            case MachineState.EndOfGame:       return 'Game Over'
            default:                           return ms
        }
    }

    function decBid() { session.setBidValue(session.bidValue - 1) }
    function incBid() { session.setBidValue(session.bidValue + 1) }
    function decProposal() { session.setProposalAmount(session.proposalAmount - 1) }
    function incProposal() { session.setProposalAmount(session.proposalAmount + 1) }
</script>

<div class="shrink-0 px-3 py-2 bg-amber-950 border-b-2 border-amber-900 flex flex-wrap items-center gap-3 text-white text-sm">

    <!-- Round / phase / tiles — always shown -->
    <span class="text-amber-200 font-bold">Round {state.round}</span>
    <span class="text-amber-600">·</span>
    <span class="text-amber-400 text-xs uppercase tracking-wider">{phaseName(ms)}</span>

    <!-- BIDDING -->
    {#if isBiddingMyTurn}
        <div class="flex items-center gap-2 ml-auto">
            <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                onclick={decBid} disabled={session.bidValue <= 0}>−</button>
            <span class="text-xl font-black w-8 text-center">{session.bidValue}</span>
            <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                onclick={incBid} disabled={session.bidValue >= session.maxBid}>+</button>
        </div>
        <button class="px-4 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onclick={() => session.placeBid()} disabled={session.bidIsInvalid}>
            Bid {session.bidValue} esc
        </button>

    <!-- PLANTING: SELECT TILE -->
    {:else if isMySelectTurn}
        <span class="text-amber-500 text-xs ml-auto">Choose a field to plant</span>

    <!-- PLANTING: PLACE FIELD -->
    {:else if isMyPlaceTurn}
        {@const tile = state.currentPlantingTile!}
        <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)} alt={tile.crop}
             class="rounded-md object-cover h-8 w-8"
             style="filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
        <span class="text-amber-300 font-semibold capitalize">{tile.crop}</span>
        <span class="text-amber-600 text-xs">{tile.farmerCapacity} farmer{tile.farmerCapacity !== 1 ? 's' : ''}</span>
        {#if state.canalOverseerId === myId && state.overseerBidZero}
            <span class="text-orange-400 text-xs">(−1 overseer penalty)</span>
        {/if}
        <span class="text-amber-500 text-xs ml-auto">Click a highlighted square on the board</span>

    <!-- CANAL BUILDING: PROPOSER -->
    {:else if isCurrentProposer}
        <span class="text-amber-300 font-semibold">Bribe the overseer</span>
        {#if session.selectedSegment}
            <div class="flex items-center gap-2 ml-auto">
                <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                    onclick={decProposal} disabled={session.proposalAmount <= 1}>−</button>
                <span class="text-xl font-black w-8 text-center">{session.proposalAmount}</span>
                <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold"
                    onclick={incProposal}>+</button>
            </div>
            <button class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                onclick={() => session.proposeCanal()}>
                Bribe ({session.proposalAmount} esc)
            </button>
        {:else}
            <span class="text-amber-500 text-xs">Click a dashed segment on the board</span>
        {/if}
        <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
            onclick={() => session.passProposal()}>Pass</button>

    <!-- CANAL BUILDING: OVERSEER DECISION -->
    {:else if isOverseerDeciding}
        <span class="text-amber-300 font-semibold">Overseer decision</span>
        {#if session.segmentProposals.length > 0}
            <span class="text-amber-500 text-xs">Click a label on the board to accept a bribe</span>
        {:else}
            <span class="text-amber-600 text-xs">No bribes were offered</span>
        {/if}
        <div class="ml-auto flex items-center gap-2">
            {#if session.selectedSegment}
                <span class="text-cyan-300 text-xs">
                    {session.selectedSegment.orientation}({session.selectedSegment.col},{session.selectedSegment.row})
                </span>
                <button class="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors"
                    onclick={() => session.rejectAndBuild()}>
                    {#if session.segmentProposals.length > 0}
                        Reject all · {session.rejectPenalty} esc
                    {:else}
                        Place canal here
                    {/if}
                </button>
            {:else if session.segmentProposals.length > 0}
                <span class="text-amber-600 text-xs">or click a segment to reject all</span>
            {:else}
                <span class="text-amber-500 text-xs">Click a segment to place a canal</span>
            {/if}
        </div>

    <!-- EXTRA IRRIGATION -->
    {:else if isMyExtraIrrigationTurn}
        <span class="text-amber-300 font-semibold">Personal canal</span>
        {#if me?.hasPersonalCanal}
            {#if session.selectedSegment}
                <span class="text-cyan-300 text-xs">
                    {session.selectedSegment.orientation}({session.selectedSegment.col},{session.selectedSegment.row})
                </span>
                <button class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors ml-auto"
                    onclick={() => session.usePersonalCanal()}>
                    Place canal here
                </button>
            {:else}
                <span class="text-amber-500 text-xs">Click a dashed segment on the board</span>
            {/if}
            <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
                onclick={() => session.passPersonalCanal()}>Pass</button>
        {:else}
            <span class="text-amber-600 text-xs">Personal canal already used — pass automatically</span>
        {/if}
    {/if}

    <!-- UNDO — always shown when available, pinned to the right -->
    {#if canUndo}
        <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-semibold transition-colors ml-auto shrink-0"
            onclick={() => session.undo()}>
            Undo
        </button>
    {/if}

</div>
