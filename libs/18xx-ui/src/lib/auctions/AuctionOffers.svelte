<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { auctionLotDetails } from './auctionLotDetails.js'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

    let {
        session,
        lotInfo,
        onFocus
    }: {
        session: EighteenXXSession
        lotInfo: (id: string) => { locationId?: string; description: string }
        onFocus: (locationId: string) => void
    } = $props()
    const money = $derived(session.presentation.money)
    const model = $derived.by(() => {
        assertExists(session.offers.model, 'Auction offers require an offer auction')
        return session.offers.model
    })
    const lots = $derived(auctionLotDetails(session, model.offerIds))

</script>

<section aria-label="Auction offers">
    <table>
        <thead
            ><tr
                ><th><span class="sr-only">Action</span></th><th>Private / share</th><th class="amount">Income</th><th class="amount">Value</th
                ></tr
            ></thead
        >
        <tbody>
            {#each lots as lot (lot.id)}
                {@const info = lotInfo(lot.id)}
                {@const token = lot.token}
                <tr data-private-description-row>
                    <td class="action"
                        ><button
                            data-description-exclude
                            aria-label={`Offer ${lot.name}`}
                            disabled={!session.offers.canAct ||
                                !session.myPlayer ||
                                !model.canOffer(session.myPlayer.id, lot.id)}
                            onclick={() => session.offers.offerLot(lot.id)}
                            >Offer</button
                        ></td
                    >

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
                                {#if token}<CompanyToken appearance={token} size={26} />
                                {:else}<span class="private-icon" aria-hidden="true">{lot.id}</span
                                    >{/if}
                            </button>
                            <PrivateDescription {money} phaseColors={session.presentation.phaseColors}
                                {token}
                                name={lot.name}
                                description={info.description}
                                value={lot.price}
                                income={lot.company?.privateRevenue}
                            />
                        </div></th
                    >
                    <td class="amount income"
                        >{#if lot.company && lot.company.privateRevenue !== undefined}{money(lot.company
                                .privateRevenue)}<small> / OR</small>{:else}—{/if}</td
                    >
                    <td class="amount value">{money(lot.price)}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</section>

<style>
    section {
        width: 100%;
        color: var(--rail-text, #514538);
    }
    table {
        width: 100%;
        max-width: 680px;
        margin-inline: auto;
        border-collapse: collapse;
        font-size: 13px;
    }
    thead th {
        color: var(--rail-muted, #887664);
        font-size: 10px;
        font-weight: 500;
        padding: 0 7px 3px;
        text-align: left;
    }
    thead th:first-child,
    thead th:nth-child(2) {
        padding-left: 0;
    }
    tbody th {
        font-weight: 500;
        text-align: left;
        padding: 3px 7px 3px 0;
    }
    td {
        padding: 3px 7px;
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
        background: var(--rail-surface-raised, #eae1d5);
        color: var(--rail-text, #796047);
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
        color: var(--rail-text, #796958);
    }
    small {
        font-size: 10px;
        color: var(--rail-muted, #887664);
    }
    .action {
        width: 1%;
        padding-right: 10px;
        padding-left: 0;
    }
    button {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 3px 9px;
        border: 1px solid var(--rail-border, #a99983);
        border-radius: 5px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }
    button:hover:enabled {
        background: var(--rail-surface-raised, #eee5d8);
        border-color: var(--rail-focus, #796047);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .lot-icon {
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        background: transparent;
        flex: 0 0 26px;
    }
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }
</style>
