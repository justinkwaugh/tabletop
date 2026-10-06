<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import AuctionLotCard from './AuctionLotCard.svelte'
    import AuctionBidControl from './AuctionBidControl.svelte'

    let {
        session,
        lot,
        summary,
        amount,
        increment,
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
            token?: StationAppearance
        }
        summary: readonly { label: string; value: string }[]
        amount: number
        increment: number
        canBid: (amount: number) => boolean
        canPass: boolean
        onChange: (amount: number) => void
        onBid: () => void
        onPass: () => void
    } = $props()
    const imageUrl = $derived(session.publishedCardImage(lot.id))
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
                token={lot.token}
            />
        </div>
        <div class="turn">
            <div class="bid-summary">
                {#each summary as line (line.label)}
                    <span class="value">{line.label} <strong>{line.value}</strong></span>
                {/each}
            </div>
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
        </div>
    </div>
</article>

<style>
    article {
        display: flex;
        justify-content: center;
        align-items: center;
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
        width: auto;
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
            --auction-card-height: clamp(180px, 100cqh - 16px, 360px);
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
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
    @container auction-card (max-width: 479px) {
        .layout {
            flex-direction: column;
        }
        .turn,
        .bid-summary {
            align-items: center;
            text-align: center;
        }
    }
</style>
