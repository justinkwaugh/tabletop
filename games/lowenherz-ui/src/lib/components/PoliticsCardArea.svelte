<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PlayerName } from '@tabletop/frontend-components'
    import { PoliticsCardType } from '@tabletop/lowenherz'
    import PoliticsCard from './PoliticsCard.svelte'

    const gameSession = getGameSession()

    const pileA = $derived(gameSession.gameState.politicsCardPileA)
    const pileB = $derived(gameSession.gameState.politicsCardPileB)
    const myPoliticsCards = $derived(
        gameSession.myPlayer ? gameSession.gameState.getPlayerState(gameSession.myPlayer.id).politicsCards : []
    )

    // While it's my turn and I haven't picked a pile yet, either one is selectable -
    // the rulebook lets you look through just one, so once picked, neither stays
    // clickable (see the surrounding markup).
    const canSelectAPile = $derived(gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile)

    function playerIdForColor(color: string): string | undefined {
        return gameSession.gameState.players.find((p) => p.color === color)?.playerId
    }
</script>

<div class="flex flex-col gap-2">
    {#if gameSession.canTakePoliticsCard}
        <div class="text-black text-sm">
            {#if !gameSession.selectedPoliticsPile}
                You won Crown and Scepter — click one of the piles below to look through it.
            {:else}
                Click a card to take it.
            {/if}
        </div>
    {/if}

    <div class="flex items-center gap-6">
        {#each [{ id: 'A' as const, cards: pileA }, { id: 'B' as const, cards: pileB }] as { id, cards } (id)}
            <div class="flex flex-col items-center gap-1">
                <button
                    type="button"
                    disabled={!canSelectAPile}
                    onclick={() => gameSession.selectPoliticsPile(id)}
                    class="w-16 {canSelectAPile ? 'cursor-pointer hover:brightness-95' : ''}"
                >
                    {#if cards.length > 0}
                        <PoliticsCard card={cards[0]} faceDown />
                    {:else}
                        <div
                            class="aspect-[534/832] rounded-md border border-dashed border-black/30 flex items-center justify-center text-black/40 text-xs"
                        >
                            empty
                        </div>
                    {/if}
                </button>
                <span class="text-black text-sm font-medium">Pile {id} ({cards.length})</span>
            </div>
        {/each}
    </div>

    {#if gameSession.selectedPoliticsPile}
        {@const chosenCards = gameSession.selectedPoliticsPile === 'A' ? pileA : pileB}
        <div class="flex flex-col gap-2">
            <div class="flex flex-wrap gap-2">
                {#each chosenCards as card (card.id)}
                    <button
                        type="button"
                        class="w-16 cursor-pointer hover:brightness-95"
                        onclick={() => gameSession.takePoliticsCard(gameSession.selectedPoliticsPile!, card.id)}
                    >
                        <PoliticsCard {card} />
                    </button>
                {/each}
            </div>
            <div>
                <button
                    type="button"
                    class="px-2 py-1 rounded bg-black/10 text-black text-sm hover:bg-black/20"
                    onclick={() => gameSession.cancelPoliticsPileSelection()}
                >
                    Cancel
                </button>
            </div>
        </div>
    {/if}

    {#if myPoliticsCards.length > 0}
        <div class="flex flex-col gap-1">
            <span class="text-black text-sm font-medium">Your politics cards</span>
            <div class="flex flex-wrap gap-2">
                {#each myPoliticsCards as card (card.id)}
                    <div class="w-16 flex flex-col items-center gap-1">
                        <PoliticsCard {card} />
                        {#if card.type === PoliticsCardType.Renegade && gameSession.canPlayRenegadeCard}
                            <button
                                type="button"
                                class="px-1.5 py-0.5 rounded bg-black/10 text-black text-xs hover:bg-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={gameSession.isPlayingRenegadeCard}
                                onclick={() => gameSession.startPlayingRenegadeCard(card.id)}
                            >
                                Play
                            </button>
                        {:else if card.type === PoliticsCardType.Alliance && gameSession.canPlayAllianceCard}
                            <button
                                type="button"
                                class="px-1.5 py-0.5 rounded bg-black/10 text-black text-xs hover:bg-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={gameSession.isPlayingAllianceCard}
                                onclick={() => gameSession.startPlayingAllianceCard(card.id)}
                            >
                                Play
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    {#if gameSession.myCancellableAlliances.length > 0}
        <div class="flex flex-col gap-1">
            <span class="text-black text-sm font-medium">Your alliances</span>
            <div class="flex flex-col gap-1">
                {#each gameSession.myCancellableAlliances as alliance (alliance.id)}
                    {@const otherPlayerId = playerIdForColor(alliance.otherColor)}
                    <div class="flex items-center gap-2 text-black text-sm">
                        <span>
                            Allied with
                            {#if otherPlayerId}
                                <PlayerName playerId={otherPlayerId} />
                            {:else}
                                a neutral prince
                            {/if}
                        </span>
                        <button
                            type="button"
                            class="px-1.5 py-0.5 rounded bg-black/10 text-black text-xs hover:bg-black/20"
                            onclick={() => gameSession.cancelAlliance(alliance.id)}
                        >
                            Cancel (10 ducats)
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>
