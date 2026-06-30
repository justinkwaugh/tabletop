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

    const activePlayerId = $derived(state.activePlayerIds[0])
    const activePlayerName = $derived(
        session.game?.players.find(p => p.id === activePlayerId)?.name ?? null
    )
    // 45 tiles total, one drawn per player per round
    const totalRounds = $derived(Math.ceil(45 / state.players.length))

    function phaseName(ms: MachineState): string {
        switch (ms) {
            case MachineState.Bidding:         return 'Bidding phase'
            case MachineState.PlantingPhase:   return 'Planting phase'
            case MachineState.CanalBuilding:   return 'Canal building phase'
            case MachineState.ExtraIrrigation: return 'Extra irrigation phase'
            default:                           return ''
        }
    }

    function decBid() { session.setBidValue(session.bidValue - 1) }
    function incBid() { session.setBidValue(session.bidValue + 1) }
    function decProposal() { session.setProposalAmount(session.proposalAmount - 1) }
    function incProposal() { session.setProposalAmount(session.proposalAmount + 1) }
</script>

<!-- Status bar -->
<div class="shrink-0 px-3 h-[56px] bg-transparent border-2 border-amber-800 rounded-lg flex items-center gap-2 text-base uppercase tracking-wider">
    {#if ms === MachineState.EndOfGame}
        <span class="text-sm text-amber-300 uppercase tracking-wider">Game over</span>
    {:else if activePlayerName}
        <span class="font-bold text-amber-300">{activePlayerName}'s turn</span>
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
<div class="shrink-0 px-3 py-2 mt-1 bg-amber-950 border-b-2 border-amber-900 rounded-lg flex flex-wrap items-center gap-3 text-white text-base min-h-[56px] uppercase tracking-wider">

    <!-- BIDDING -->
    {#if isBiddingMyTurn}
        <div class="flex items-center gap-2">
            <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                onclick={decBid} disabled={session.bidValue <= 0}>−</button>
            <span class="text-xl font-black w-8 text-center">{session.bidValue}</span>
            <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                onclick={incBid} disabled={session.bidValue >= session.maxBid}>+</button>
        </div>
        <button class="px-4 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onclick={() => session.placeBid()} disabled={session.bidIsInvalid}>
            Bid {session.bidValue} escudo{session.bidValue !== 1 ? 's' : ''}
        </button>

    <!-- PLANTING: SELECT TILE -->
    {:else if isMySelectTurn}
        <span class="text-sm text-amber-500">Choose a field to plant</span>

    <!-- PLANTING: PLACE FIELD -->
    {:else if isMyPlaceTurn}
        {#if state.canalOverseerId === myId && state.overseerBidZero}
            <span class="text-sm text-orange-400">(−1 overseer penalty)</span>
        {/if}
        <span class="text-sm text-amber-500">Click an empty field on the board</span>

    <!-- CANAL BUILDING: PROPOSER -->
    {:else if isCurrentProposer}
        <span class="text-amber-300 font-semibold">Bribe the overseer</span>
        {#if session.selectedSegment}
            <div class="flex items-center gap-2 ml-auto">
                <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                    onclick={decProposal} disabled={session.proposalAmount <= 1}>−</button>
                <span class="text-xl font-black w-8 text-center">{session.proposalAmount}</span>
                <button class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 font-bold disabled:opacity-30"
                    onclick={incProposal} disabled={session.proposalAmount >= (me?.money ?? 0)}>+</button>
            </div>
            <button class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                onclick={() => session.proposeCanal()}>
                Bribe ({session.proposalAmount} esc)
            </button>
        {:else}
            <span class="text-sm text-amber-500">Click a dashed segment on the board</span>
        {/if}
        <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
            onclick={() => session.passProposal()}>Pass</button>

    <!-- CANAL BUILDING: OVERSEER DECISION -->
    {:else if isOverseerDeciding}
        <span class="text-amber-300 font-semibold">Overseer decision</span>
        {#if session.segmentProposals.length > 0}
            <span class="text-sm text-amber-500">Click a bribe or a canal segment</span>
        {:else}
            <span class="text-sm text-amber-600">No bribes were offered</span>
        {/if}
        <div class="ml-auto flex items-center gap-2">
            {#if session.selectedSegment}
                <button class="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors"
                    onclick={() => session.rejectAndBuild()}>
                    {#if session.segmentProposals.length > 0}
                        Reject all · {session.rejectPenalty} esc
                    {:else}
                        Place canal here
                    {/if}
                </button>
            {:else if session.segmentProposals.length > 0}
                <span class="text-sm text-amber-600"></span>
            {:else}
                <span class="text-sm text-amber-500">Click a segment to place a canal</span>
            {/if}
        </div>

    <!-- EXTRA IRRIGATION -->
    {:else if isMyExtraIrrigationTurn}
        <span class="text-amber-300 font-semibold">Personal canal</span>
        {#if me?.hasPersonalCanal}
            {#if session.selectedSegment}
                <button class="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors ml-auto"
                    onclick={() => session.usePersonalCanal()}>
                    Place canal here
                </button>
            {:else}
                <span class="text-sm text-amber-500">Click a dashed segment on the board or</span>
            {/if}
            <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-colors"
                onclick={() => session.passPersonalCanal()}>Pass</button>
        {:else}
            <span class="text-sm text-amber-600">Personal canal already used — pass automatically</span>
        {/if}
    {/if}

</div>
