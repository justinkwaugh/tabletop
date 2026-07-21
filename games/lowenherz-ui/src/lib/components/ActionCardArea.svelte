<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'
    import ActionCard from './ActionCard.svelte'
    import actionBack from '$lib/images/action-cards/backs/back-a.jpg'

    const gameSession = getGameSession()
    const actionState = $derived(gameSession.gameState)
    const card = $derived(actionState.currentActionCard)

    let offerAmount = $state(0)
    let bidAmount = $state(0)
    let bidTreasureCardId = $state<string | undefined>(undefined)

    function playerName(playerId: string): string {
        return gameSession.game.players.find((p) => p.id === playerId)?.name ?? playerId
    }

    function decisionsForSlot(slot: 1 | 2 | 3): string[] {
        return actionState.decisions.filter((d) => d.slot === slot).map((d) => d.playerId)
    }

    function resolvedWinnerFor(slot: 1 | 2 | 3): { resolved: boolean; winnerPlayerId?: string } {
        const resolved = actionState.resolvedSlots.find((r) => r.slot === slot)
        return resolved ? { resolved: true, winnerPlayerId: resolved.winnerPlayerId } : { resolved: false }
    }

    const slots: { slot: 1 | 2 | 3; label: string }[] = [
        { slot: 1, label: 'Top' },
        { slot: 2, label: 'Middle' },
        { slot: 3, label: 'Bottom' }
    ]
</script>

{#if actionState.machineState !== MachineState.PlacingCastles && actionState.machineState !== MachineState.PlacingWalls && actionState.machineState !== MachineState.PlacingKnights && actionState.machineState !== MachineState.EndOfGame}
    <div class="mt-2">
        <button
            type="button"
            class="px-2 py-1 rounded border border-dashed border-black/40 text-black/70 text-xs hover:bg-black/10"
            onclick={() => gameSession.autoAdvanceToActionEffect()}
        >
            Fast-forward to wall/knight placement (testing)
        </button>
    </div>
{/if}

{#if actionState.machineState === MachineState.EndOfGame}
    <div class="text-black text-lg font-semibold mt-4">The King is dead! The game is over.</div>
{:else if actionState.machineState === MachineState.StartOfTurn}
    <div class="flex items-center gap-3 mt-4">
        <img src={actionBack} alt="Action draw pile" class="w-20 rounded-md shadow-md" />
        {#if gameSession.canDrawActionCard}
            <button
                class="px-3 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-black font-semibold transition-colors"
                onclick={() => gameSession.drawActionCard()}
            >
                Flip next card
            </button>
        {:else}
            <span class="text-black text-sm">Waiting for the first player to flip the next card...</span>
        {/if}
    </div>
{:else if card && card.type === 'standard'}
    <div class="flex items-start gap-6 mt-4">
        <div class="w-40 shrink-0">
            <ActionCard {card} />
        </div>
        <div class="flex flex-col gap-2 text-black text-sm min-w-[280px]">
            {#each slots as { slot, label } (slot)}
                {@const pickers = decisionsForSlot(slot)}
                {@const isMoneyBag = slot === 1 && card.top.kind === 'income'}
                {@const winnerInfo = resolvedWinnerFor(slot)}
                <div class="flex items-center gap-2">
                    <button
                        class="w-20 shrink-0 px-2 py-1 rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black/10"
                        disabled={!gameSession.canChooseAction}
                        onclick={() => gameSession.chooseAction(slot)}
                    >
                        {label}
                    </button>
                    <span>
                        {#if isMoneyBag && winnerInfo.resolved}
                            <span class="text-green-800">
                                Money bag split among {pickers.map(playerName).join(', ') || 'no one'}
                            </span>
                        {:else if winnerInfo.resolved}
                            {#if winnerInfo.winnerPlayerId}
                                <span class="text-green-800 font-semibold">
                                    {playerName(winnerInfo.winnerPlayerId)} won this
                                </span>
                            {:else}
                                <span class="text-black/50">no one performs this</span>
                            {/if}
                        {:else if actionState.negotiation?.slot === slot}
                            <span class="text-amber-700 font-semibold">negotiating...</span>
                        {:else if actionState.duel?.slot === slot}
                            <span class="text-amber-700 font-semibold">dueling...</span>
                        {:else if pickers.length === 0}
                            <span class="text-black/50">unclaimed</span>
                        {:else}
                            {pickers.map(playerName).join(', ')}
                            {#if pickers.length > 1}
                                <span class="text-red-700 font-semibold"> (tied!)</span>
                            {/if}
                        {/if}
                    </span>
                </div>
            {/each}

            {#if actionState.machineState === MachineState.ChoosingActions}
                <span class="mt-1">
                    {#if gameSession.canChooseAction}
                        Your turn — pick which action you want.
                    {:else}
                        Waiting for the next player to choose...
                    {/if}
                </span>
            {:else if actionState.machineState === MachineState.Negotiating && actionState.negotiation}
                <div class="mt-2 border-t border-black/20 pt-2 flex flex-col gap-1">
                    <span class="font-semibold">
                        Negotiating slot {actionState.negotiation.slot}: {playerName(actionState.negotiation.playerIds[0])}
                        vs {playerName(actionState.negotiation.playerIds[1])}
                    </span>
                    {#if actionState.negotiation.offer}
                        <span>
                            Standing offer: {playerName(actionState.negotiation.offer.fromPlayerId)} pays
                            {actionState.negotiation.offer.amount} ducats for the right to perform this action.
                        </span>
                    {:else}
                        <span>No offer yet.</span>
                    {/if}

                    {#if gameSession.isMyNegotiationTurn}
                        <div class="flex items-center gap-2 mt-1">
                            <input
                                type="number"
                                min="0"
                                bind:value={offerAmount}
                                class="w-16 rounded border border-black/30 px-1 py-0.5"
                            />
                            <button
                                class="px-2 py-1 rounded bg-black/10 hover:bg-black/20 font-semibold"
                                onclick={() => gameSession.makeOffer(offerAmount)}
                            >
                                Offer
                            </button>
                            {#if actionState.negotiation.offer}
                                <button
                                    class="px-2 py-1 rounded bg-green-700/20 hover:bg-green-700/30 font-semibold"
                                    onclick={() => gameSession.acceptOffer()}
                                >
                                    Accept
                                </button>
                            {/if}
                            <button
                                class="px-2 py-1 rounded bg-red-700/10 hover:bg-red-700/20 font-semibold"
                                onclick={() => gameSession.declineNegotiation()}
                            >
                                Force a duel
                            </button>
                        </div>
                    {:else}
                        <span class="text-black/70">
                            Waiting for {playerName(actionState.negotiation.turnPlayerId)}...
                        </span>
                    {/if}
                </div>
            {:else if actionState.machineState === MachineState.Dueling && actionState.duel}
                <div class="mt-2 border-t border-black/20 pt-2 flex flex-col gap-1">
                    <span class="font-semibold">
                        Dueling slot {actionState.duel.slot}: {actionState.duel.playerIds.map(playerName).join(', ')}
                    </span>
                    <span>
                        Bids submitted: {actionState.duel.bids.length} / {actionState.duel.playerIds.length}
                        {#if actionState.duel.bids.length > 0}
                            ({actionState.duel.bids
                                .map((b) => playerName(b.playerId))
                                .join(', ')})
                        {/if}
                    </span>

                    {#if gameSession.canSubmitDuelBid}
                        <div class="flex items-center gap-2 mt-1">
                            <input
                                type="number"
                                min="0"
                                bind:value={bidAmount}
                                class="w-16 rounded border border-black/30 px-1 py-0.5"
                            />
                            {#if gameSession.myTreasureCards.length > 0}
                                <span>ducats +</span>
                                <select
                                    bind:value={bidTreasureCardId}
                                    class="rounded border border-black/30 px-1 py-0.5"
                                >
                                    <option value={undefined}>no Treasure card</option>
                                    {#each gameSession.myTreasureCards as treasureCard (treasureCard.id)}
                                        <option value={treasureCard.id}>Treasure ({treasureCard.value})</option>
                                    {/each}
                                </select>
                            {/if}
                            <button
                                class="px-2 py-1 rounded bg-black/10 hover:bg-black/20 font-semibold"
                                onclick={() => {
                                    gameSession.submitDuelBid(bidAmount, bidTreasureCardId)
                                    bidTreasureCardId = undefined
                                }}
                            >
                                Submit bid
                            </button>
                        </div>
                    {:else}
                        <span class="text-black/70">Waiting for the other duelist(s) to bid...</span>
                    {/if}
                </div>
            {:else if actionState.machineState === MachineState.PlacingWalls}
                <span class="mt-1 text-black/70">
                    {playerName(actionState.wallPlacingPlayerId ?? '')} is placing walls on the
                    board above ({actionState.wallsRemaining} left).
                </span>
            {:else if actionState.machineState === MachineState.PlacingKnights}
                <span class="mt-1 text-black/70">
                    {playerName(actionState.knightPlacingPlayerId ?? '')} is placing knights on
                    the board above ({actionState.knightsRemaining} left).
                </span>
            {:else}
                <span class="mt-1 text-black/70">
                    Resolving... region expansion and politics-card effects aren't built
                    yet — stay tuned.
                </span>
            {/if}
        </div>
    </div>
{/if}
