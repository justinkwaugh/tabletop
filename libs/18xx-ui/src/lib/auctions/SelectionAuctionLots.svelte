<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { selectionLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PlaceText from '../places/PlaceText.svelte'
    import './auctionLotTable.css'
    import AuctionBidRow from './AuctionBidRow.svelte'
    import SelectionAuctionTiers from './SelectionAuctionTiers.svelte'
    import AuctionTurnLayout from './AuctionTurnLayout.svelte'
    import AuctionLotSummary from './AuctionLotSummary.svelte'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Auction lots require a selection auction')
        return auction.model
    })
    const lots = $derived(
        model.auction.remainingLotIds.map((lotId) => selectionLotDetail(session, lotId))
    )
    const tiered = $derived(!!model.tiers)
    const selected = $derived(lots.find((lot) => lot.id === auction.selection?.lotId))
    const playerId = $derived(auction.playerId)
    const columnCount = $derived(auction.ownTurn ? 4 : 3)
    // The table opens the bid under the chosen lot; the tiers bid beside them.
    const bidsInline = $derived(!tiered && !!selected)
</script>

{#snippet stepper(lotId: string, amount: number, inline: boolean)}
    <AuctionBidControl
        {money}
        {inline}
        {amount}
        increment={model.rules.increment}
        canBid={auction.canNominate(lotId, amount)}
        canDecrease={auction.canNominate(lotId, amount - model.rules.increment)}
        canIncrease={auction.canNominate(lotId, amount + model.rules.increment)}
        onChange={(amount) => auction.setBid(amount)}
        onBid={() => auction.nominate()}
    />
{/snippet}

<section class="centered-panel" aria-label="Private auction">
    <AuctionTurnLayout turn={playerId ? turn : undefined}>
        {#snippet content()}
            {#if tiered}
                <SelectionAuctionTiers {session} />
            {:else}
                <table class="auction-lot-table">
                    <thead
                        ><tr
                            >{#if auction.ownTurn}<th><span class="sr-only">Action</span></th
                                >{/if}<th>Private</th><th class="amount">Value</th><th
                                class="amount">Opening bid</th
                            ></tr
                        ></thead
                    >
                    <tbody>
                        {#each lots as lot (lot.id)}
                            <tr
                                data-private-description-row
                                class:selected={selected?.id === lot.id}
                            >
                                {#if auction.ownTurn}<td class="action">
                                        <button
                                            data-description-exclude
                                            aria-label={`Auction ${session.lotName(lot)}`}
                                            aria-pressed={selected?.id === lot.id}
                                            disabled={!auction.canNominate(
                                                lot.id,
                                                model.minimumBid(lot.id)
                                            )}
                                            onclick={() => auction.toggle(lot.id)}>Auction</button
                                        >
                                    </td>{/if}
                                <th scope="row"
                                    ><div class="identity">
                                        {#if lot.token}<CompanyToken
                                                appearance={lot.token}
                                                size={26}
                                            />
                                        {:else}<span class="private-icon" aria-hidden="true"
                                                >{session.lotInitials(lot)}</span
                                            >{/if}
                                        <span class="lot-name">
                                            <PrivateDescription
                                                {money}
                                                phaseColors={session.presentation.phaseColors}
                                                tokens={lot.cardTokens}
                                                imageUrl={session.publishedCardImage(lot.id)}
                                                plate={session.publishedCardPlate(lot.id)}
                                                shortName={session.lotName(lot)}
                                                fullName={lot.name}
                                                description={lot.company.description}
                                                value={lot.price}
                                                income={lot.company.revenue}
                                            />
                                            {#if lot.company.description}<span class="power"
                                                    ><PlaceText
                                                        text={lot.company.description}
                                                    /></span
                                                >{/if}
                                        </span>
                                    </div></th
                                >
                                <td class="amount value">{money(lot.price)}</td>
                                <td class="amount">{money(model.minimumBid(lot.id))}</td>
                            </tr>
                            {#if selected?.id === lot.id && auction.selection && playerId}
                                {@const amount = auction.selection.amount}
                                <AuctionBidRow columns={columnCount} label="Your bid">
                                    {#snippet control()}
                                        {@render stepper(lot.id, amount, true)}
                                    {/snippet}
                                    {#snippet figures()}
                                        <span
                                            >Available <strong>{money(model.cash(playerId))}</strong
                                            ></span
                                        >
                                    {/snippet}
                                </AuctionBidRow>
                            {/if}
                        {/each}
                    </tbody>
                </table>
            {/if}
        {/snippet}
    </AuctionTurnLayout>
</section>

{#snippet turn()}
    {#if playerId && !bidsInline}<div class="summary">
            <span
                >{session.getPlayerName(playerId)} has
                <strong>{money(model.cash(playerId))}</strong></span
            >
        </div>{/if}
    {#if tiered && selected && auction.selection}
        <AuctionLotSummary {session} lot={selected} />
        {@render stepper(selected.id, auction.selection.amount, false)}
    {:else if auction.ownTurn && auction.passOffered}
        <button
            class="pass action-button"
            disabled={!auction.canPass}
            onclick={() => auction.pass()}>Pass</button
        >
    {/if}
{/snippet}

<style>
    section {
        width: 100%;
    }
    table {
        flex: 0 1 560px;
        margin-inline: 0;
    }
    .lot-name {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }
    .power {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        max-width: 26rem;
        font-size: 11px;
        font-weight: 400;
        line-height: 1.35;
        text-align: left;
        color: var(--rail-muted, #887969);
    }
    .summary {
        display: flex;
        flex-direction: column;
        align-items: inherit;
        gap: 2px;
        color: var(--rail-text, #786550);
        font-size: 12px;
        line-height: 1.3;
    }
    .pass {
        height: 32px;
        padding: 0 22px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }
    .pass:disabled {
        opacity: 0.35;
        cursor: default;
    }
    @container auction-turn (max-width: 719px) {
        table {
            flex: none;
        }
    }
</style>
