<script lang="ts">
    import type { Snippet } from 'svelte'
    import Dirhams from '$lib/components/Dirhams.svelte'
    import { type Player } from '@tabletop/common'
    import {
        AntiquesPerPlayer,
        MarketColor,
        antiqueSetPayout,
        paidAntiques,
        type HydratedMarracashPlayerState
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import PlayerBadge from '$lib/components/PlayerBadge.svelte'
    import HiddenAntiques from '$lib/components/HiddenAntiques.svelte'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import {
        completedSetLabel,
        missingAntiquesSummary,
        sortedAntiques
    } from '$lib/utils/antiqueItems.js'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()

    const CounterPawnHeight = 18
    const Places = ['1st', '2nd', '3rd', '4th']

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
    let isMine = $derived(player.id === gameSession.myPlayer?.id)
    let setPayout = $derived(antiqueSetPayout(playerState.revealedAntiques, revealRank))
</script>

{#snippet revealedSet()}
    {#each revealedCards as card, index (index)}
        <AntiqueCard {card} matched dimmed={!paidCards.includes(card)} />
    {/each}
{/snippet}

{#snippet cardRow(cards: Snippet, summary: Snippet)}
    <div class="mt-2 flex items-center justify-between gap-1.5">
        {#if isMine}
            <button
                type="button"
                class="flex cursor-pointer gap-1.5"
                aria-expanded={showHandSummary}
                onclick={() => (showHandSummary = !showHandSummary)}
            >
                {@render cards()}
            </button>
        {:else}
            <div class="flex gap-1.5">{@render cards()}</div>
        {/if}
        <p class="text-right text-[11px] leading-tight whitespace-nowrap">{@render summary()}</p>
    </div>
{/snippet}

{#snippet handRow()}
    {#each hand as entry, index (index)}
        <AntiqueCard card={entry.card} matched={entry.covered} />
    {/each}
{/snippet}

{#snippet handProgress()}
    antiques<br />{hand.filter((entry) => entry.covered).length}/{AntiquesPerPlayer}
{/snippet}

{#snippet setResult()}
    {Places[revealRank]} set<br /><span class="marracash-display text-[#e8c25c]"
        >+<Dirhams amount={setPayout} /></span
    >
{/snippet}

<div
    class="zellige-panel rounded-xl border-2 border-[#c9a14a] p-2.5 text-left text-[#f3e6c8]"
    class:pulse-border={isTurn}
>
    <div class="flex gap-2.5">
        <PlayerBadge playerId={player.id} {shopCount} />
        <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
                <h1 class="marracash-display truncate text-lg">{player.name}</h1>
                {#if money === undefined}
                    <span class="text-sm whitespace-nowrap italic">Cash hidden</span>
                {:else}
                    <span class="marracash-display text-lg whitespace-nowrap text-[#e8c25c]"
                        ><Dirhams amount={money} /></span
                    >
                {/if}
            </div>
            <div class="mt-1.5 flex items-center justify-between rounded-md bg-black/25 px-2 py-1">
                {#each Object.values(MarketColor) as color (color)}
                    <span
                        role="button"
                        tabindex="0"
                        aria-pressed={gameSession.customerHighlight?.playerId === player.id &&
                            gameSession.customerHighlight?.color === color}
                        class="flex items-center gap-0.5"
                        aria-label="{customers[color]} {color} customers"
                        use:hoverOrTap={{
                            hover: (active) =>
                                gameSession.highlightCustomers(
                                    active ? { playerId: player.id, color } : undefined
                                ),
                            tap: () =>
                                gameSession.toggleCustomerHighlight({ playerId: player.id, color })
                        }}
                    >
                        <PawnIcon {color} height={CounterPawnHeight} />
                        <span
                            class="inline-block w-[2ch] text-sm font-semibold tabular-nums"
                            class:text-[#8fb3b0]={customers[color] === 0}>{customers[color]}</span
                        >
                    </span>
                {/each}
            </div>
        </div>
    </div>
    {#if gameSession.gameState.antiqueCards}
        {#if playerState.revealedAntiques.length > 0}
            {@render cardRow(revealedSet, setResult)}
            {#if isMine && showHandSummary}
                <p class="mt-1 text-xs">{completedSetLabel(revealRank)}</p>
            {/if}
        {:else if isMine && playerState.antiques.length > 0}
            {@render cardRow(handRow, handProgress)}
            {#if showHandSummary}
                <p class="mt-1 text-xs">{missingAntiquesSummary(hand)}</p>
            {/if}
        {:else}
            <div class="mt-1.5 flex items-center gap-2">
                <HiddenAntiques count={AntiquesPerPlayer} />
                <p class="text-xs text-[#d9c9a3] italic">{AntiquesPerPlayer} hidden antiques</p>
            </div>
        {/if}
    {/if}
    {#if gameSession.showDebug}
        <div class="mt-1 text-xs">id: {player.id}</div>
    {/if}
</div>

<style>
    .zellige-panel {
        background-color: #1f4c53;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='1'%3E%3Cpath d='M14 2 L17 11 L26 14 L17 17 L14 26 L11 17 L2 14 L11 11 Z'/%3E%3Cpath d='M0 0 L5 5 M28 0 L23 5 M0 28 L5 23 M28 28 L23 23'/%3E%3C/g%3E%3C/svg%3E");
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

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

    @media (prefers-reduced-motion: reduce) {
        .pulse-border {
            animation: none;
        }
    }
</style>
