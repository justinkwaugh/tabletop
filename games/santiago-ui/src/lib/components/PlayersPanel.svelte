<script lang="ts">
    import { MachineState, calculateScores, calculateLiveScores } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import MoneyBadge from './MoneyBadge.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const myId = $derived(session.myPlayer?.id)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isBidding = $derived(state.machineState === MachineState.Bidding)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const privateMoney = $derived(session.game?.config?.privateMoney !== false)

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
