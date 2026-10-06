<script lang="ts">
    // PROTOTYPE: "Merchant ledger" — a page from the player's account book. One column per
    // market colour holds that colour's customers and, beneath, the antiques they settle, so
    // "how close is my set" reads straight down each column instead of across two rows.
    import type { Player } from '@tabletop/common'
    import type { Antique, HydratedMarracashPlayerState, MarketColor } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AntiqueItem from '$lib/components/AntiqueItem.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import { cardFacts, MarketColors } from './cardFacts.js'
    import Dirham from './Dirham.svelte'

    let { player, playerState }: { player: Player; playerState: HydratedMarracashPlayerState } =
        $props()
    const gameSession = getGameSession()
    const Ink = '#2f2416'

    let facts = $derived(cardFacts(gameSession, player, playerState))

    type Entry = { card: Antique; settled: boolean; struck: boolean }
    let entries: Entry[] = $derived(
        facts.revealRank >= 0
            ? facts.revealed.map(({ card, paid }) => ({ card, settled: true, struck: !paid }))
            : facts.hand.map(({ card, covered }) => ({ card, settled: covered, struck: false }))
    )
    let showsCards = $derived(facts.antiquesOn && entries.length > 0)

    function byColor(color: MarketColor) {
        return entries.filter((entry) => entry.card.color === color)
    }

    function highlight(color: MarketColor) {
        return {
            hover: (active: boolean) =>
                gameSession.highlightCustomers(active ? { playerId: player.id, color } : undefined),
            tap: () => gameSession.toggleCustomerHighlight({ playerId: player.id, color })
        }
    }
</script>

<div
    class="ledger relative overflow-hidden rounded-md text-left"
    class:turn={facts.isTurn}
    style:color={Ink}
    style:--player={facts.bg}
>
    <div class="tab absolute inset-y-0 left-0 w-2.5" style:background-color={facts.bg}></div>
    <div class="pl-5 pr-3 pt-2">
        <div class="flex items-baseline gap-2">
            <h1 class="marracash-display truncate text-[17px]">
                {#if facts.isTurn}<span class="turn-mark" style:color={facts.bg}>➤</span>{/if}
                {facts.name}
            </h1>
            <span class="leader min-w-4 flex-1"></span>
            <Dirham amount={facts.money} class="marracash-display text-xl" />
        </div>
        <div class="-mt-0.5 flex justify-between text-[11px] tracking-wide uppercase opacity-80">
            <span>{facts.shopCount} of {facts.maxShops} shops</span>
            <span
                >{facts.totalCustomers}
                {facts.totalCustomers === 1 ? 'customer' : 'customers'}</span
            >
        </div>
    </div>

    <div class="mx-3 mt-1.5 mb-2 ml-5 grid grid-cols-5 border-t-2 border-[#2f2416]/70">
        {#each MarketColors as color (color)}
            {@const palette = gameSession.marketPalettes[color]}
            {@const count = facts.customers[color]}
            <div class="column flex flex-col items-center pt-1 pb-1" style:--tint={palette.tint}>
                <span
                    role="button"
                    tabindex="0"
                    class="flex items-center gap-0.5"
                    aria-label="{count} {color} customers"
                    use:hoverOrTap={highlight(color)}
                >
                    <PawnIcon {color} height={20} />
                    <span
                        class="marracash-display w-[1.4ch] text-lg tabular-nums"
                        style:color={count > 0 ? palette.stroke : '#9b8a72'}
                        >{count > 0 ? count : '·'}</span
                    >
                </span>
                {#if showsCards}
                    <div class="mt-1 flex min-h-[26px] flex-col items-center gap-0.5">
                        {#each byColor(color) as entry, index (index)}
                            <span
                                class="tag flex items-center rounded-sm pr-1 text-[11px] font-bold tabular-nums"
                                class:settled={entry.settled}
                                style:--fill={palette.fill}
                                style:--stroke={palette.stroke}
                                aria-label="{color} antique {entry.card.value}{entry.settled
                                    ? ''
                                    : ', unsettled'}"
                            >
                                <svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true">
                                    <AntiqueItem {color} matched={true} />
                                </svg>
                                <span class:line-through={entry.struck}>{entry.card.value}</span>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if facts.antiquesOn}
        <div class="flex justify-between border-t border-[#2f2416]/25 py-1 pr-3 pl-5 text-xs">
            {#if facts.revealRank >= 0}
                <span class="font-semibold">Antique set closed {facts.revealedLabel}</span>
                <span class="font-bold">+<Dirham amount={facts.payout} /></span>
            {:else if showsCards}
                <span class="font-semibold">Antiques</span>
                <span
                    >{entries.filter((entry) => entry.settled).length} of {entries.length} settled</span
                >
            {:else}
                <span class="italic">5 antiques held in secret</span>
            {/if}
        </div>
    {/if}
</div>

<style>
    .ledger {
        background:
            repeating-linear-gradient(#0000 0 21px, rgb(120 150 190 / 0.18) 21px 22px), #fbf4e4;
        box-shadow: inset 0 0 0 1px rgb(47 36 22 / 0.25);
    }
    .ledger::after {
        content: '';
        position: absolute;
        inset-block: 0;
        left: 14px;
        border-left: 3px double rgb(190 60 50 / 0.45);
        pointer-events: none;
    }
    .leader {
        border-bottom: 2px dotted rgb(47 36 22 / 0.35);
        transform: translateY(-4px);
    }
    .column + .column {
        border-left: 1px solid rgb(47 36 22 / 0.18);
    }
    .tag {
        border: 1.5px dashed var(--fill);
        color: var(--stroke);
        background: #fff;
    }
    .tag.settled {
        border-style: solid;
        background: var(--fill);
        color: #fff;
    }
    .tag.settled svg {
        filter: drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff);
    }
    .turn {
        box-shadow:
            inset 0 0 0 1px rgb(47 36 22 / 0.25),
            0 0 0 2px #fff,
            0 0 14px 2px var(--player);
    }
    .turn-mark {
        -webkit-text-stroke: 0.5px #2f2416;
    }
</style>
