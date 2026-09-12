<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        session,
        lotInfo,
        onFocus
    }: {
        session: FinanceExampleSession
        lotInfo: (id: string) => { locationId?: string; description: string }
        onFocus: (locationId: string) => void
    } = $props()
    const model = $derived.by(() => {
        assertExists(session.offerAuction, 'Auction offers require an offer auction')
        return session.offerAuction
    })
    const lots = $derived(
        model.offerIds
            .map((id) => {
                const lot = model.lots.find((item) => item.id === id)
                assertExists(lot, 'Offer pile requires an auction lot')
                const company = session.privateCompanies.find((item) => item.id === id)
                const share = session.financialState.certificates.find(
                    (item) => item.id === id && item.kind === 'share'
                )
                return { ...lot, company, share }
            })
            .sort((a, b) => {
                if (a.price !== b.price) return a.price - b.price
                if (a.share?.kind === 'share' && b.share?.kind === 'share') {
                    return (
                        a.share.companyId.localeCompare(b.share.companyId) ||
                        (a.share.number ?? 0) - (b.share.number ?? 0)
                    )
                }
                return Number(!!a.share) - Number(!!b.share) || a.name.localeCompare(b.name)
            })
    )
</script>

<section aria-label="Auction offers">
    <header><h2>{session.getPlayerName(model.playerId)} <span>· Choose an offer</span></h2></header>
    <table>
        <thead
            ><tr
                ><th>Private / share</th><th class="amount">Income</th><th class="amount">Value</th
                ><th><span class="sr-only">Action</span></th></tr
            ></thead
        >
        <tbody>
            {#each lots as lot (lot.id)}
                {@const info = lotInfo(lot.id)}
                <tr data-private-description-row>
                    <th scope="row"
                        ><div class="identity">
                            <button
                                class="lot-icon"
                                data-description-exclude={info.locationId ? true : undefined}
                                aria-label={info.locationId ? `Show ${lot.name} on map` : lot.name}
                                onclick={() => {
                                    if (info.locationId) onFocus(info.locationId)
                                }}
                            >
                                {#if lot.share}<CompanyToken
                                        appearance={session.mapView.stations[lot.share.companyId]}
                                        size={26}
                                    />
                                {:else}<span class="private-icon" aria-hidden="true">{lot.id}</span
                                    >{/if}
                            </button>
                            <PrivateDescription
                                name={lot.name}
                                description={info.description}
                                value={lot.price}
                                income={lot.company?.privateRevenue}
                            />
                        </div></th
                    >
                    <td class="amount income"
                        >{#if lot.company && lot.company.privateRevenue !== undefined}${lot.company
                                .privateRevenue}<small> / OR</small>{:else}—{/if}</td
                    >
                    <td class="amount value">${lot.price}</td>
                    <td class="action"
                        ><button
                            data-description-exclude
                            aria-label={`Offer ${lot.name}`}
                            disabled={!session.canOfferAuction ||
                                !session.myPlayer ||
                                !model.canOffer(session.myPlayer.id, lot.id)}
                            onclick={() => session.offerAuctionLot(lot.id)}
                            >Offer <span aria-hidden="true">→</span></button
                        ></td
                    >
                </tr>
            {/each}
        </tbody>
    </table>
</section>

<style>
    section {
        max-width: 680px;
        color: #514538;
    }
    header {
        margin-bottom: 10px;
    }
    h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
    }
    h2 span {
        font-weight: 400;
        color: #887664;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    thead th {
        color: #887664;
        font-size: 10px;
        font-weight: 500;
        padding: 0 10px 5px;
        text-align: left;
    }
    thead th:first-child {
        padding-left: 0;
    }
    tbody tr {
        border-top: 1px solid #e3d9cd;
    }
    tbody th {
        font-weight: 500;
        text-align: left;
        padding: 7px 10px 7px 0;
    }
    td {
        padding: 7px 10px;
    }
    .identity {
        display: flex;
        align-items: center;
        gap: 9px;
    }
    .private-icon {
        display: grid;
        place-items: center;
        flex: 0 0 26px;
        height: 26px;
        border-radius: 6px;
        background: #eae1d5;
        color: #796047;
        font-size: 10px;
        font-weight: 650;
    }
    .amount {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }
    thead .amount {
        text-align: right;
    }
    .value {
        font-weight: 600;
    }
    .income {
        color: #796958;
    }
    small {
        font-size: 10px;
        color: #887664;
    }
    .action {
        width: 1%;
        padding-right: 0;
        padding-left: 14px;
    }
    button {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 5px 11px;
        border: 1px solid #a99983;
        border-radius: 5px;
        background: #fffdf8;
        color: #514538;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }
    button:hover:enabled {
        background: #eee5d8;
        border-color: #796047;
    }
    button:focus-visible {
        outline: 2px solid #796047;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .lot-icon {
        padding: 0;
        border: 0;
        background: transparent;
        flex-shrink: 0;
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }
</style>
