<script lang="ts">
    import { FAVOR_BANK_ORDER, type Suit } from '@tabletop/oath'
    import BankCount from '$lib/components/BankCount.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { suitImage } from '$lib/images/suitImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { suitName } from '$lib/model/names.js'

    // Every choice of a favor bank is a row of suit symbols in the board's order: tap to pick,
    // the picked ones ringed; 44 px on a phone. `open`: a bank the pick cannot take now keeps its
    // place, faded and untappable. `framed`: each bank a framed button, its favor beside the
    // symbol (several banks picked in one row, Salad Days'). `counts`: each bank's favor as the
    // state the pick is judged on holds it, when that is not the table's (the Wake's later steps, a
    // When Played power's after the play's own gains).
    let {
        suits,
        picked,
        onpick,
        busy = false,
        open = () => true,
        framed = false,
        counts
    }: {
        suits: readonly Suit[]
        picked: readonly Suit[]
        onpick: (suit: Suit) => void
        busy?: boolean
        open?: (suit: Suit) => boolean
        framed?: boolean
        counts?: Readonly<Record<Suit, number>>
    } = $props()

    let gameSession = getGameSession()
    let favorBank = $derived(counts ?? gameSession.gameState.favorBank)
    let ordered = $derived(FAVOR_BANK_ORDER.filter((suit) => suits.includes(suit)))

    function bankName(suit: Suit): string {
        return `${suitName(suit)} bank, ${favorBank[suit]} favor`
    }
</script>

<div class="flex flex-wrap gap-2">
    {#each ordered as suit (suit)}
        {@const on = picked.includes(suit)}
        {@const closed = !on && !open(suit)}
        {#if framed}
            <button
                type="button"
                class="inline-flex h-10 items-center gap-1.5 rounded-md border px-2 text-[15px] font-bold max-sm:h-11 {on
                    ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
                    : 'border-oath-frame bg-oath-surface'} {closed ? 'opacity-40' : ''}"
                aria-pressed={on}
                aria-label={bankName(suit)}
                disabled={busy || closed}
                onclick={() => onpick(suit)}
            >
                <img class="h-7 w-7 max-sm:h-8 max-sm:w-8" src={suitImage(suit)} alt="" />
                <TokenText text="{favorBank[suit]} favor" />
            </button>
        {:else}
            <button
                type="button"
                class="suit rounded-full {on
                    ? 'ring-2 ring-oath-accent'
                    : 'ring-1 ring-transparent'}"
                aria-pressed={on}
                aria-label={bankName(suit)}
                disabled={busy || closed}
                onclick={() => onpick(suit)}
            >
                <img src={suitImage(suit)} alt="" />
                <span class="suit__count">
                    <BankCount count={favorBank[suit]} size={20} />
                </span>
            </button>
        {/if}
    {/each}
</div>

<style>
    .suit {
        position: relative;
        width: 40px;
        height: 40px;
        padding: 0;
    }
    @media (max-width: 639.98px) {
        .suit {
            width: 44px;
            height: 44px;
        }
    }
    .suit:disabled {
        opacity: 0.5;
    }
    .suit img {
        width: 100%;
        height: 100%;
    }
    .suit__count {
        position: absolute;
        right: -6px;
        bottom: -6px;
        line-height: 0;
    }
</style>
