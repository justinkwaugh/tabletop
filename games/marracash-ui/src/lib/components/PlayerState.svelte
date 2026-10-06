<script lang="ts">
    import type { Snippet } from 'svelte'
    import { type Player } from '@tabletop/common'
    import {
        antiqueSetPayout,
        AntiquesPerPlayer,
        MaxShopsPerPlayer,
        paidAntiques,
        type HydratedMarracashPlayerState
    } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueCard from '$lib/components/AntiqueCard.svelte'
    import CustomerCounter from '$lib/components/CustomerCounter.svelte'
    import DirhamAmount from '$lib/components/DirhamAmount.svelte'
    import HiddenAntiques from '$lib/components/HiddenAntiques.svelte'
    import PlayerSign from '$lib/components/PlayerSign.svelte'
    import { antiqueProgress } from '$lib/utils/antiqueProgress.js'
    import { missingAntiquesSummary, sortedAntiques } from '$lib/utils/antiqueItems.js'
    import { shortOrdinal } from '$lib/utils/ordinal.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()

    let isTurn = $derived(gameSession.gameState.activePlayerIds.includes(player.id))
    let isMe = $derived(player.id === gameSession.myPlayer?.id)
    let shopCount = $derived(gameSession.gameState.ownedShopCount(player.id))
    let money = $derived(gameSession.visibleMoney(player.id))
    let revealRank = $derived(gameSession.gameState.antiqueRevealOrder.indexOf(player.id))
    let paidCards = $derived(paidAntiques(playerState.revealedAntiques, revealRank))
    let revealedCards = $derived(sortedAntiques(playerState.revealedAntiques))
    let hand = $derived(
        antiqueProgress(
            sortedAntiques(playerState.antiques),
            gameSession.gameState.customersByColor(player.id)
        )
    )
    let showHandSummary = $state(false)
</script>

{#snippet tally(label: string, value: Snippet)}
    <div class="ml-auto text-right text-xs leading-tight" style:color={PanelPalette.cream}>
        {label}<span class="mt-1 block" style:color={PanelPalette.gold}>{@render value()}</span>
    </div>
{/snippet}

{#snippet payout()}
    <span class="marracash-merchant payout"
        >+<DirhamAmount amount={antiqueSetPayout(playerState.revealedAntiques, revealRank)} /></span
    >
{/snippet}

{#snippet coveredCount()}
    <span class="marracash-merchant text-[15px]"
        >{hand.filter((entry) => entry.covered).length}/{AntiquesPerPlayer}</span
    >
{/snippet}

<div
    class="panel relative flex flex-wrap gap-1.5 rounded-lg p-2 px-2.5 text-left"
    class:turn={isTurn}
    style:--player={gameSession.colors.getPlayerBgColorValue(player.id)}
    style:--tile-light={PanelPalette.tileLight}
    style:--tile-deep={PanelPalette.tileDeep}
    style:--trim={PanelPalette.trim}
>
    <div class="flex w-[70px] shrink-0 flex-col items-center pt-0.5">
        <PlayerSign playerId={player.id} name={player.name} />
        <span
            class="marracash-merchant mt-0.5 text-center text-[12px] leading-none whitespace-nowrap"
            style:color={PanelPalette.gold}
            >{shopCount}/{MaxShopsPerPlayer}
            <span class="text-[10px] font-semibold tracking-wider" style:color={PanelPalette.cream}
                >SHOPS</span
            ></span
        >
    </div>

    <div class="min-w-0 flex-1 pt-0.5">
        <div class="flex items-baseline justify-between gap-2">
            <h1 class="marracash-merchant name truncate" style:color={PanelPalette.parchment}>
                {player.name}
            </h1>
            {#if money === undefined}
                <span class="text-sm whitespace-nowrap" style:color={PanelPalette.gold}
                    >Cash hidden</span
                >
            {:else}
                <span style:color={PanelPalette.gold}
                    ><DirhamAmount amount={money} class="marracash-merchant money" /></span
                >
            {/if}
        </div>
        <div class="mt-1"><CustomerCounter playerId={player.id} /></div>
    </div>

    {#if gameSession.gameState.antiqueCards}
        <div class="mt-1.5 basis-full pl-0.5">
            {#if revealRank >= 0}
                <div class="flex items-center gap-1">
                    {#each revealedCards as card, index (index)}
                        <AntiqueCard {card} covered unpaid={!paidCards.includes(card)} />
                    {/each}
                    {@render tally(`${shortOrdinal(revealRank)} set`, payout)}
                </div>
            {:else if isMe && hand.length > 0}
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        class="flex cursor-pointer gap-1"
                        aria-expanded={showHandSummary}
                        onclick={() => (showHandSummary = !showHandSummary)}
                    >
                        {#each hand as entry, index (index)}
                            <AntiqueCard card={entry.card} covered={entry.covered} />
                        {/each}
                    </button>
                    {@render tally('antiques', coveredCount)}
                </div>
                {#if showHandSummary}
                    <p class="mt-1 text-xs" style:color={PanelPalette.cream}>
                        {missingAntiquesSummary(hand)}
                    </p>
                {/if}
            {:else}
                <HiddenAntiques />
            {/if}
        </div>
    {/if}

    {#if gameSession.showDebug}
        <div class="basis-full text-xs" style:color={PanelPalette.cream}>id: {player.id}</div>
    {/if}
</div>

<style>
    .panel {
        background:
            radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.07) 0 3px, #0000 3.5px) 0 0 /
                14px 14px,
            conic-gradient(
                    from 45deg,
                    rgb(255 255 255 / 0.04) 0 25%,
                    #0000 0 50%,
                    rgb(255 255 255 / 0.04) 0 75%,
                    #0000 0
                )
                0 0 / 14px 14px,
            linear-gradient(160deg, var(--tile-light), var(--tile-deep));
        box-shadow:
            inset 0 0 0 2px var(--trim),
            inset 0 0 0 4px var(--tile-deep),
            inset 0 0 0 5px color-mix(in srgb, var(--trim) 50%, transparent);
    }

    .turn {
        box-shadow:
            inset 0 0 0 2px var(--trim),
            inset 0 0 0 4px var(--tile-deep),
            inset 0 0 0 5px color-mix(in srgb, var(--trim) 50%, transparent),
            0 0 0 2px #fff,
            0 0 14px 3px var(--player);
    }

    .panel {
        --dirham-sign-size: 0.65em;
    }

    .name {
        font-size: 23.5px;
        line-height: 1.15;
    }

    .panel :global(.money) {
        font-size: 22.5px;
        line-height: 1.15;
    }

    .payout {
        font-size: 17px;
    }
</style>
