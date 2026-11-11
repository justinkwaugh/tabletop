<script lang="ts">
    import { sameOwner, type Owner } from '@tabletop/18xx'
    import type { BoundingBox } from '@tabletop/common'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import { popoverBeside } from '../presentation/popoverPlacement.js'
    import { playerPurchaseContribution } from './purchaseContribution.js'
    import { marketSourcesFirst, shareSourceName } from './purchaseSources.js'
    import type { CompanyShareOffer, CompanyTrades } from '../session/stockModule.svelte.js'
    import './tradePopover.css'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let {
        session,
        companyId,
        trades,
        anchor,
        pointerY,
        onclose
    }: {
        session: EighteenXXSessionView
        companyId: string
        trades: CompanyTrades
        anchor: BoundingBox
        pointerY: number
        onclose: () => void
    } = $props()

    const money = $derived(session.presentation.money)
    let chosenBuyer = $state<Owner>()
    const buyer = $derived(
        trades.buyers.find((candidate) => chosenBuyer && sameOwner(candidate, chosenBuyer)) ??
            trades.buyers[0]
    )
    const offers = $derived(marketSourcesFirst(trades.offers, session.presentation.marketPoolId))
    let popover = $state<HTMLDivElement>()
    let size = $state({ width: 0, height: 0 })
    const position = $derived(
        popoverBeside(anchor, pointerY, size, {
            width: window.innerWidth,
            height: window.innerHeight
        })
    )

    // Removed on unmount: a close queued by a popover already replaced must not close its successor.
    function openWhileMounted(element: HTMLDivElement) {
        const closed = (event: ToggleEvent) => {
            if (event.newState === 'closed') onclose()
        }
        element.addEventListener('toggle', closed)
        element.showPopover()
        element.focus()
        return () => element.removeEventListener('toggle', closed)
    }

    function purchaseFor(offer: CompanyShareOffer) {
        return offer.purchases.find((purchase) => buyer && sameOwner(purchase.request.buyer, buyer))
    }
    function ownerLabel(owner: Owner) {
        return owner.kind === 'company' ? session.companyInitials(owner.companyId) : 'Me'
    }
    function sourceName(offer: CompanyShareOffer) {
        return shareSourceName(offer.certificate, session)
    }
    function certificateNote({ certificate }: CompanyShareOffer) {
        return [
            certificate.number === undefined ? '' : `#${certificate.number}`,
            certificate.president || certificate.shares !== 1 ? `${certificate.shares} shares` : '',
            certificate.president ? 'President' : ''
        ]
            .filter(Boolean)
            .join(' · ')
    }
    function trade(press: () => Promise<void>) {
        popover?.hidePopover()
        onclose()
        void press()
    }
</script>

<div
    class="company-trade trade-popover"
    popover="auto"
    role="dialog"
    tabindex="-1"
    aria-label={`Trade ${session.companyName(companyId)} shares`}
    bind:this={popover}
    bind:offsetWidth={size.width}
    bind:offsetHeight={size.height}
    style:left={`${position.x}px`}
    style:top={`${position.y}px`}
    {@attach openWhileMounted}
>
    <div class="trade-heading">
        <CompanyToken appearance={session.mapView.stations[companyId]} size={24} />
        <strong>{session.companyName(companyId)}</strong>
    </div>
    {#if offers.length}
        <div class="trade-line">
            <span class="line-label">Buy</span>
            <div class="line-body">
                {#if trades.buyers.length > 1}
                    <div class="buyer-choice" role="group" aria-label="Buy as">
                        {#each trades.buyers as candidate (ownerLabel(candidate))}
                            <button
                                aria-pressed={!!buyer && sameOwner(candidate, buyer)}
                                title={session.ownerName(candidate)}
                                onclick={() => (chosenBuyer = candidate)}
                                >{ownerLabel(candidate)}</button
                            >
                        {/each}
                    </div>
                {/if}
                <div class="chips">
                    {#each offers as offer (offer.certificate.id)}
                        {@const purchase = purchaseFor(offer)}
                        {@const note = certificateNote(offer)}
                        {@const contribution =
                            purchase && purchase.request.buyer.kind === 'company'
                                ? playerPurchaseContribution(purchase.details, session.myPlayer?.id)
                                : 0}
                        <button
                            class="chip buy"
                            disabled={!purchase}
                            aria-label={purchase
                                ? `Buy from ${sourceName(offer)} for ${money(purchase.details.price)}`
                                : `Buy from ${sourceName(offer)}`}
                            onclick={() =>
                                purchase && trade(() => session.stock.buy(purchase.request))}
                        >
                            <span>{sourceName(offer)}</span>
                            {#if note}<small>{note}</small>{/if}
                            {#if purchase}<strong>{money(purchase.details.price)}</strong>{/if}
                            {#if contribution > 0}<small>you + {money(contribution)}</small>{/if}
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
    {#each trades.sales as group (ownerLabel(group.seller))}
        <div class="trade-line">
            <span class="line-label"
                >Sell{#if group.seller.kind === 'company'}{' '}{ownerLabel(group.seller)}{/if}</span
            >
            <div class="chips">
                {#each group.sales as sale (sale.shares)}
                    <button
                        class="chip sell"
                        aria-label={`Sell ${sale.shares} ${sale.shares === 1 ? 'share' : 'shares'} for ${money(sale.proceeds)}`}
                        onclick={() => trade(() => session.stock.sell(sale.request))}
                    >
                        <span>{sale.shares}</span>
                        <strong>{money(sale.proceeds)}</strong>
                    </button>
                {/each}
            </div>
        </div>
    {/each}
</div>

<style>
    .company-trade:focus {
        outline: none;
    }
    .trade-heading {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
    }
    .trade-line {
        display: grid;
        grid-template-columns: minmax(34px, max-content) 1fr;
        align-items: start;
        gap: 8px;
        margin-top: 10px;
    }
    .line-label {
        padding-top: 7px;
        color: var(--rail-muted, #95816a);
        font-size: 12px;
        white-space: nowrap;
    }
    .line-body {
        display: grid;
        gap: 6px;
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-width: 280px;
    }
    .chip {
        display: grid;
        justify-items: center;
        min-width: 52px;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 2px 8px;
        color: #fff;
        font: inherit;
        line-height: 1.25;
        cursor: pointer;
    }
    .chip span {
        font-size: 12px;
    }
    .chip small {
        font-size: 10px;
        opacity: 0.85;
    }
    .chip.buy {
        border-color: var(--trade-buy-border);
        background: var(--trade-buy);
    }
    .chip.sell {
        border-color: #7c3a2a;
        background: #8e4431;
    }
    .chip:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .chip:hover:not(:disabled) {
        filter: brightness(1.12);
    }
    .buyer-choice {
        display: flex;
        gap: 4px;
    }
    .buyer-choice button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        padding: 1px 8px;
        background: transparent;
        color: var(--rail-muted, #95816a);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
    }
    .buyer-choice button[aria-pressed='true'] {
        border-color: var(--rail-focus, #a87948);
        background: var(--rail-surface-raised, #efe7db);
        color: inherit;
    }
    .chip:focus-visible,
    .buyer-choice button:focus-visible {
        outline: 2px solid var(--rail-focus, #a87948);
        outline-offset: 1px;
    }
</style>
