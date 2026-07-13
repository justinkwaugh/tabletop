<script lang="ts">
    import { MachineState, calculateScores, calculateLiveScores } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { useOneTimeTip } from '$lib/utils/tips.svelte.js'
    import MoneyBadge from './MoneyBadge.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const myId = $derived(session.myPlayer?.id)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isBidding = $derived(state.machineState === MachineState.Bidding)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const isMyPlantTurn = $derived(
        isPlanting &&
        state.plantersOrder[state.planterIndex] === myId
    )
    const isBuilding = $derived(state.machineState === MachineState.CanalBuilding)
    const isOverseerDeciding = $derived(isBuilding && session.isMyTurn && session.isOverseerDecisionPhase)
    const isExtraIrrigation = $derived(state.machineState === MachineState.ExtraIrrigation)
    const privateMoney = $derived(session.game?.config?.privateMoney !== false)

    // Each tip shows once per player (tracked in localStorage, scoped by playerId so
    // hotseat games don't cross-contaminate between seats sharing one browser), then never
    // again — see useOneTimeTip for why it stays visible for the whole turn regardless.
    const bidTip = useOneTimeTip(
        () => `${myId ?? 'anon'}:bid`,
        () => isBidding && session.isMyTurn
    )
    const plantTip = useOneTimeTip(
        () => `${myId ?? 'anon'}:plant`,
        () => isMyPlantTurn
    )
    const bribeTip = useOneTimeTip(
        () => `${myId ?? 'anon'}:bribe`,
        () => isBuilding && session.isMyTurn && !session.isOverseerDecisionPhase
    )
    const overseerTip = useOneTimeTip(
        () => `${myId ?? 'anon'}:overseerDecision`,
        () => isOverseerDeciding
    )
    const personalCanalTip = useOneTimeTip(
        () => `${myId ?? 'anon'}:personalCanal`,
        () => isExtraIrrigation && session.isMyTurn
    )
    const liveScores = $derived(
        isEndOfGame ? calculateScores(state.board) : calculateLiveScores(state.board)
    )

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id

    // During bidding, canalOverseerId is cleared until all bids resolve.
    // Compute the projected overseer from bids placed so far (lowest bid, ties broken by seat order).
    const projectedOverseerId = $derived.by(() => {
        if (!isBidding) return state.canalOverseerId
        const biddedPlayers = state.players.filter(p => p.bid !== undefined)
        if (!biddedPlayers.length) return undefined
        const minBid = Math.min(...biddedPlayers.map(p => p.bid!))
        const candidates = biddedPlayers
            .filter(p => p.bid === minBid)
            .sort((a, b) => state.seatOrder.indexOf(a.playerId) - state.seatOrder.indexOf(b.playerId))
        return candidates[0]?.playerId
    })

    const sortedPlayers = $derived.by(() => {
        const inOrder = state.seatOrder
            .map(id => state.players.find(p => p.playerId === id))
            .filter(p => p !== undefined)
        const activeId = state.activePlayerIds[0]
        const idx = activeId ? inOrder.findIndex(p => p.playerId === activeId) : -1
        if (idx <= 0) return inOrder
        return [...inOrder.slice(idx), ...inOrder.slice(0, idx)]
    })
</script>

<div class="flex flex-col gap-2.5 py-2.5">
    {#each sortedPlayers as p}
        {@const isActive = state.activePlayerIds.includes(p.playerId)}
        {@const isMe = p.playerId === myId}
        {@const isOverseer = projectedOverseerId === p.playerId}
        {@const color = session.colors.getPlayerUiColor(p.playerId)}
        {@const textColor = session.colors.getPlayerTextColor(p.playerId)}
        <div
            class="rounded-lg overflow-hidden {isActive ? 'border-[5px] pulse-border' : 'border-[5px]'}"
            style={isActive ? '' : `border-color: ${color}`}
        >
            <!-- Colored name bar -->
            <div class="px-3 py-2 flex items-center gap-2 font-bold uppercase tracking-widest {textColor} text-lg"
                 style="background-color: {color}">
                {#if isOverseer}
                    <span class="text-[13px] bg-black/30 text-white px-1.5 py-[3px] rounded font-normal shrink-0 normal-case tracking-normal">Overseer</span>
                {/if}
                <span class="truncate min-w-0 flex-1">{playerName(p.playerId)}</span>
                {#if (isBidding || isPlanting) && p.bid !== undefined}
                    <span class="ml-auto shrink-0">
                        <MoneyBadge amount={p.bid} />
                    </span>
                {/if}
            </div>
            <!-- Active-turn controls -->
            {#if isMe && session.isMyTurn}
                {#if isBidding}
                    {#if bidTip.visible}
                        <p class="px-3 pt-2 text-xs text-amber-400/80 text-center">Set your bid, then tap the escudo note to place it</p>
                    {/if}
                    <div class="px-3 py-2 bg-gray-800/60 flex flex-wrap items-center justify-center gap-2">
                        <span class="text-lg font-semibold text-amber-300 uppercase tracking-wide">Place a bid:</span>
                        <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                            onclick={() => session.setBidValue(session.bidValue - 1)} disabled={session.bidValue <= 0}>−</button>
                        <span style="font-size: 1.3em" class="inline-flex items-center">
                            <MoneyBadge amount={session.bidValue} disabled={session.bidIsInvalid}
                                onclick={() => session.placeBid()} />
                        </span>
                        <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                            onclick={() => session.setBidValue(session.bidValue + 1)} disabled={session.bidValue >= session.maxBid}>+</button>
                    </div>
                {:else if isMyPlantTurn}
                    {#if plantTip.visible}
                        <p class="px-3 py-2 text-xs text-amber-400/80 text-center">Choose a field and plant it on the board</p>
                    {/if}
                {:else if isBuilding && !session.isOverseerDecisionPhase}
                    {#if bribeTip.visible}
                        <p class="px-3 pt-2 text-xs text-amber-400/80 text-center">Use −/+ to set your offer, then click a dashed segment on the board to bribe there</p>
                    {/if}
                    <div class="px-3 py-2 bg-gray-800/60 flex flex-wrap items-center justify-center gap-2">
                        <span class="text-lg font-semibold text-amber-300 uppercase tracking-wide">Bribe:</span>
                        <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                            onclick={() => session.setProposalAmount(session.proposalAmount - 1)} disabled={session.proposalAmount <= 1}>−</button>
                        <span style="font-size: 1.3em" class="inline-flex items-center">
                            <MoneyBadge amount={session.proposalAmount} />
                        </span>
                        <button class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold text-lg text-white disabled:opacity-30"
                            onclick={() => session.setProposalAmount(session.proposalAmount + 1)} disabled={session.proposalAmount >= p.money}>+</button>
                        <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                            onclick={() => session.passProposal()}>Pass</button>
                    </div>
                {:else if isOverseerDeciding}
                    {#if overseerTip.visible}
                        <p class="px-3 py-2 text-xs text-amber-400/80 text-center">
                            {#if session.segmentProposals.length > 0}
                                Click a bribe to accept it, or a penalty label to reject all and build there
                            {:else}
                                Click a labeled location to build a canal there
                            {/if}
                        </p>
                    {/if}
                {:else if isExtraIrrigation}
                    {#if personalCanalTip.visible}
                        <p class="px-3 pt-2 text-xs text-amber-400/80 text-center">Click a dashed segment on the board to place it, or pass</p>
                    {/if}
                    <div class="px-3 py-2 bg-gray-800/60 flex flex-wrap items-center justify-center gap-3">
                        <span class="text-amber-300 font-semibold text-sm">Personal canal</span>
                        {#if p.hasPersonalCanal}
                            <button class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                                onclick={() => session.passPersonalCanal()}>Pass</button>
                        {:else}
                            <span class="text-xs text-gray-400">Already used</span>
                        {/if}
                    </div>
                {/if}
            {/if}
            <!-- Dark content area -->
            <div class="px-3 py-2.5 bg-gray-800 flex justify-between items-center text-lg text-white">
                <MoneyBadge amount={p.money} hidden={!isMe && privateMoney && !isEndOfGame} />
                <span class="text-green-300">⭐ {isEndOfGame ? p.score : (liveScores[p.playerId] ?? 0)}</span>
                <span class={p.hasPersonalCanal ? 'text-cyan-400' : 'text-gray-500'}>
                    Personal canal {p.hasPersonalCanal ? '✓' : '✗'}
                </span>
            </div>
        </div>
    {/each}
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
