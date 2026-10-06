<script lang="ts">
    // PROTOTYPE: "Riad doorway" — a tiled panel with the player's own horseshoe-arch doorway.
    // A deep glazed-tile ground so the five market colours glow against it instead of fading
    // into the beige of the board; customers stand in a row under the arch.
    import type { Player } from '@tabletop/common'
    import type { HydratedMarracashPlayerState, MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import { PawnOutline } from '$lib/utils/pawnShape.js'
    import { cardFacts, MarketColors } from './cardFacts.js'
    import Dirham from './Dirham.svelte'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()
    const Brass = '#e3bd6a'
    const Cream = '#f6e7c1'
    const InitialSize = 24
    const CapHeight = 0.74
    const InitialCenterY = -28.75

    let facts = $derived(cardFacts(gameSession, player, playerState))

    function highlight(color: MarketColor) {
        return {
            hover: (active: boolean) =>
                gameSession.highlightCustomers(active ? { playerId: player.id, color } : undefined),
            tap: () => gameSession.toggleCustomerHighlight({ playerId: player.id, color })
        }
    }
</script>

{#snippet antique(color: MarketColor, value: number, matched: boolean, struck = false)}
    {@const palette = gameSession.marketPalettes[color]}
    <svg width="38" height="50" viewBox="0 0 38 50" role="img" aria-label="{color} antique {value}">
        <rect
            x="1"
            y="1"
            width="36"
            height="48"
            rx="4"
            fill={matched ? '#fbf1da' : '#1d4a55'}
            stroke={matched ? Brass : palette.fill}
            stroke-width="1.75"
            stroke-dasharray={matched ? undefined : '3.5 2.5'}
        ></rect>
        <g transform="translate(2.5 2.5) scale(0.83)"><AntiqueItem {color} matched={true} /></g>
        <text
            x="19"
            y="45"
            text-anchor="middle"
            class="riad-num"
            font-size="11"
            fill={matched ? palette.stroke : '#f3e6c4'}
            text-decoration={struck ? 'line-through' : undefined}>{value}</text
        >
    </svg>
{/snippet}

<div
    class="riad relative flex gap-1.5 rounded-lg p-2 pr-2.5 pl-2.5 text-left"
    class:turn={facts.isTurn}
    style:--player={facts.bg}
>
    <!-- Standee sign, as on the board -->
    <div class="flex w-[70px] shrink-0 flex-col items-center pt-0.5">
        <svg class="sign" width="46" height="57" viewBox="-23 -58 46 56" aria-hidden="true">
            <path d={facts.standee} fill={facts.bg} stroke={Brass} stroke-width="1.75"></path>
            <path
                d={facts.standee}
                transform="translate(0 -28) scale(0.84) translate(0 28)"
                fill="none"
                stroke={Cream}
                stroke-width="1.5"
                opacity="0.9"
            ></path>
            <path d="M -3.5 -45 L 0 -48.5 L 3.5 -45 L 0 -41.5 Z" fill={Cream} opacity="0.9"></path>
            <path d="M -3 -13.5 L 0 -16 L 3 -13.5 L 0 -11 Z" fill={Cream} opacity="0.9"></path>
            <!-- Baseline placed from the capital height (0.74em via font-size-adjust) so the letter
                 centres between the two diamonds; El Messiri's tall Arabic metrics push "central" high. -->
            <text
                x="0"
                y={InitialCenterY + (CapHeight * InitialSize) / 2}
                text-anchor="middle"
                class="riad-initial"
                font-size={InitialSize}
                fill={facts.ink}>{facts.initial}</text
            >
        </svg>
        <span
            class="riad-num mt-0.5 text-center text-[11px] leading-none whitespace-nowrap text-[#f1cd7c]"
            ><span class="riad-num text-[12px]">{facts.shopCount}/{facts.maxShops}</span>
            <span class="text-[10px] font-semibold tracking-wider text-[#f3e6c4]">SHOPS</span></span
        >
    </div>

    <div class="min-w-0 flex-1 pt-0.5">
        <div class="flex items-baseline justify-between gap-2">
            <h1 class="riad-name truncate text-[#fbf1da]">{facts.name}</h1>
            <Dirham amount={facts.money} class="riad-money text-[#f1cd7c]" />
        </div>
        <div class="mt-1 flex justify-between rounded-md bg-black/40 px-1.5 py-1">
            {#each MarketColors as color (color)}
                {@const palette = gameSession.marketPalettes[color]}
                {@const count = facts.customers[color]}
                <span
                    role="button"
                    tabindex="0"
                    class="flex items-center gap-0.5"
                    aria-label="{count} {color} customers"
                    use:hoverOrTap={highlight(color)}
                >
                    {#if count > 0}
                        <PawnIcon {color} height={20} />
                    {:else}
                        <svg width="12" height="20" viewBox="-8 -14 16 28" aria-hidden="true">
                            <path
                                d={PawnOutline}
                                fill="none"
                                stroke={palette.fill}
                                stroke-width="1.6"
                                stroke-dasharray="3 2"
                            ></path>
                        </svg>
                    {/if}
                    <span
                        class="riad-num w-[1.3ch] text-[16px] tabular-nums"
                        style:color={count > 0 ? '#fbf1da' : '#86a7ad'}>{count}</span
                    >
                </span>
            {/each}
        </div>
    </div>

    {#if facts.antiquesOn}
        <div class="basis-full mt-1.5 pl-0.5">
            {#if facts.revealRank >= 0}
                <div class="flex items-center gap-1">
                    {#each facts.revealed as entry, index (index)}
                        {@render antique(entry.card.color, entry.card.value, true, !entry.paid)}
                    {/each}
                    <div class="ml-auto text-right text-xs leading-tight text-[#f3e6c4]">
                        {facts.revealedLabel} set<span class="riad-payout mt-1 block text-[#f1cd7c]"
                            >+<Dirham amount={facts.payout} /></span
                        >
                    </div>
                </div>
            {:else if facts.isMe && facts.hand.length > 0}
                <div class="flex items-center gap-1">
                    {#each facts.hand as entry, index (index)}
                        {@render antique(entry.card.color, entry.card.value, entry.covered)}
                    {/each}
                    <div class="ml-auto text-right text-xs leading-tight text-[#f3e6c4]">
                        antiques<span class="riad-num mt-1 block text-[15px] text-[#f1cd7c]"
                            >{facts.hand.filter((entry) => entry.covered).length}/{facts.hand
                                .length}</span
                        >
                    </div>
                </div>
            {:else}
                <div class="flex items-center gap-2.5 pb-0.5 pl-3">
                    <div class="splay flex">
                        {#each { length: 5 } as _, index (index)}
                            <svg
                                width="26"
                                height="36"
                                viewBox="0 0 26 36"
                                aria-hidden="true"
                                style:transform="rotate({(index - 2) * 7}deg) translateY({Math.abs(
                                    index - 2
                                ) * 1.5}px)"
                            >
                                <rect
                                    x="0.75"
                                    y="0.75"
                                    width="24.5"
                                    height="34.5"
                                    rx="3"
                                    fill="#8f2a24"
                                    stroke={Brass}
                                    stroke-width="1.5"
                                ></rect>
                                <rect
                                    x="3.5"
                                    y="3.5"
                                    width="19"
                                    height="29"
                                    rx="1.5"
                                    fill="none"
                                    stroke={Brass}
                                    stroke-opacity="0.5"
                                    stroke-width="0.8"
                                ></rect>
                                <path
                                    d="M13 11 L15 15.5 L19.5 15.5 L16 18.5 L17.5 23 L13 20.2 L8.5 23 L10 18.5 L6.5 15.5 L11 15.5 Z"
                                    fill={Brass}
                                ></path>
                            </svg>
                        {/each}
                    </div>
                    <span class="text-xs text-[#f3e6c4] italic">5 hidden antiques</span>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .riad {
        flex-wrap: wrap;
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
            linear-gradient(160deg, #1f5d69, #123e48);
        box-shadow:
            inset 0 0 0 2px #c9a24a,
            inset 0 0 0 4px #123e48,
            inset 0 0 0 5px rgb(201 162 74 / 0.5);
    }
    .riad-name,
    .riad :global(.riad-money) {
        font-family: 'MarraCash El Messiri', 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 21px;
        font-size-adjust: cap-height 0.74;
        line-height: 1.15;
    }
    .riad :global(.riad-money) {
        font-size: 20px;
    }
    .riad-num {
        font-family: 'MarraCash El Messiri', 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
    }
    .riad-initial,
    .riad-payout {
        font-family: 'MarraCash El Messiri', 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size-adjust: cap-height 0.74;
    }
    .riad-payout {
        font-size: 15px;
    }
    .splay svg {
        transform-origin: 50% 100%;
        filter: drop-shadow(1px 1px 1px rgb(0 0 0 / 0.45));
    }
    .splay svg + svg {
        margin-left: -14px;
    }
    .sign {
        filter: drop-shadow(1px 2px 1.5px rgb(0 0 0 / 0.5));
    }
    .turn {
        box-shadow:
            inset 0 0 0 2px #c9a24a,
            inset 0 0 0 4px #123e48,
            inset 0 0 0 5px rgb(201 162 74 / 0.5),
            0 0 0 2px #fff,
            0 0 14px 3px var(--player);
    }
</style>
