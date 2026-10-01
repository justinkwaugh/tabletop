<script lang="ts">
    import { FAVOR_BANK_ORDER, type Suit } from '@tabletop/oath'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import { suitImage } from '$lib/images/suitImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { suitName } from '$lib/model/names.js'

    // Every choice of a favor bank is a row of suit symbols in the board's order: tap to pick,
    // the picked one ringed.
    let {
        suits,
        picked,
        onpick,
        busy = false
    }: {
        suits: readonly Suit[]
        picked: readonly Suit[]
        onpick: (suit: Suit) => void
        busy?: boolean
    } = $props()

    let gameSession = getGameSession()
    let favorBank = $derived(gameSession.gameState.favorBank)
    let ordered = $derived(FAVOR_BANK_ORDER.filter((suit) => suits.includes(suit)))

    function bankName(suit: Suit): string {
        return `${suitName(suit)} bank, ${favorBank[suit]} favor`
    }
</script>

<div class="flex flex-wrap gap-2">
    {#each ordered as suit (suit)}
        {@const on = picked.includes(suit)}
        <button
            type="button"
            class="suit rounded-full {on
                ? 'ring-2 ring-oath-accent'
                : 'ring-1 ring-transparent hover:ring-oath-accent'}"
            aria-pressed={on}
            aria-label={bankName(suit)}
            title={bankName(suit)}
            disabled={busy}
            onclick={() => onpick(suit)}
        >
            <img src={suitImage(suit)} alt="" />
            <span class="suit__count">
                <TokenBadge kind="favor" count={favorBank[suit]} size={20} />
            </span>
        </button>
    {/each}
</div>

<style>
    .suit {
        position: relative;
        width: 40px;
        height: 40px;
        padding: 0;
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
