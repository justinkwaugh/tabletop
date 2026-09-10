<script lang="ts">
    import type { AuctionSelection } from './auctionSelection.js'
    import { committedBidAmount } from '@tabletop/common'
    import type { ReserveBidAuction } from '@tabletop/18xx'
    let {
        model,
        playerId,
        playerName,
        disabled = false,
        draft,
        onChoose,
        onBidChange,
        onConfirm,
        onBack,
        onPass,
        onUndo,
        canUndo
    }: {
        model: ReserveBidAuction
        playerId?: string
        playerName: (id: string) => string
        disabled?: boolean
        draft?: AuctionSelection
        onChoose: (kind: AuctionSelection['kind'], lotId: string) => void
        onBidChange: (amount: number) => void
        onConfirm: () => void
        onBack: () => void
        onPass: () => void
        onUndo: () => void
        canUndo: boolean
    } = $props()
    const commitments = $derived(model.commitments())
    const remaining = $derived(
        model.lots.filter((lot) => model.auction.remainingLotIds.includes(lot.id))
    )
    const bidding = $derived(model.auction.bidding)
    const confirmable = $derived(
        playerId &&
            draft &&
            (draft.kind === 'buy'
                ? model.canPurchase(playerId, draft.lotId) &&
                  draft.amount === model.price(draft.lotId)
                : model.canBid(playerId, draft.lotId, draft.amount))
    )
</script>

<section aria-label="Opening auction">
    <h2>Opening auction</h2>
    <p>
        {playerName(model.playerId)}’s turn{bidding
            ? ` · Bidding for ${model.lots.find((lot) => lot.id === bidding.lotId)?.name}`
            : ''}
    </p>
    {#if playerId}<p>
            Available cash: <strong>{model.availableCash(playerId)}</strong> · Reserved: {committedBidAmount(
                commitments,
                playerId
            )}
        </p>{/if}
    <div class="lots">
        {#each remaining as lot (lot.id)}
            <article
                aria-label={lot.name}
                class:current={model.auction.remainingLotIds[0] === lot.id}
            >
                <h3>{lot.name} <small>{lot.id}</small></h3>
                <p>Price {model.price(lot.id)}</p>
                <ul aria-label="Reserved bids">
                    {#each commitments.filter((bid) => bid.lotId === lot.id) as bid}<li>
                            {playerName(bid.playerId)}: {bid.amount}
                        </li>{:else}<li>No bids</li>{/each}
                </ul>
                {#if bidding?.lotId === lot.id}
                    {#each bidding.auction.participants.filter((bidder) => bidder.passed) as bidder}<p
                        >
                            {playerName(bidder.playerId)} passed
                        </p>{/each}
                {/if}
                {#if playerId && model.canPurchase(playerId, lot.id)}
                    <button disabled={disabled || !!draft} onclick={() => onChoose('buy', lot.id)}
                        >Buy for {model.price(lot.id)}</button
                    >
                {:else if playerId && model.canBid(playerId, lot.id, model.minimumBid(lot.id))}
                    <button disabled={disabled || !!draft} onclick={() => onChoose('bid', lot.id)}
                        >{bidding ? 'Raise bid' : 'Reserve bid'} · {model.minimumBid(lot.id)} minimum</button
                    >
                {/if}
            </article>
        {/each}
    </div>
    {#if draft}
        <div class="confirmation" aria-label="Auction selection">
            <strong>{model.lots.find((lot) => lot.id === draft.lotId)?.name}</strong>
            {#if draft.kind === 'bid'}
                <label
                    >Bid amount <input
                        type="number"
                        value={draft.amount}
                        min={model.minimumBid(draft.lotId)}
                        max={playerId ? model.availableCash(playerId, draft.lotId) : 0}
                        step="1"
                        oninput={(event) => onBidChange(event.currentTarget.valueAsNumber)}
                    /></label
                >
                <span>Maximum {playerId ? model.availableCash(playerId, draft.lotId) : 0}</span>
            {:else}<span>Purchase for {draft.amount}</span>{/if}
            <button onclick={onBack} {disabled}>Back</button>
            <button onclick={onConfirm} disabled={disabled || !confirmable}
                >Confirm {draft.kind === 'buy' ? 'purchase' : 'bid'}</button
            >
        </div>
    {:else}<button onclick={onPass} {disabled}>Pass auction</button>{/if}
    <button onclick={onUndo} disabled={!canUndo}>Undo</button>
    {#if model.auction.awards.length}
        <h3>Awarded</h3>
        <ul>
            {#each model.auction.awards as award}<li>
                    {model.lots.find((lot) => lot.id === award.lotId)?.name} — {playerName(
                        award.playerId
                    )}, {award.price}
                </li>{/each}
        </ul>
    {/if}
</section>

<style>
    section {
        background: #fffefa;
        border: 1px solid #b4c0b4;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
    }
    h2 {
        margin: 0;
        font-size: 20px;
    }
    h3 {
        font-size: 15px;
        margin: 0;
    }
    small {
        color: #58665f;
        font-weight: normal;
    }
    p,
    ul {
        font-size: 14px;
    }
    ul {
        padding-left: 18px;
    }
    .lots {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 18px;
    }
    article {
        border: 1px solid #c9d1c7;
        border-radius: 6px;
        padding: 14px;
        width: 235px;
    }
    article.current {
        border: 2px solid #315d4f;
        padding: 13px;
    }
    button,
    input {
        font: inherit;
        padding: 8px 12px;
        border: 1px solid #aebfb4;
        border-radius: 5px;
        background: white;
        color: inherit;
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    input {
        width: 90px;
    }
    .confirmation {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px;
        background: #edf0e9;
        border-radius: 6px;
    }
</style>
