<script lang="ts">
    import type { OfferAuction } from '@tabletop/18xx'
    import type { OfferAuctionSelection } from './auctionSelection.js'
    let {
        model,
        playerId,
        playerName,
        draft,
        disabled,
        onChoose,
        onBidChange,
        onConfirm,
        onBack,
        onPass,
        onUndo,
        showUndo = true,
        canUndo
    }: {
        model: OfferAuction
        playerId?: string
        playerName: (id: string) => string
        draft?: OfferAuctionSelection
        disabled: boolean
        onChoose: (id: string) => void
        onBidChange: (amount: number) => void
        onConfirm: () => void
        onBack: () => void
        onPass: () => void
        onUndo: () => void
        showUndo?: boolean
        canUndo: boolean
    } = $props()
    const bidding = $derived(model.auction.bidding)
    const selected = $derived(draft && model.lots.find((lot) => lot.id === draft.lotId))
    const confirmable = $derived(
        playerId &&
            draft &&
            (bidding
                ? draft.amount !== undefined && model.canBid(playerId, draft.lotId, draft.amount)
                : model.canOffer(playerId, draft.lotId))
    )
</script>

<section aria-label="Opening auction">
    <h2>Opening auction</h2>
    <p>
        Auctioneer: <strong>{playerName(model.auction.auctioneerId)}</strong> · {playerName(
            model.playerId
        )}’s turn
    </p>
    {#if playerId}<p>Cash: {model.cash(playerId)}</p>{/if}
    {#if model.auction.stalled}<p role="status">
            No player can afford the forced purchase, and player-owned privates produce no income.
            The rules provide no further resolution. Undo remains available.
        </p>{/if}
    {#if bidding}
        <article aria-label="Current auction">
            <h3>{model.lots.find((lot) => lot.id === bidding.lotId)?.name}</h3>
            <p>Face value {model.price(bidding.lotId)} · Minimum bid {model.minimumBid}</p>
            <p>
                Bidders: {model.bidders.map(playerName).join(' and ')} · Forced purchaser: {playerName(
                    model.forcedBuyerId
                )}
            </p>
            {#if bidding.firstPassed && bidding.auction.highBid === undefined}<p>
                    The first bidder may re-enter if the second bidder bids.
                </p>{/if}
            <ul>
                {#each bidding.auction.participants as participant}<li>
                        {playerName(participant.playerId)}: {participant.bid ??
                            'No bid'}{participant.passed ? ' · Passed' : ''}
                    </li>{/each}
            </ul>
            {#if !draft}<button
                    onclick={() => onChoose(bidding.lotId)}
                    disabled={disabled ||
                        !playerId ||
                        !model.canBid(playerId, bidding.lotId, model.minimumBid)}>Place bid</button
                >
                <button onclick={onPass} {disabled}>Pass auction</button>{/if}
        </article>
    {/if}
    <div class="piles">
        {#each model.auction.piles as pile}<article
                aria-label={`${playerName(pile.playerId)} offer pile`}
            >
                <h3>{playerName(pile.playerId)}</h3>
                {#each pile.lotIds as lotId}{@const lot = model.lots.find(
                        (lot) => lot.id === lotId
                    )!}
                    <div class="lot">
                        <span>{lot.name} · {lot.price}</span>
                        {#if !bidding && pile.playerId === model.auction.auctioneerId}<button
                                onclick={() => onChoose(lotId)}
                                disabled={disabled || !!draft}>Offer {lot.name}</button
                            >{/if}
                    </div>
                {:else}<p>All items sold</p>{/each}
            </article>{/each}
    </div>
    {#if draft && selected}<div aria-label="Auction selection" class="selection">
            <strong>{selected.name}</strong>
            {#if bidding}<label
                    >Bid amount <input
                        type="number"
                        min={model.minimumBid}
                        max={playerId ? model.cash(playerId) : 0}
                        step={model.rules.increment}
                        value={draft.amount}
                        oninput={(event) => onBidChange(event.currentTarget.valueAsNumber)}
                    /></label
                >{/if}
            <button onclick={onBack} {disabled}>Back</button>
            <button onclick={onConfirm} disabled={disabled || !confirmable}
                >{bidding ? 'Confirm bid' : 'Confirm offer'}</button
            >
        </div>{/if}
    {#if showUndo}<button onclick={onUndo} disabled={!canUndo}>Undo</button>{/if}
    {#if model.auction.awards.length}<h3>Awarded</h3>
        <ul>
            {#each model.auction.awards as award}<li>
                    {model.lots.find((lot) => lot.id === award.lotId)?.name} — {playerName(
                        award.playerId
                    )}, {award.price}
                </li>{/each}
        </ul>{/if}
</section>

<style>
    section {
        background: var(--rail-surface, #fffefa);
        border: 1px solid var(--rail-border, #b4c0b4);
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
    p,
    ul {
        font-size: 14px;
    }
    .piles {
        display: flex;
        gap: 12px;
        margin: 16px 0;
        flex-wrap: wrap;
    }
    article {
        padding: 14px;
        border: 1px solid var(--rail-border, #c9d1c7);
        border-radius: 6px;
    }
    .piles article {
        width: 260px;
    }
    .lot {
        display: flex;
        gap: 8px;
        flex-direction: column;
        margin: 12px 0;
    }
    .selection {
        display: flex;
        gap: 12px;
        align-items: center;
        margin: 12px 0;
        padding: 12px;
        background: var(--rail-surface-raised, #edf0e9);
    }
    button,
    input {
        font: inherit;
        padding: 8px 12px;
        border: 1px solid var(--rail-border, #aebfb4);
        border-radius: 5px;
        background: var(--rail-surface, white);
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
        width: 100px;
    }
</style>
