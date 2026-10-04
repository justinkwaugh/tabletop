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
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
    import {
        completedSetLabel,
        missingAntiquesSummary,
        sortedAntiques
    } from '$lib/utils/antiqueItems.js'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()

    const CounterPawnHeight = 20

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let customers = $derived(gameSession.gameState.customersByColor(player.id))
    let shopCount = $derived(gameSession.gameState.ownedShopCount(player.id))
    let revealRank = $derived(gameSession.gameState.antiqueRevealOrder.indexOf(player.id))
    let paidCards = $derived(paidAntiques(playerState.revealedAntiques, revealRank))
    let handCards = $derived(sortedAntiques(playerState.antiques))
    let revealedCards = $derived(sortedAntiques(playerState.revealedAntiques))
    let hand = $derived(antiqueProgress(handCards, customers))
    let money = $derived(gameSession.visibleMoney(player.id))
    let showHandSummary = $state(false)
</script>

{#snippet revealedSet()}
    {#each revealedCards as card, index (index)}
        <AntiqueCard {card} matched dimmed={!paidCards.includes(card)} />
    {/each}
{/snippet}

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
        {#if money === undefined}
            <span class="marracash-display text-sm">Cash hidden</span>
        {:else}
            <span class="whitespace-nowrap">
                <span class="marracash-display text-xl">{money}</span>
                <span class="text-xs">Dirham</span>
            </span>
        {/if}
    </div>
    <div class="flex items-center justify-between gap-2 text-xs">
        <span>Customers:</span>
        <span>Shops: {shopCount}/{MaxShopsPerPlayer}</span>
    </div>
    <div class="flex w-fit items-center gap-1 rounded bg-white/85 px-1 py-0.5 text-xs text-black">
        {#each Object.values(MarketColor) as color (color)}
            <span
                role="button"
                tabindex="0"
                aria-pressed={gameSession.customerHighlight?.playerId === player.id &&
                    gameSession.customerHighlight?.color === color}
                class="flex items-center gap-0.5"
                class:opacity-35={customers[color] === 0}
                aria-label="{customers[color]} {color} customers"
                onpointerenter={(event) =>
                    event.pointerType !== 'touch' &&
                    gameSession.highlightCustomers({ playerId: player.id, color })}
                onpointerleave={(event) =>
                    event.pointerType !== 'touch' && gameSession.highlightCustomers(undefined)}
                onclick={() =>
                    gameSession.usesTouch &&
                    gameSession.toggleCustomerHighlight({ playerId: player.id, color })}
                onkeydown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    gameSession.toggleCustomerHighlight({ playerId: player.id, color })
                }}
            >
                <PawnIcon {color} height={CounterPawnHeight} />
                <span class="inline-block w-[2ch] text-sm font-semibold tabular-nums"
                    >{customers[color]}</span
                >
            </span>
        {/each}
    </div>
    {#if gameSession.gameState.antiqueCards}
        <div class="mt-1 text-xs">
            {#if playerState.revealedAntiques.length > 0}
                <p class="font-semibold">
                    Antique set completed {['1st', '2nd', '3rd', '4th'][revealRank]}
                </p>
                {#if player.id === gameSession.myPlayer?.id}
                    <button
                        type="button"
                        class="flex cursor-pointer gap-1 rounded bg-white/85 p-1"
                        aria-expanded={showHandSummary}
                        onclick={() => (showHandSummary = !showHandSummary)}
                    >
                        {@render revealedSet()}
                    </button>
                    {#if showHandSummary}
                        <p class="mt-0.5">{completedSetLabel(revealRank)}</p>
                    {/if}
                {:else}
                    <div class="flex gap-1 rounded bg-white/85 p-1">{@render revealedSet()}</div>
                {/if}
            {:else if player.id === gameSession.myPlayer?.id && playerState.antiques.length > 0}
                <p class="font-semibold">
                    Antiques: {hand.filter((entry) => entry.covered).length}/{AntiquesPerPlayer}
                </p>
                <button
                    type="button"
                    class="flex cursor-pointer gap-1 rounded bg-white/85 p-1"
                    aria-expanded={showHandSummary}
                    onclick={() => (showHandSummary = !showHandSummary)}
                >
                    {#each hand as entry, index (index)}
                        <AntiqueCard card={entry.card} matched={entry.covered} />
                    {/each}
                </button>
                {#if showHandSummary}
                    <p class="mt-0.5">{missingAntiquesSummary(hand)}</p>
                {/if}
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
