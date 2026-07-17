<script lang="ts">
    import { MachineState } from '@tabletop/santiago'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const session = getGameSession()

    const state = $derived(session.gameState)
    const machineState = $derived(state.machineState)

    const currentActorName = $derived.by(() => {
        if (machineState === MachineState.PlantingPhase) {
            const id = state.plantersOrder[state.planterIndex]
            return session.game?.players.find((p) => p.id === id)?.name ?? id
        }
        if (machineState === MachineState.CanalBuilding) {
            const id = state.canalOverseerId
            return id ? (session.game?.players.find((p) => p.id === id)?.name ?? id) : '?'
        }
        return undefined
    })

    const isOverseerDecisionPhase = $derived(
        machineState === MachineState.CanalBuilding &&
        state.canalProposalIndex >= (state.canalProposalOrder?.length ?? 0)
    )

    const canalProposals = $derived(
        machineState === MachineState.CanalBuilding ? (state.canalProposals ?? []) : []
    )

    const currentProposerName = $derived.by(() => {
        if (machineState !== MachineState.CanalBuilding) return undefined
        if (isOverseerDecisionPhase) return undefined
        const id = state.canalProposalOrder?.[state.canalProposalIndex]
        return session.game?.players.find((p) => p.id === id)?.name ?? id
    })

    const currentBidderName = $derived.by(() => {
        if (machineState !== MachineState.Bidding) return undefined
        const id = state.biddingOrder[state.currentBidderIndex]
        return session.game?.players.find((p) => p.id === id)?.name ?? id
    })

    const playerName = (id: string) =>
        session.game?.players.find((p) => p.id === id)?.name ?? id

    const placedBids = $derived.by(() => {
        if (machineState !== MachineState.Bidding) return []
        return state.players
            .filter((p) => p.bid !== undefined)
            .map((p) => ({ name: playerName(p.playerId), bid: p.bid! }))
    })

    const revealedTiles = $derived(
        machineState === MachineState.Bidding ? state.revealedTiles ?? [] : []
    )
</script>

<div class="paper-texture bg-stone-800/80 rounded-xl p-4 text-white text-center space-y-1 min-w-48">
    {#if machineState === MachineState.SpringPlacement}
        {@const firstId = state.seatOrder[0]}
        {@const firstName = session.game?.players.find(p => p.id === firstId)?.name ?? firstId}
        <p class="text-amber-300 font-semibold">Spring Placement</p>
        <p class="text-sm text-stone-300">Waiting for <span class="text-white font-medium">{firstName}</span> to place the spring…</p>
    {:else if machineState === MachineState.Bidding}
        <p class="text-amber-300 font-semibold">Bidding</p>
        <p class="text-sm text-stone-300">Waiting for <span class="text-white font-medium">{currentBidderName}</span> to bid…</p>

        {#if revealedTiles.length > 0}
            <div class="border-t border-stone-600 pt-2 space-y-1">
                <p class="text-xs text-stone-400 uppercase tracking-wide">This round's tiles</p>
                <div class="flex flex-wrap gap-1">
                    {#each revealedTiles as tile, i}
                        <div class="flex flex-col items-center bg-stone-700 rounded px-2 py-1 text-xs min-w-14">
                            <span class="text-stone-400">#{i + 1}</span>
                            <span class="font-bold capitalize text-white">{tile.crop}</span>
                            <span class="text-stone-300">{tile.farmerCapacity}🧑‍🌾</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        {#if placedBids.length > 0}
            <div class="text-xs space-y-0.5 border-t border-stone-600 pt-2 text-left">
                <p class="text-stone-400 uppercase tracking-wide">Bids placed</p>
                {#each placedBids as { name, bid }}
                    <div class="flex justify-between text-stone-300">
                        <span>{name}</span><span class="font-bold text-white">{bid}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {:else if machineState === MachineState.PlantingPhase}
        <p class="text-amber-300 font-semibold">Planting</p>
        <p class="text-sm text-stone-300">{currentActorName} is planting…</p>
    {:else if machineState === MachineState.CanalBuilding}
        {#if isOverseerDecisionPhase}
            <p class="text-amber-300 font-semibold">Overseer Deciding</p>
            <p class="text-sm text-stone-300">
                <span class="text-white font-medium">{currentActorName}</span> is choosing where to build…
            </p>
            {#if canalProposals.length > 0}
                <div class="text-xs space-y-0.5 border-t border-stone-600 pt-2">
                    <p class="text-stone-400 uppercase tracking-wide">All proposals</p>
                    {#each canalProposals as p}
                        <div class="flex justify-between text-stone-300">
                            <span>{session.game?.players.find(g => g.id === p.playerId)?.name ?? p.playerId}</span>
                            <span class="text-amber-300">{p.amount} esc</span>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-xs text-stone-400">No proposals were made.</p>
            {/if}
        {:else}
            <p class="text-amber-300 font-semibold">Canal Proposals</p>
            {#if currentProposerName}
                <p class="text-sm text-stone-300">Waiting for <span class="text-white font-medium">{currentProposerName}</span> to propose…</p>
            {/if}
            {#if canalProposals.length > 0}
                <div class="text-xs space-y-0.5 border-t border-stone-600 pt-2">
                    {#each canalProposals as p}
                        <div class="flex justify-between text-stone-300">
                            <span>{session.game?.players.find(g => g.id === p.playerId)?.name ?? p.playerId}</span>
                            <span class="text-amber-300">{p.amount} esc</span>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    {:else if machineState === MachineState.ExtraIrrigation}
        <p class="text-amber-300 font-semibold">Personal Canal Phase</p>
        {@const currentId = state.extraIrrigationOrder?.[state.extraIrrigationIndex]}
        {@const currentName = session.game?.players.find(p => p.id === currentId)?.name ?? currentId}
        {#if currentId}
            <p class="text-sm text-stone-300">Waiting for <span class="text-white font-medium">{currentName}</span>…</p>
        {/if}
        <div class="text-xs text-stone-400 space-y-0.5 pt-1">
            {#each state.players as p}
                <div class="flex justify-between">
                    <span>{session.game?.players.find(g => g.id === p.playerId)?.name ?? p.playerId}</span>
                    <span>{p.hasPersonalCanal ? '🔵 available' : '✓ used'}</span>
                </div>
            {/each}
        </div>
    {:else if machineState === MachineState.EndOfGame}
        <p class="text-green-400 font-semibold text-lg">Game Over</p>
    {/if}
</div>
