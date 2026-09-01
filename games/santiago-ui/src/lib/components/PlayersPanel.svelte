<script lang="ts">
    import { MachineState, calculateScores, calculateLiveScores } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import MoneyBadge from './MoneyBadge.svelte'
    import CanalIcon from './CanalIcon.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const myId = $derived(session.myPlayer?.id)
    const isEndOfGame = $derived(state.machineState === MachineState.EndOfGame)
    const isPlanting = $derived(state.machineState === MachineState.PlantingPhase)
    const publicMoney = $derived(session.game?.config?.publicMoney !== false)

    const liveScores = $derived(
        isEndOfGame ? calculateScores(state.board) : calculateLiveScores(state.board)
    )

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id

    const projectedOverseerId = $derived(session.projectedOverseerId)
    const previousOverseerId = $derived(session.previousOverseerHoldoverId)

    // Panels always sit in fixed seat order — no phase reshuffles them, including
    // planting's bid-based plantersOrder. Whose turn it is is conveyed by the active-player
    // highlight, not by moving rows around.
    const sortedPlayers = $derived(
        state.seatOrder
            .map(id => state.players.find(p => p.playerId === id))
            .filter(p => p !== undefined)
    )
</script>

<div class="flex flex-col gap-2.5 py-2.5">
    {#each sortedPlayers as p (p.playerId)}
        {@const isActive = state.activePlayerIds.includes(p.playerId)}
        {@const isMe = p.playerId === myId}
        {@const isOverseer = projectedOverseerId === p.playerId}
        {@const isPreviousOverseer = previousOverseerId === p.playerId}
        {@const color = session.colors.getPlayerUiColor(p.playerId)}
        {@const textColor = session.colors.getPlayerTextColor(p.playerId)}
        {@const passedPersonalCanal = state.machineState === MachineState.ExtraIrrigation &&
            p.hasPersonalCanal && state.extraIrrigationPassed.includes(p.playerId)}
        {@const nameShadow = textColor === 'text-black'
            ? '0 1px 0 rgba(255,255,255,0.5)'
            : '0 1px 2px rgba(0,0,0,0.6)'}
        <div
            class="paper-texture rounded-lg overflow-hidden {isActive ? 'border-[5px] pulse-border' : 'border-[5px]'}"
            style={isActive ? '' : `border-color: ${color}`}
        >
            <!-- Colored name bar -->
            <div class="font-heading px-[10px] py-[7px] flex items-center gap-[7px] font-bold uppercase tracking-widest {textColor} text-[15px]"
                 style="background-color: {color}">
                <span class="truncate min-w-0 flex-1 text-[18px]" style="text-shadow: {nameShadow}">{playerName(p.playerId)}</span>
                {#if isOverseer}
                    <span class="text-[13px] bg-black/30 text-white px-1.5 py-[3px] rounded font-normal shrink-0 normal-case tracking-normal">Overseer</span>
                {:else if isPreviousOverseer}
                    <span class="text-[13px] bg-black/30 text-white px-1.5 py-[3px] rounded font-normal shrink-0 normal-case tracking-normal opacity-70">Previous Overseer</span>
                {/if}
                {#if isPlanting && p.bid !== undefined}
                    <span class="ml-auto shrink-0 flex items-center gap-1">
                        <span class="font-ui text-[9px] uppercase tracking-wide opacity-70">Bid</span>
                        <MoneyBadge amount={p.bid} />
                    </span>
                {/if}
            </div>
            <!-- Dark content area -->
            <div class="px-3 py-2.5 bg-stone-800 flex justify-between items-center text-lg text-white">
                <span class="text-green-300">⭐ {isEndOfGame ? p.score : (liveScores[p.playerId] ?? 0)}</span>
                <div class="flex flex-col items-center gap-0">
                    <div class="relative">
                        <CanalIcon dim={!p.hasPersonalCanal} />
                        {#if passedPersonalCanal}
                            <span class="absolute inset-0 flex items-center justify-center leading-none text-[14px] uppercase tracking-wide text-white/70"
                                  style="text-shadow: 0 1px 2px rgba(0,0,0,0.85); transform: translateY(-4px)">Passed</span>
                        {/if}
                    </div>
                    {#if p.hasPersonalCanal}
                        <span class="font-ui -mt-1 text-[10px] text-stone-400 uppercase tracking-wide whitespace-nowrap">Personal canal</span>
                    {/if}
                </div>
                <MoneyBadge amount={p.money} hidden={!isMe && !publicMoney && !isEndOfGame} />
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
