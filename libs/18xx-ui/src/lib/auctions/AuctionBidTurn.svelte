<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import AuctionBidControl from './AuctionBidControl.svelte'

    let {
        money,
        summary,
        amount,
        increment,
        ownTurn,
        canBid,
        canPass,
        onChange,
        onBid,
        onPass
    }: {
        money: MoneyFormat
        summary: readonly { label: string; value: string }[]
        amount: number
        increment: number
        ownTurn: boolean
        canBid: (amount: number) => boolean
        canPass: boolean
        onChange: (amount: number) => void
        onBid: () => void
        onPass: () => void
    } = $props()
</script>

<div class="bid-summary">
    {#each summary as line (line.label)}
        <span class="value">{line.label} <strong>{line.value}</strong></span>
    {/each}
</div>
{#if ownTurn}
    <AuctionBidControl
        {money}
        {amount}
        {increment}
        canBid={canBid(amount)}
        canDecrease={canBid(amount - increment)}
        canIncrease={canBid(amount + increment)}
        {canPass}
        {onChange}
        {onBid}
        {onPass}
    />
{/if}

<style>
    .bid-summary {
        display: flex;
        flex-direction: column;
        align-items: inherit;
        gap: 2px;
        line-height: 1.3;
    }
    .value {
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
</style>
