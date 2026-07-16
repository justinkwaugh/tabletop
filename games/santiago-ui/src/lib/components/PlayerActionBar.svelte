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

    const isBidding = $derived(ms === MachineState.Bidding)
    const isBiddingMyTurn = $derived(isBidding && session.isMyTurn)
    // Every player in bidding order — shown next to the bid control (like Indonesia's turn-order
    // bid tracker) instead of as a badge on each player's own panel. Players who haven't bid
    // yet just show their name, with the bid amount appearing once they have.
    const biddingRows = $derived(
        state.biddingOrder
            .map(id => state.players.find(p => p.playerId === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined)
    )
    const overseerCandidateId = $derived(session.projectedOverseerId)
    const isBuilding = $derived(ms === MachineState.CanalBuilding)
    const isCurrentProposer = $derived(isBuilding && session.isMyTurn && !session.isOverseerDecisionPhase)
    const isOverseerDeciding = $derived(isBuilding && session.isMyTurn && session.isOverseerDecisionPhase)
    // Every non-overseer player in proposal order — shown next to the bribe controls, like
    // biddingRows. A player's amount appears once they've proposed; "Pass" once they've
    // declined; otherwise they just show their name, waiting their turn.
    const bribeRows = $derived(
        state.canalProposalOrder.map((id, i) => ({
            playerId: id,
            hasActed: i < state.canalProposalIndex,
            amount: state.canalProposals.find(c => c.playerId === id)?.amount
        }))
    )
    const isExtraIrrigationMyTurn = $derived(ms === MachineState.ExtraIrrigation && session.isMyTurn)
    const isMyPlantTurn = $derived(
        ms === MachineState.PlantingPhase &&
        state.plantersOrder[state.planterIndex] === myId
    )
    const isMyNeutralPlacementTurn = $derived(session.isNeutralPlacementTurn)
    const isMySpringPlacementTurn = $derived(session.isSpringPlacementTurn)
    // Hide entirely while looking at a past state via the history scrubber — these are live
    // controls for the CURRENT turn, and showing them over a historical snapshot is misleading.
    const hasActionContent = $derived(
        !session.isViewingHistory && (
            isMySpringPlacementTurn ||
            (isBidding && (isBiddingMyTurn || biddingRows.length > 0)) ||
            isMyPlantTurn || isMyNeutralPlacementTurn ||
            (isBuilding && (isCurrentProposer || isOverseerDeciding || bribeRows.length > 0)) ||
            isExtraIrrigationMyTurn
        )
    )
</script>

<!-- Action area -->
{#if hasActionContent}
    <div class="shrink-0 mt-1 min-h-[56px]">
    <div class="max-w-full px-3 py-2 flex flex-wrap items-center gap-3 text-white text-base"
         style="margin-left: {boardCenterX !== null ? `${boardCenterX}px` : '50%'}; transform: translateX(-50%); width: fit-content">

        <!-- SPRING PLACEMENT -->
        {#if isMySpringPlacementTurn}
            <span class="shrink-0 whitespace-nowrap text-amber-300 font-semibold">Place the spring</span>
            <span class="shrink-0 whitespace-nowrap text-sm text-amber-500">Click a highlighted intersection on the board (corners aren't allowed)</span>

        <!-- BIDDING -->
        {:else if isBidding}
            <div class="flex items-center flex-nowrap gap-8">
                {#if isBiddingMyTurn}
                    <div class="flex flex-col gap-1 shrink-0">
                        <div class="flex items-center gap-2">
                            <button class="shrink-0 w-[30px] h-[30px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[15px] text-white disabled:opacity-30"
                                onclick={() => session.setBidValue(session.bidValue - 1)} disabled={session.bidValue <= 0}>−</button>
                            <span style="font-size: 1.0725em" class="inline-flex items-center shrink-0">
                                <MoneyBadge amount={session.bidValue} />
                            </span>
                            <button class="shrink-0 w-[30px] h-[30px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[15px] text-white disabled:opacity-30"
                                onclick={() => session.setBidValue(session.bidValue + 1)} disabled={session.bidValue >= session.maxBid}>+</button>
                            <button class="shrink-0 whitespace-nowrap px-[13px] py-[5px] rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                onclick={() => session.placeBid()} disabled={session.bidIsInvalid}>
                                Place Bid
                            </button>
                        </div>
                        <!-- Bracket under the whole control row above, marking what we're
                             bidding for — the two line segments are flex-1 so the caption
                             stays centered regardless of its own width, with a short
                             upturned tick at each outer end. This row is a plain flex-col
                             child (no items-center), so it stretches to the control row's
                             full width rather than just the caption's intrinsic width. -->
                        <div class="flex items-center gap-1 text-gray-400">
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute left-0 -top-1.5 h-1.5 border-l border-current"></div>
                            </div>
                            <span class="text-[10px] uppercase tracking-wide whitespace-nowrap shrink-0">Bid for player order</span>
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute right-0 -top-1.5 h-1.5 border-r border-current"></div>
                            </div>
                        </div>
                    </div>
                {/if}
                {#if biddingRows.length > 0}
                    <div class="flex flex-col items-center gap-1">
                        <div class="border border-gray-500/60 rounded-md px-2 py-1.5">
                            <div class="grid items-center gap-x-1.5 gap-y-1 shrink-0"
                                 style="font-size: 0.965em; grid-template-columns: auto auto auto; justify-content: start">
                                {#each biddingRows as p (p.playerId)}
                                    <div class="flex items-center justify-self-end whitespace-nowrap">
                                        <PlayerNameChip playerId={p.playerId} />
                                    </div>
                                    <div class="flex items-center whitespace-nowrap">
                                        {#if p.bid !== undefined}
                                            <MoneyBadge amount={p.bid} />
                                        {:else}
                                            <MoneyBadge blank />
                                        {/if}
                                    </div>
                                    <div class="flex items-center whitespace-nowrap">
                                        {#if p.playerId === overseerCandidateId}
                                            <span class="bg-black/30 text-white px-[0.45em] py-[0.23em] rounded font-normal normal-case tracking-normal">Overseer</span>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <span class="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">Current bids</span>
                    </div>
                {/if}
            </div>

        <!-- PLANTING: CHOOSE AND PLACE A FIELD -->
        {:else if isMyPlantTurn}
            <span class="shrink-0 whitespace-nowrap font-semibold text-amber-300">Choose a field and plant it on the board</span>

        <!-- PLANTING: NEUTRAL TILE PLACEMENT (3-player highest bidder) -->
        {:else if isMyNeutralPlacementTurn}
            <span class="shrink-0 whitespace-nowrap font-semibold text-amber-300">Place the fourth field next to an existing tile</span>

        <!-- CANAL BUILDING: PROPOSING/BRIBING -->
        {:else if isBuilding}
            <div class="flex items-center flex-nowrap gap-8">
                {#if isCurrentProposer}
                    <div class="flex flex-col gap-1 shrink-0">
                        <div class="flex items-center gap-2">
                            <button class="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                                onclick={() => session.setProposalAmount(session.proposalAmount - 1)} disabled={session.proposalAmount <= 1}>−</button>
                            <span style="font-size: 1.3em" class="inline-flex items-center shrink-0">
                                <MoneyBadge amount={session.proposalAmount} />
                            </span>
                            <button class="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                                onclick={() => session.setProposalAmount(session.proposalAmount + 1)} disabled={session.proposalAmount >= (me?.money ?? 0)}>+</button>
                            <span class="shrink-0 whitespace-nowrap text-amber-300 font-semibold">or</span>
                            <button class="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                                onclick={() => session.passProposal()}>Pass</button>
                        </div>
                        <!-- Same bracket treatment as the bidding caption above. -->
                        <div class="flex items-center gap-1 text-gray-400">
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute left-0 -top-1.5 h-1.5 border-l border-current"></div>
                            </div>
                            <span class="text-[10px] uppercase tracking-wide whitespace-nowrap shrink-0">
                                Bribe <span class="tracking-normal"><PlayerNameChip playerId={overseerCandidateId} /></span> (the overseer)
                            </span>
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute right-0 -top-1.5 h-1.5 border-r border-current"></div>
                            </div>
                        </div>
                    </div>
                {:else if isOverseerDeciding}
                    <span class="shrink-0 whitespace-nowrap text-amber-300">Click a bribe or canal on the board, or pay the bank</span>
                {/if}
                {#if bribeRows.length > 0}
                    <div class="flex flex-col items-center gap-1">
                        <div class="border border-gray-500/60 rounded-md px-2 py-1.5">
                            <div class="grid items-center gap-x-1.5 gap-y-1 shrink-0"
                                 style="font-size: 0.965em; grid-template-columns: auto auto; justify-content: start">
                                {#each bribeRows as p (p.playerId)}
                                    <div class="flex items-center justify-self-end whitespace-nowrap">
                                        <PlayerNameChip playerId={p.playerId} />
                                    </div>
                                    <div class="flex items-center whitespace-nowrap">
                                        {#if p.amount !== undefined}
                                            <MoneyBadge amount={p.amount} />
                                        {:else if p.hasActed}
                                            <span class="text-[0.85em] text-gray-400 uppercase tracking-wide">Pass</span>
                                        {:else}
                                            <MoneyBadge blank />
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <span class="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">Current bribes</span>
                    </div>
                {/if}
            </div>

        <!-- EXTRA IRRIGATION: PERSONAL CANAL -->
        {:else if isExtraIrrigationMyTurn}
            {#if me?.hasPersonalCanal}
                <span class="shrink-0 whitespace-nowrap text-amber-300">Place your personal canal or</span>
                <button class="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    onclick={() => session.passPersonalCanal()}>Pass</button>
            {:else}
                <span class="shrink-0 whitespace-nowrap text-amber-600">Personal canal already used</span>
            {/if}
        {/if}

    </div>
    </div>
{/if}
