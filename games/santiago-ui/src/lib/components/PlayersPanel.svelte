<script lang="ts">
    import { MachineState, calculateScores, calculateLiveScores } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const myId = $derived(session.myPlayer?.id)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isBidding = $derived(state.machineState === MachineState.Bidding)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const isBuilding = $derived(state.machineState === MachineState.CanalBuilding)
    const publicMoney = $derived(!!(session.game?.config?.publicMoney))
    const publicScore = $derived(!!(session.game?.config?.publicScore))
    const liveScores = $derived(
        isEndOfGame ? calculateScores(state.board) :
        publicScore ? calculateLiveScores(state.board) : {}
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

<div class="flex flex-col gap-2 p-2">
    {#each sortedPlayers as p}
        {@const isActive = state.activePlayerIds.includes(p.playerId)}
        {@const isMe = p.playerId === myId}
        {@const isOverseer = projectedOverseerId === p.playerId}
        {@const playerProposal = isBuilding ? state.canalProposals.find(pr => pr.playerId === p.playerId) : undefined}
        {@const brideOrderIdx = isBuilding ? (state.canalProposalOrder ?? []).indexOf(p.playerId) : -1}
        {@const playerPassedBribe = isBuilding && brideOrderIdx >= 0 && brideOrderIdx < state.canalProposalIndex && !playerProposal}
        {@const color = session.colors.getPlayerUiColor(p.playerId)}
        <div
            class="rounded-lg overflow-hidden border-2"
            class:ring-2={isActive}
            class:ring-offset-1={isActive}
            class:ring-yellow-400={isActive}
            style="border-color: {color}"
        >
            <!-- Colored name bar -->
            <div class="px-3 py-1.5 flex items-center gap-1.5 font-bold uppercase tracking-widest text-white text-sm"
                 style="background-color: {color}">
                <span class="truncate">{playerName(p.playerId)}{isMe ? ' (you)' : ''}</span>
                {#if isOverseer}
                    <span class="text-[10px] bg-black/30 text-white px-1.5 py-0.5 rounded font-normal shrink-0 normal-case tracking-normal">Overseer</span>
                {/if}
                {#if (isBidding || isPlanting) && p.bid !== undefined}
                    <span class="ml-auto text-white/80 text-xs font-semibold shrink-0 normal-case tracking-normal">bid {p.bid}</span>
                {:else if isBidding && isActive}
                    <span class="ml-auto text-white text-xs animate-pulse shrink-0 normal-case tracking-normal">Bidding…</span>
                {:else if isBuilding && isActive && !playerProposal && !playerPassedBribe && !session.isOverseerDecisionPhase}
                    <span class="ml-auto text-white text-xs animate-pulse shrink-0 normal-case tracking-normal">Bribing…</span>
                {:else if playerProposal}
                    <span class="ml-auto text-white/80 text-xs font-semibold shrink-0 normal-case tracking-normal">bribe {playerProposal.amount}</span>
                {:else if playerPassedBribe}
                    <span class="ml-auto text-white/60 text-xs shrink-0 normal-case tracking-normal">passed</span>
                {/if}
            </div>
            <!-- Dark content area -->
            <div class="px-3 py-2 bg-gray-800 flex gap-3 text-xs text-white">
                {#if isMe || publicMoney || isEndOfGame}
                    <span class="text-yellow-300">💰 {p.money}</span>
                {:else}
                    <span class="text-yellow-900">💰 ?</span>
                {/if}
                {#if publicScore || isEndOfGame}
                    {@const fieldPts = liveScores[p.playerId] ?? 0}
                    <span class="text-green-300">⭐ {isEndOfGame ? p.score : fieldPts}</span>
                {/if}
                <span class={p.hasPersonalCanal ? 'text-cyan-400' : 'text-gray-500'}>
                    Personal canal {p.hasPersonalCanal ? '✓' : '✗'}
                </span>
            </div>
        </div>
    {/each}
</div>
