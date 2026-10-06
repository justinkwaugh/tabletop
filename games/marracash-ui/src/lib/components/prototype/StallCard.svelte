<script lang="ts">
    // PROTOTYPE: "Market stall" — the card is the player's stall: an awning in their colour,
    // the same standee sign they put on the board, and their wares laid out on the counter.
    import type { Player } from '@tabletop/common'
    import type { HydratedMarracashPlayerState, MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import { mixColors } from '$lib/utils/colorLightness.js'
    import { signEdgeColor } from '$lib/utils/playerColors.js'
    import { cardFacts, MarketColors } from './cardFacts.js'
    import Dirham from './Dirham.svelte'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()
    const Cream = '#f6e7c1'
    const Ink = '#3d2f1f'

    let facts = $derived(cardFacts(gameSession, player, playerState))
    let edge = $derived(signEdgeColor(gameSession.colors.getPlayerColor(player.id)))
    let stripe = $derived(mixColors(facts.bg, edge === '#ffffff' ? '#ffffff' : Cream, 0.55))
    let held = $derived(MarketColors.filter((color) => facts.customers[color] > 0))

    function highlight(color: MarketColor) {
        return {
            hover: (active: boolean) =>
                gameSession.highlightCustomers(active ? { playerId: player.id, color } : undefined),
            tap: () => gameSession.toggleCustomerHighlight({ playerId: player.id, color })
        }
    }
</script>

{#snippet ware(color: MarketColor, value: number, matched: boolean, struck = false)}
    {@const palette = gameSession.marketPalettes[color]}
    <svg width="40" height="54" viewBox="0 0 40 54" role="img" aria-label="{color} antique {value}">
        <rect
            x="1"
            y="1"
            width="38"
            height="52"
            rx="5"
            fill={matched ? palette.tint : '#fffaf0'}
            stroke={palette.fill}
            stroke-width="2"
            stroke-dasharray={matched ? undefined : '4 2.5'}
        ></rect>
        <g transform="translate(2.5 3) scale(0.88)"><AntiqueItem {color} matched={true} /></g>
        <text
            x="20"
            y="48.5"
            text-anchor="middle"
            font-size="10.5"
            font-weight="700"
            fill={palette.stroke}
            text-decoration={struck ? 'line-through' : undefined}>{value}</text
        >
        {#if matched && !struck}
            <circle cx="33" cy="7" r="5.5" fill={palette.stroke}></circle>
            <path
                d="M30.4 7.2 L32.4 9.2 L35.8 5.2"
                fill="none"
                stroke="#fff"
                stroke-width="1.6"
                stroke-linecap="round"
            ></path>
        {/if}
    </svg>
{/snippet}

<div class="stall relative pt-1 text-left" class:turn={facts.isTurn} style:--player={facts.bg}>
    <!-- Awning -->
    <div
        class="relative flex items-center justify-between gap-2 rounded-t-md py-1.5 pr-3 pl-12"
        style:background-color={facts.bg}
        style:color={facts.ink}
    >
        <h1 class="marracash-display truncate text-[17px] leading-tight">{facts.name}</h1>
        <Dirham amount={facts.money} class="marracash-display text-xl leading-none" />
    </div>
    <div class="fringe h-[9px]" style:--a={facts.bg} style:--b={stripe} aria-hidden="true"></div>

    <!-- Standee sign, as on the board -->
    <svg
        class="sign absolute top-0 left-2"
        width="34"
        height="46"
        viewBox="-22 -58 44 54"
        aria-hidden="true"
    >
        <path d={facts.standee} fill={facts.bg} stroke={edge} stroke-width="1.5"></path>
        <path
            d={facts.standee}
            transform="translate(0 -28) scale(0.84) translate(0 28)"
            fill="none"
            stroke={Cream}
            stroke-width="1.5"
            opacity="0.9"
        ></path>
        <text
            x="0"
            y="-27"
            text-anchor="middle"
            dominant-baseline="central"
            class="marracash-initial"
            font-size="22"
            fill={facts.ink}>{facts.initial}</text
        >
    </svg>

    <!-- Counter -->
    <div class="counter -mt-[9px] rounded-b-md px-3 pt-3.5 pb-2" style:color={Ink}>
        <div class="flex items-center justify-between gap-2">
            <div
                class="flex items-center gap-[3px]"
                aria-label="{facts.shopCount} of {facts.maxShops} shops"
            >
                {#each { length: facts.maxShops } as _, index (index)}
                    <svg width="11" height="15" viewBox="-22 -58 44 54" aria-hidden="true">
                        <path
                            d={facts.standee}
                            fill={index < facts.shopCount ? facts.bg : 'none'}
                            stroke={index < facts.shopCount ? edge : '#9c8566'}
                            stroke-width={index < facts.shopCount ? 3 : 4}
                            stroke-dasharray={index < facts.shopCount ? undefined : '7 5'}
                        ></path>
                    </svg>
                {/each}
                <span class="ml-1 text-xs font-semibold">{facts.shopCount}/{facts.maxShops}</span>
            </div>
            <div class="flex flex-wrap justify-end gap-1">
                {#each held as color (color)}
                    {@const palette = gameSession.marketPalettes[color]}
                    <span
                        role="button"
                        tabindex="0"
                        class="flex items-center gap-0.5 rounded-full border-[1.5px] bg-white py-px pr-1.5 pl-1"
                        style:border-color={palette.stroke}
                        aria-label="{facts.customers[color]} {color} customers"
                        use:hoverOrTap={highlight(color)}
                    >
                        <PawnIcon {color} height={17} />
                        <span class="text-sm font-bold tabular-nums" style:color={palette.stroke}
                            >{facts.customers[color]}</span
                        >
                    </span>
                {:else}
                    <span class="text-xs italic opacity-70">No customers yet</span>
                {/each}
            </div>
        </div>

        {#if facts.antiquesOn}
            <div class="mt-2 border-t border-dashed border-[#c9b48f] pt-2">
                {#if facts.revealRank >= 0}
                    <div class="mb-1 flex items-baseline justify-between text-xs">
                        <span class="font-semibold">Set sold {facts.revealedLabel}</span>
                        <span class="font-bold">+<Dirham amount={facts.payout} /></span>
                    </div>
                    <div class="flex gap-1">
                        {#each facts.revealed as entry, index (index)}
                            {@render ware(entry.card.color, entry.card.value, true, !entry.paid)}
                        {/each}
                    </div>
                {:else if facts.isMe && facts.hand.length > 0}
                    <div class="flex items-center gap-1">
                        {#each facts.hand as entry, index (index)}
                            {@render ware(entry.card.color, entry.card.value, entry.covered)}
                        {/each}
                        <span class="ml-auto text-center text-xs leading-tight font-semibold"
                            >{facts.hand.filter((entry) => entry.covered).length}/{facts.hand
                                .length}<br /><span class="font-normal">ready</span></span
                        >
                    </div>
                {:else}
                    <div class="flex items-center gap-2 text-xs">
                        <div class="flex -space-x-3">
                            {#each { length: 5 } as _, index (index)}
                                <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true">
                                    <rect
                                        x="0.75"
                                        y="0.75"
                                        width="20.5"
                                        height="28.5"
                                        rx="3"
                                        fill="#8f2a24"
                                        stroke="#f6e7c1"
                                        stroke-width="1.5"
                                    ></rect>
                                    <path
                                        d="M11 8 L13 12.5 L17.5 12.5 L14 15.5 L15.5 20 L11 17.2 L6.5 20 L8 15.5 L4.5 12.5 L9 12.5 Z"
                                        fill="#e2b553"
                                    ></path>
                                </svg>
                            {/each}
                        </div>
                        <span>5 hidden antiques</span>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .fringe {
        background: repeating-linear-gradient(90deg, var(--a) 0 16px, var(--b) 16px 32px);
        mask: radial-gradient(circle at 8px 0, #000 8px, transparent 8.5px) 0 0 / 16px 9px repeat-x;
        position: relative;
        z-index: 1;
        filter: drop-shadow(0 2px 1px rgb(0 0 0 / 0.25));
    }
    .counter {
        background: linear-gradient(#0000 calc(100% - 4px), #b08a5a 0), #f4ead6;
    }
    .sign {
        z-index: 2;
        filter: drop-shadow(1px 2px 1.5px rgb(0 0 0 / 0.4));
    }
    .turn .sign {
        animation: sway 2.6s ease-in-out infinite;
        transform-origin: 50% 0;
    }
    .turn::before {
        content: '';
        position: absolute;
        inset: 0 -3px -3px;
        top: 1px;
        border-radius: 9px;
        box-shadow:
            0 0 0 2px #fff,
            0 0 12px 2px var(--player);
        pointer-events: none;
    }
    @keyframes sway {
        0%,
        100% {
            transform: rotate(-4deg);
        }
        50% {
            transform: rotate(4deg);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .turn .sign {
            animation: none;
        }
    }
</style>
