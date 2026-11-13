<script lang="ts">
    import type { PurchaseOfferRequest } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { currencyAffixes } from '../presentation/money.js'
    import { purchaseAssetKey } from './purchaseAssets.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const options = $derived(session.decisions.stationPurchases)
    const selection = $derived(session.decisions.selection)
    const selected = $derived(
        selection?.kind === 'purchase' && selection.request.asset.kind === 'station'
            ? selection.request
            : undefined
    )
    const currency = $derived(currencyAffixes(session.presentation.money))

    /** The seller's company and the city of the station a request is for. */
    function stationOf(request: PurchaseOfferRequest) {
        const stationId = request.asset.kind === 'station' ? request.asset.stationId : undefined
        const station = session.gameState.stations.find((entry) => entry.id === stationId)
        if (station?.status !== 'placed' || request.seller.kind !== 'company') return undefined
        return {
            companyId: request.seller.companyId,
            place: session.placeName(station.position.locationId)
        }
    }
</script>

{#snippet stationLabel(request: PurchaseOfferRequest)}
    {@const station = stationOf(request)}
    {#if station}<span class="station"
            ><CompanyToken appearance={session.mapView.stations[station.companyId]} size={24} />
            <span>{station.place}</span></span
        >{/if}
{/snippet}

<!-- Another corporation's station token, bought with its president's agreement (1849 §14.1). -->
{#if options.length || selected}
    <div class="stations" role="group" aria-label="Station tokens">
        <h3>Buy a station token</h3>
        {#if selected}
            {@const evaluation = session.decisions.purchaseOfferEvaluation}
            <div class="selected">
                {@render stationLabel(selected)}
                <small>from {session.ownerName(selected.seller)}</small>
            </div>
            <div class="price">
                <label
                    >Price {currency.before}<input
                        aria-label="Station token price"
                        type="number"
                        min="1"
                        step="1"
                        value={selected.price}
                        oninput={(event) =>
                            session.decisions.setPurchasePrice(event.currentTarget.valueAsNumber)}
                    />{currency.after}</label
                >
                <button
                    class="commit"
                    disabled={!session.decisions.canResolve || !!evaluation?.reason}
                    onclick={() => session.decisions.confirm()}
                    >{evaluation?.buyerPlayerId === evaluation?.sellerPlayerId
                        ? 'Buy'
                        : 'Offer'}</button
                >
            </div>
            {#if evaluation?.reason}<p class="reason">{evaluation.reason}</p>{/if}
        {:else}
            <div class="choices">
                {#each options as option (purchaseAssetKey(option.request.asset))}
                    <button
                        disabled={!session.decisions.canResolve}
                        onclick={() => session.decisions.selectPurchaseOffer(option.request)}
                        >{@render stationLabel(option.request)}</button
                    >
                {/each}
            </div>
        {/if}
    </div>
{/if}

<style>
    .stations {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--rail-border, #d2c5b7);
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
    }
    .choices,
    .price {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 8px;
    }
    .station,
    .selected {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    button {
        font: inherit;
        padding: 6px 10px;
        border: 1px solid var(--rail-border, #aebfb4);
        border-radius: 5px;
        background: var(--rail-surface, #edf3eb);
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
    input {
        width: 76px;
        margin-left: 4px;
        font: inherit;
        padding: 4px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 3px;
        background: var(--rail-surface, white);
        color: inherit;
    }
    small,
    .reason {
        color: var(--rail-muted, #817261);
        font-size: 12px;
    }
    .reason {
        margin: 0;
    }
</style>
