<script lang="ts">
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
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

    // Once bidding resolves, plantersOrder is set for the rest of the round — show the
    // planting phase's panels in that fixed order (no reshuffling to the current
    // planter), since it's more informative than turn-chasing once bids are no longer
    // in play. Canal building and personal canal placement have their own dedicated
    // orders below; only SpringPlacement falls through to the active-player rotation
    // further down.
    const sortedPlayers = $derived.by(() => {
        const inOrder = state.seatOrder
            .map(id => state.players.find(p => p.playerId === id))
            .filter(p => p !== undefined)

        const usesPlantersOrder =
            state.machineState !== MachineState.SpringPlacement &&
            state.machineState !== MachineState.Bidding &&
            state.machineState !== MachineState.ExtraIrrigation &&
            state.machineState !== MachineState.CanalBuilding &&
            state.plantersOrder.length > 0
        if (usesPlantersOrder) {
            return state.plantersOrder
                .map(id => state.players.find(p => p.playerId === id))
                .filter(p => p !== undefined)
        }

        // Canal building: canalProposalOrder as-is (clockwise from the overseer's
        // neighbor, overseer already excluded by the engine), with the overseer pinned
        // to the very bottom. Per Justin, this doesn't reshuffle to bring the current
        // briber to the top — it just walks down the list in that fixed order.
        if (state.machineState === MachineState.CanalBuilding && state.canalProposalOrder.length > 0) {
            const mapped = state.canalProposalOrder
                .map(id => state.players.find(p => p.playerId === id))
                .filter(p => p !== undefined)
            const overseerId = state.canalOverseerId
            const overseer = overseerId ? state.players.find(p => p.playerId === overseerId) : undefined
            return overseer ? [...mapped, overseer] : mapped
        }

        // Personal canal placement (Phase 5) has its own turn order — clockwise starting
        // with the player to the right of the overseer, tracked separately in
        // extraIrrigationOrder rather than plantersOrder. Shown as-is (no reshuffling to
        // the current player), per Justin.
        if (state.machineState === MachineState.ExtraIrrigation && state.extraIrrigationOrder.length > 0) {
            return state.extraIrrigationOrder
                .map(id => state.players.find(p => p.playerId === id))
                .filter(p => p !== undefined)
        }

        // While bidding, show players in their permanent seat order — no reshuffling to
        // bring the active bidder to the top, per Justin.
        if (state.machineState === MachineState.Bidding) {
            let ordered = inOrder

            // Bids of 0 are the only ones that can tie (non-zero bids must be unique) —
            // the overseer wins that tie (lowest bid, earliest in biddingOrder), so they
            // should lead the tied group rather than fall wherever seat order happens to
            // put them. Seat order still governs the rest of that group relative to
            // each other.
            const overseerId = projectedOverseerId
            const zeroBidders = ordered.filter(p => p.bid === 0)
            if (overseerId && zeroBidders.length > 1 && zeroBidders[0].playerId !== overseerId) {
                const overseer = ordered.find(p => p.playerId === overseerId)
                if (overseer) {
                    ordered = ordered.filter(p => p.playerId !== overseerId)
                    const insertAt = ordered.findIndex(p => p.bid === 0)
                    ordered.splice(insertAt, 0, overseer)
                }
            }
            return ordered
        }

        // Only SpringPlacement reaches here now (Bidding, PlantingPhase, CanalBuilding,
        // and ExtraIrrigation are all handled above). Rotates the list so the active
        // player is always shown first — except in hotseat, where everyone shares one screen and panels
        // reordering every turn is disorienting rather than helpful, so seat order stays
        // fixed there. The one exception: the (projected) overseer goes to the bottom
        // rather than the top, so the game doesn't open with the overseer sitting first.
        if (session.game?.hotseat) {
            const overseerId = session.projectedOverseerId
            const overseer = overseerId ? inOrder.find(p => p.playerId === overseerId) : undefined
            if (!overseer) return inOrder
            return [...inOrder.filter(p => p.playerId !== overseerId), overseer]
        }
        const activeId = state.activePlayerIds[0]
        const idx = activeId ? inOrder.findIndex(p => p.playerId === activeId) : -1
        if (idx <= 0) return inOrder
        return [...inOrder.slice(idx), ...inOrder.slice(0, idx)]
    })
</script>

<div class="flex flex-col gap-2.5 py-2.5">
    {#each sortedPlayers as p (p.playerId)}
        {@const isActive = state.activePlayerIds.includes(p.playerId)}
        {@const isMe = p.playerId === myId}
        {@const isOverseer = projectedOverseerId === p.playerId}
        {@const color = session.colors.getPlayerUiColor(p.playerId)}
        {@const textColor = session.colors.getPlayerTextColor(p.playerId)}
        {@const passedPersonalCanal = state.machineState === MachineState.ExtraIrrigation &&
            p.hasPersonalCanal && state.extraIrrigationPassed.includes(p.playerId)}
        {@const seatNumber = state.seatOrder.indexOf(p.playerId) + 1}
        <div
            class="paper-texture rounded-lg overflow-hidden {isActive ? 'border-[5px] pulse-border' : 'border-[5px]'}"
            style={isActive ? '' : `border-color: ${color}`}
            animate:flip={{ duration: 320, easing: cubicOut }}
        >
            <!-- Colored name bar -->
            <div class="font-heading px-[10px] py-[7px] flex items-center gap-[7px] font-bold uppercase tracking-widest {textColor} text-[15px]"
                 style="background-color: {color}">
                <div class="w-[34px] h-[34px] flex flex-col items-center justify-center gap-[2px] rounded bg-black/30 text-white normal-case shrink-0">
                    <span class="font-ui text-[8px] uppercase tracking-wide opacity-70 leading-none">Seat</span>
                    <span class="text-[14px] font-bold leading-none">{seatNumber}</span>
                </div>
                <span class="truncate min-w-0 flex-1 text-[18px]">{playerName(p.playerId)}</span>
                {#if isOverseer}
                    <span class="text-[13px] bg-black/30 text-white px-1.5 py-[3px] rounded font-normal shrink-0 normal-case tracking-normal">Overseer</span>
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
                <MoneyBadge amount={p.money} hidden={!isMe && !publicMoney && !isEndOfGame} />
                <span class="text-green-300">⭐ {isEndOfGame ? p.score : (liveScores[p.playerId] ?? 0)}</span>
                <div class="flex flex-col items-center gap-0">
                    <div class="relative">
                        <CanalIcon dim={!p.hasPersonalCanal} />
                        {#if passedPersonalCanal}
                            <span class="absolute inset-0 flex items-center justify-center leading-none text-[14px] uppercase tracking-wide text-white/70"
                                  style="text-shadow: 0 1px 2px rgba(0,0,0,0.85); transform: translateY(-4px)">Passed</span>
                        {/if}
                    </div>
                    <span class="font-ui -mt-1 text-[10px] text-stone-400 uppercase tracking-wide whitespace-nowrap">Personal canal</span>
                </div>
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
