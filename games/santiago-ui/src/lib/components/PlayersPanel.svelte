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
        {@const isOverseer = state.canalOverseerId === p.playerId || (state.round === 1 && !state.canalOverseerId && state.seatOrder[0] === p.playerId)}
        {@const playerProposal = isBuilding ? state.canalProposals.find(pr => pr.playerId === p.playerId) : undefined}
        {@const brideOrderIdx = isBuilding ? (state.canalProposalOrder ?? []).indexOf(p.playerId) : -1}
        {@const playerPassedBribe = isBuilding && brideOrderIdx >= 0 && brideOrderIdx < state.canalProposalIndex && !playerProposal}
        {@const color = session.colors.getPlayerUiColor(p.playerId)}
        <div
            class="rounded-lg px-3 py-2 text-sm space-y-1 text-white"
            class:ring-2={isActive}
            class:ring-yellow-400={isActive}
            class:bg-gray-700={!isMe}
            class:bg-gray-600={isMe}
            style="border-left: 8px solid {color}"
        >
            <div class="font-bold flex items-center gap-1.5 min-w-0">
                <span class="truncate">{playerName(p.playerId)}{isMe ? ' (you)' : ''}</span>
                {#if isOverseer}
                    <span class="text-[10px] bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded font-normal shrink-0">Overseer</span>
                {/if}
                {#if (isBidding || isPlanting) && p.bid !== undefined}
                    <span class="ml-auto text-yellow-200 text-xs font-semibold shrink-0">bid {p.bid}</span>
                {:else if isBidding && isActive}
                    <span class="ml-auto text-yellow-400 text-xs animate-pulse shrink-0">Bidding…</span>
                {:else if playerProposal}
                    <span class="ml-auto text-cyan-300 text-xs font-semibold shrink-0">bribe {playerProposal.amount}</span>
                {:else if playerPassedBribe}
                    <span class="ml-auto text-gray-400 text-xs shrink-0">passed</span>
                {/if}
            </div>
            <div class="flex gap-3 text-xs">
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
