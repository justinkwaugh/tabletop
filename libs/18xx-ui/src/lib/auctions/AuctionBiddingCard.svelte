<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import AuctionLotCard from './AuctionLotCard.svelte'
    import PublishedCardPlate from '../privates/PublishedCardPlate.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import AuctionBidControl from './AuctionBidControl.svelte'

    let {
        session,
        lot,
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
        session: EighteenXXSessionView
        lot: {
            id: string
            name: string
            price: number
            income?: number
            description: string
            cardTokens?: readonly StationAppearance[]
        }
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
    const imageUrl = $derived(session.publishedCardImage(lot.id))
    const plate = $derived(session.publishedCardPlate(lot.id))
</script>

<article class="centered-panel" aria-label="Current auction">
    <div class="layout">
        <div class="lot" class:image={!!imageUrl}>
            <AuctionLotCard
                {session}
                id={lot.id}
                name={lot.name}
                price={lot.price}
                income={lot.income}
                description={lot.description}
                tokens={lot.cardTokens}
            />
            {#if plate}<span class="badge"
                    >{#each plate.tokens as token, index (index)}<CompanyToken
                            appearance={token}
                            size={24}
                        />{/each}</span
                >{/if}
        </div>
        {#if plate}<PublishedCardPlate {plate} compact />{/if}
        <div class="turn">
            <div class="bid-summary">
                {#each summary as line (line.label)}
                    <span class="value">{line.label} <strong>{line.value}</strong></span>
                {/each}
            </div>
            {#if ownTurn}
                <AuctionBidControl
                    money={session.presentation.money}
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
        </div>
    </div>
</article>

<style>
    article {
        display: flex;
        justify-content: center;
        align-items: safe center;
        padding: 4px 0;
        container: auction-card / inline-size;
    }
    .layout {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px 28px;
        width: 100%;
    }
    .lot {
        width: 300px;
        max-width: 100%;
    }
    .lot.image {
        position: relative;
        width: auto;
        min-width: 0;
    }
    /* The plate naming what the card comes with stands close beside it. */
    .lot.image + :global(.plate) {
        margin-inline-start: -16px;
    }
    /* Size containment ignores content height, so fill only a pane whose height is fixed. */
    @container action-pane (min-height: 196px) {
        article {
            flex: 1 1 auto;
            min-height: 196px;
        }
        article:has(.lot.image) {
            container-type: size;
        }
        .lot.image {
            --auction-card-height: clamp(180px, 100cqh - 16px, 280px);
        }
    }
    .bid-summary {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.3;
    }
    .value {
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .turn {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
    @container auction-card (max-width: 479px) {
        .layout:not(:has(.lot.image)) {
            flex-direction: column;
        }
        .layout:not(:has(.lot.image)) :is(.turn, .bid-summary) {
            align-items: center;
            text-align: center;
        }
    }
    /* Card art is narrow enough to keep the bid beside it, shrinking with the pane; stacked, it drops to its default height. */
    @container auction-card (max-width: 299px) {
        .layout:has(.lot.image) {
            flex-direction: column;
        }
        .layout:has(.lot.image) :is(.turn, .bid-summary) {
            align-items: center;
            text-align: center;
        }
        .lot.image {
            --auction-card-height: initial;
        }
    }
    .badge {
        display: none;
    }
    /* Too narrow for the plate beside the card: its tokens sit on the card's corner instead. */
    @container auction-card (max-width: 419px) {
        .lot.image + :global(.plate) {
            display: none;
        }
        .badge {
            position: absolute;
            top: 5%;
            right: 7%;
            display: flex;
            gap: 3px;
            pointer-events: none;
        }
    }
</style>
