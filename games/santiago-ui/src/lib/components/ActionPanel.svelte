<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { fieldImageUrl } from '$lib/utils/cropImages.js'

    const session = getGameSession()

    const state = $derived(session.gameState)
    const machineState = $derived(state.machineState)
    const myId = $derived(session.myPlayer?.id)
    const mySantiagoPlayer = $derived(session.mySantiagoPlayer)

    // ── Bidding ──────────────────────────────────────────────────────────────
    const isBidding = $derived(machineState === MachineState.Bidding)

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id

    const revealedTiles = $derived(isBidding ? state.revealedTiles ?? [] : [])

    function decBid() { session.setBidValue(session.bidValue - 1) }
    function incBid() { session.setBidValue(session.bidValue + 1) }

    // ── PlantingPhase ────────────────────────────────────────────────────────
    const isPlanting = $derived(machineState === MachineState.PlantingPhase)
    const tile = $derived(state.currentPlantingTile)
    const isMyPlantTurn = $derived(isPlanting && state.plantersOrder[state.planterIndex] === myId)
    const isMyPlaceTurn = $derived(isMyPlantTurn && !!tile)
    const validPlacements = $derived(session.validFieldPlacements)

    // ── CanalBuilding ────────────────────────────────────────────────────────
    const isBuilding = $derived(machineState === MachineState.CanalBuilding)
    const isProposalPhase = $derived(
        isBuilding && !session.isOverseerDecisionPhase
    )
    const isOverseerDecision = $derived(
        isBuilding && session.isOverseerDecisionPhase
    )
    const isCurrentProposer = $derived(
        isBuilding && session.isMyTurn && !session.isOverseerDecisionPhase
    )
    const isOverseerDeciding = $derived(
        isBuilding && session.isMyTurn && session.isOverseerDecisionPhase
    )
    const proposals = $derived(session.canalProposals)
    const segmentProposals = $derived(session.segmentProposals)
    const rejectPenalty = $derived(session.rejectPenalty)

    function incProposal() { session.setProposalAmount(session.proposalAmount + 1) }
    function decProposal() { session.setProposalAmount(session.proposalAmount - 1) }

    // ── ExtraIrrigation ──────────────────────────────────────────────────────
    const isExtraIrrigation = $derived(machineState === MachineState.ExtraIrrigation)
    const alreadyActedBribe = $derived(
        isExtraIrrigation && !!myId && state.extraIrrigationPassed.includes(myId)
    )

    // ── EndOfGame ────────────────────────────────────────────────────────────
    const isEndOfGame = $derived(machineState === MachineState.EndOfGame)
    const sortedPlayers = $derived(
        [...state.players].sort((a, b) => b.score - a.score)
    )
</script>

<div class="bg-gray-900/90 rounded-xl p-4 text-white space-y-3 min-w-64">

    <!-- BIDDING -->
    {#if isBidding}
        <p class="text-yellow-300 font-semibold">Place your bid</p>
        <p class="text-xs text-gray-400">
            Budget: {mySantiagoPlayer?.money ?? 0} escudos
        </p>

        <!-- Tiles available this round -->
        {#if revealedTiles.length > 0}
            <div class="border-t border-gray-700 pt-2 space-y-1">
                <p class="text-xs text-gray-400 font-semibold uppercase tracking-wide">This round's tiles</p>
                <div class="flex flex-wrap gap-2">
                    {#each revealedTiles as tile}
                        <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                             alt={tile.crop}
                             class="rounded-md object-cover"
                             style="width:3rem; height:3rem; filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                    {/each}
                </div>
                <p class="text-xs text-gray-500">Players choose in bid order, highest first.</p>
            </div>
        {/if}

        <div class="flex items-center justify-center gap-4">
            <button
                class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 font-bold text-lg disabled:opacity-30"
                onclick={decBid} disabled={session.bidValue <= 0}
            >−</button>
            <span class="text-3xl font-black w-12 text-center">{session.bidValue}</span>
            <button
                class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 font-bold text-lg disabled:opacity-30"
                onclick={incBid} disabled={session.bidValue >= session.maxBid}
            >+</button>
        </div>
        <button
            class="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition-colors"
            onclick={() => session.placeBid()}
        >
            Bid {session.bidValue} escudo{session.bidValue !== 1 ? 's' : ''}
        </button>

    <!-- PLANTING: TILE PLACEMENT -->
    {:else if isMyPlaceTurn}
        <p class="text-yellow-300 font-semibold">Plant your field</p>
        {#if tile}
            <div class="flex items-center gap-3">
                <img src={fieldImageUrl(tile.crop, tile.farmerCapacity)}
                     alt={tile.crop}
                     class="rounded-md object-cover"
                     style="width:3rem; height:3rem; filter:drop-shadow(1px 2px 2px rgba(0,0,0,0.5))" />
                <p class="text-sm">
                    <span class="font-bold capitalize text-white">{tile.crop}</span><br/>
                    <span class="text-gray-400">{tile.farmerCapacity} farmer{tile.farmerCapacity !== 1 ? 's' : ''}</span>
                    {#if state.canalOverseerId === myId && state.overseerBidZero}
                        <span class="text-orange-400"><br/>(−1 overseer penalty)</span>
                    {/if}
                </p>
            </div>
        {/if}
        {#if validPlacements.size > 0}
            <p class="text-xs text-gray-400">Click a highlighted square on the board.</p>
        {:else}
            <p class="text-xs text-orange-400">No valid placements — your turn will be skipped.</p>
        {/if}

    <!-- CANAL BUILDING -->
    {:else if isBuilding}
        {#if isCurrentProposer}
            <p class="text-yellow-300 font-semibold">Propose a canal</p>
            <p class="text-xs text-gray-400">Select a segment and set your escudo offer (minimum 1), then propose — or pass.</p>

            {#if segmentProposals.length > 0}
                <div class="border-t border-gray-700 pt-2 space-y-1">
                    <p class="text-xs text-gray-400 uppercase tracking-wide">Proposals so far</p>
                    {#each segmentProposals as sp}
                        <div class="text-xs">
                            <div class="flex justify-between text-gray-300">
                                <span class="text-gray-400">{sp.segment.orientation}({sp.segment.col},{sp.segment.row})</span>
                                <span class="text-cyan-300 font-semibold">{sp.total} esc total</span>
                            </div>
                            {#each sp.contributions as c}
                                <div class="flex justify-between text-gray-500 pl-2">
                                    <span>{playerName(c.playerId)}</span>
                                    <span>{c.amount}</span>
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
            {/if}

            {#if session.selectedSegment}
                <p class="text-xs text-cyan-300">
                    Segment: {session.selectedSegment.orientation} ({session.selectedSegment.col},{session.selectedSegment.row})
                </p>
                <div class="flex items-center justify-center gap-3">
                    <button
                        class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 font-bold disabled:opacity-30"
                        onclick={decProposal} disabled={session.proposalAmount <= 1}
                    >−</button>
                    <span class="text-xl font-black w-10 text-center">{session.proposalAmount}</span>
                    <button
                        class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 font-bold"
                        onclick={incProposal}
                    >+</button>
                </div>
                <button
                    class="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                    onclick={() => session.proposeCanal()}
                >
                    Propose ({session.proposalAmount} escudos)
                </button>
            {:else}
                <p class="text-xs text-gray-500">Click a dashed segment on the board to select it.</p>
            {/if}

            <button
                class="w-full py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
                onclick={() => session.passProposal()}
            >
                Pass (no proposal)
            </button>

        {:else if isOverseerDeciding}
            <p class="text-yellow-300 font-semibold">Make your decision</p>

            {#if segmentProposals.length > 0}
                <div class="border-t border-gray-700 pt-2 space-y-2">
                    <p class="text-xs text-gray-400 uppercase tracking-wide">Accept a proposal</p>
                    {#each segmentProposals as sp}
                        <div class="rounded border border-gray-600 p-2 space-y-0.5">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-cyan-300 font-bold text-sm">{sp.total} esc</span>
                                <button
                                    class="px-2 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-bold"
                                    onclick={() => session.acceptProposal(sp.segment)}
                                >Accept</button>
                            </div>
                            {#each sp.contributions as c}
                                <div class="flex justify-between text-xs text-gray-400">
                                    <span>{playerName(c.playerId)}</span>
                                    <span>{c.amount} esc</span>
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-xs text-gray-400">No proposals were made.</p>
            {/if}

            <div class="border-t border-gray-700 pt-2 space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wide">
                    Reject all · cost: {rejectPenalty} escudo{rejectPenalty !== 1 ? 's' : ''} to bank
                </p>
                {#if session.selectedSegment}
                    <p class="text-xs text-cyan-300">
                        Segment: {session.selectedSegment.orientation} ({session.selectedSegment.col},{session.selectedSegment.row})
                    </p>
                    <button
                        class="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors"
                        onclick={() => session.rejectAndBuild()}
                    >
                        Reject all · Build here ({rejectPenalty} esc)
                    </button>
                {:else}
                    <p class="text-xs text-gray-500">Click a dashed segment on the board to choose your location.</p>
                {/if}
            </div>
        {/if}

    <!-- EXTRA IRRIGATION -->
    {:else if isExtraIrrigation}
        {#if alreadyActedBribe}
            <p class="text-yellow-300 font-semibold text-center">Done ✓</p>
            <p class="text-sm text-gray-400 text-center">Waiting for others…</p>
        {:else if mySantiagoPlayer?.hasPersonalCanal}
            <p class="text-yellow-300 font-semibold">Personal canal</p>
            <p class="text-xs text-gray-400">You may place your one personal canal, or pass.</p>
            <button
                class="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold transition-colors"
                onclick={() => session.passPersonalCanal()}
            >
                Pass
            </button>
            {#if session.selectedSegment}
                <p class="text-xs text-cyan-300">
                    Selected: {session.selectedSegment.orientation} ({session.selectedSegment.col},{session.selectedSegment.row})
                </p>
                <button
                    class="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                    onclick={() => session.usePersonalCanal()}
                >
                    Place canal here
                </button>
            {:else}
                <p class="text-xs text-gray-500">Click a dashed segment on the board to select.</p>
            {/if}
        {:else}
            <p class="text-yellow-300 font-semibold text-center">Already used</p>
            <p class="text-sm text-gray-400 text-center">You've already used your personal canal this game.</p>
        {/if}

    <!-- END OF GAME -->
    {:else if isEndOfGame}
        <p class="text-green-400 font-bold text-lg text-center">Final Scores</p>
        <ul class="space-y-1">
            {#each sortedPlayers as p, i}
                <li class="flex justify-between text-sm"
                    class:text-yellow-300={p.playerId === state.winningPlayerIds[0]}>
                    <span>{i + 1}. {p.playerId}</span>
                    <span class="font-bold">{p.score} pts</span>
                </li>
            {/each}
        </ul>
    {/if}

</div>
