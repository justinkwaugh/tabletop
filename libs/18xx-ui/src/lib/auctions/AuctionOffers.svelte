<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import { auctionLotDetails } from './auctionLotDetails.js'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import './auctionLotTable.css'

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

<section class="centered-panel" aria-label="Auction offers">
    <table class="auction-lot-table">
        <thead
            ><tr
                ><th><span class="sr-only">Action</span></th><th>Private / share</th><th
                    class="amount">Income</th
                ><th class="amount">Value</th></tr
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
                            onclick={() => session.offers.offerLot(lot.id)}>Offer</button
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
                            <PrivateDescription
                                {money}
                                phaseColors={session.presentation.phaseColors}
                                {token}
                                imageUrl={session.publishedCardImage(lot.id)}
                                name={lot.name}
                                description={info.description}
                                value={lot.price}
                                income={lot.company?.privateRevenue}
                            />
                        </div></th
                    >
                    <td class="amount income"
                        >{#if lot.company && lot.company.privateRevenue !== undefined}{money(
                                lot.company.privateRevenue
                            )}<small> / OR</small>{:else}—{/if}</td
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
    }
    .lot-icon {
        display: flex;
        align-items: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        font-family: inherit;
        flex: 0 0 26px;
        cursor: pointer;
    }
    .lot-icon:hover:enabled {
        background: var(--rail-surface-raised, #eee5d8);
    }
    .lot-icon:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
</style>
