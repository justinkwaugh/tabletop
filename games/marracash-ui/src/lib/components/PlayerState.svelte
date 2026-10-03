<script lang="ts">
    import { type Player } from '@tabletop/common'
    import {
        AntiquesPerPlayer,
        MarketColor,
        MaxShopsPerPlayer,
        paidAntiques,
        type HydratedMarracashPlayerState
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import MarketSwatch from '$lib/components/MarketSwatch.svelte'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let customers = $derived(gameSession.gameState.customersByColor(player.id))
    let shopCount = $derived(gameSession.gameState.ownedShopCount(player.id))
    let revealRank = $derived(gameSession.gameState.antiqueRevealOrder.indexOf(player.id))
    let paidCards = $derived(paidAntiques(playerState.revealedAntiques, revealRank))
    let hand = $derived(antiqueProgress(playerState.antiques, customers))
    let money = $derived(gameSession.visibleMoney(player.id))
</script>

<div
    class="rounded-lg px-3 py-1 text-left"
    style:background-color={gameSession.colors.getPlayerBgColorValue(player.id)}
    style:color={gameSession.colors.getPlayerTextColorValue(player.id)}
    class:pulse-border={isTurn}
    class:border-2={isTurn}
>
    <div class="flex items-baseline justify-between gap-2">
        <h1 class="marracash-display {isTurn ? 'text-lg' : 'text-base'}">
            {isTurn ? '⇢ ' : ''}{player.name}
        </h1>
        <span class="marracash-display text-sm">
            {money === undefined ? 'Cash hidden' : `${money} Dirham`}
        </span>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>Shops {shopCount}/{MaxShopsPerPlayer}</span>
        <span class="flex items-center gap-1 rounded bg-white/85 px-1 text-black">
            {#each Object.values(MarketColor) as color (color)}
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <MarketSwatch {color} x={6} y={6} size={10} />
                </svg>
                <span class="mr-1 font-semibold" aria-label="{color} customers"
                    >{customers[color]}</span
                >
            {/each}
        </span>
    </div>
    {#if gameSession.gameState.antiqueCards}
        <div class="mt-1 text-xs">
            {#if playerState.revealedAntiques.length > 0}
                <p class="font-semibold">
                    Antique set completed {['1st', '2nd', '3rd', '4th'][revealRank]}
                </p>
                <div class="flex gap-1 rounded bg-white/85 p-1">
                    {#each playerState.revealedAntiques as card, index (index)}
                        <AntiqueCard {card} dimmed={!paidCards.includes(card)} />
                    {/each}
                </div>
            {:else if player.id === gameSession.myPlayer?.id && playerState.antiques.length > 0}
                <p class="font-semibold">
                    Your antiques: {hand.filter((entry) => entry.covered)
                        .length}/{AntiquesPerPlayer}
                    matched
                </p>
                <div class="flex gap-1 rounded bg-white/85 p-1">
                    {#each hand as entry, index (index)}
                        <AntiqueCard card={entry.card} dimmed={!entry.covered} />
                    {/each}
                </div>
            {:else}
                <p>{AntiquesPerPlayer} hidden antique cards</p>
            {/if}
        </div>
    {/if}
    {#if gameSession.showDebug}
        <div class="mt-1 text-xs">id: {player.id}</div>
    {/if}
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
