<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { privateLotDetail } from './auctionLotDetails.js'
    import AuctionBidControl from './AuctionBidControl.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import PlaceText from '../places/PlaceText.svelte'
    import { namedPlaceText } from '@tabletop/18xx'
    import './auctionLotTable.css'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Auction lots require a selection auction')
        return auction.model
    })
    const lotDetail = (lotId: string) => {
        const lot = model.lots.find((item) => item.id === lotId)
        assertExists(lot, 'Remaining auction lot must be known')
        return privateLotDetail(session, lot)
    }
    const lots = $derived(model.auction.remainingLotIds.map(lotDetail))
    const nominable = $derived(model.nominationLotIds)
    const tiers = $derived(
        model.tiers?.map((slots, index) => ({
            label: `Tier ${index + 1}`,
            open: slots.some((lotId) => !!lotId && nominable.includes(lotId)),
            slots: slots.map((lotId) => (lotId ? lotDetail(lotId) : undefined))
        }))
    )
    const selected = $derived(lots.find((lot) => lot.id === auction.selection?.lotId))
    const playerId = $derived(auction.playerId)
    const plainDescription = (description: string) => namedPlaceText(description, session.placeName)
    const lotTitle = (lot: (typeof lots)[number]) =>
        lot.company.description && plainDescription(lot.company.description)
    const columnCount = $derived(auction.ownTurn ? 4 : 3)
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

{#snippet slotContent(lot: (typeof lots)[number], open: boolean)}
    <span class="slot-heading"
        ><span class="slot-name">{session.lotName(lot)}</span>
        <span class="slot-value">{money(lot.price)}</span></span
    >
    {#if open && lot.company.description}<span class="power slot-power"
            >{plainDescription(lot.company.description)}</span
        >{/if}
{/snippet}

<section class="centered-panel" aria-label="Private auction">
    <div class="layout">
        {#if tiers}
            <div class="pyramid" role="group" aria-label="Lot tiers">
                {#each tiers as tier (tier.label)}
                    <div class="tier" class:open={tier.open} role="group" aria-label={tier.label}>
                        {#each tier.slots as lot, index (lot?.id ?? `empty:${index}`)}
                            {#if lot && auction.ownTurn}
                                <button
                                    class="slot"
                                    class:selected={selected?.id === lot.id}
                                    aria-label={`Auction ${session.lotName(lot)}`}
                                    aria-pressed={selected?.id === lot.id}
                                    title={lotTitle(lot)}
                                    disabled={!auction.canNominate(
                                        lot.id,
                                        model.minimumBid(lot.id)
                                    )}
                                    onclick={() => auction.toggle(lot.id)}
                                >
                                    {@render slotContent(lot, tier.open)}
                                </button>
                            {:else if lot}
                                <span
                                    class="slot"
                                    class:unavailable={!nominable.includes(lot.id)}
                                    title={lotTitle(lot)}
                                >
                                    {@render slotContent(lot, tier.open)}
                                </span>
                            {:else}
                                <span class="slot empty" aria-label="Empty slot"></span>
                            {/if}
                        {/each}
                    </div>
                {/each}
            </div>
        {:else}
            <table class="auction-lot-table">
                <thead
                    ><tr
                        >{#if auction.ownTurn}<th><span class="sr-only">Action</span></th>{/if}<th
                            >Private</th
                        ><th class="amount">Value</th><th class="amount">Opening bid</th></tr
                    ></thead
                >
                <tbody>
                    {#each lots as lot (lot.id)}
                        <tr data-private-description-row class:selected={selected?.id === lot.id}>
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
                                    {#if lot.token}<CompanyToken appearance={lot.token} size={26} />
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
                                                ><PlaceText text={lot.company.description} /></span
                                            >{/if}
                                    </span>
                                </div></th
                            >
                            <td class="amount value">{money(lot.price)}</td>
                            <td class="amount">{money(model.minimumBid(lot.id))}</td>
                        </tr>
                        {#if selected?.id === lot.id && auction.selection && playerId}
                            <tr class="bid-row">
                                <td colspan={columnCount}>
                                    <div class="bid-line" role="group" aria-label="Your bid">
                                        {@render stepper(lot.id, auction.selection.amount, true)}
                                        <span class="figures"
                                            ><span
                                                >Available <strong
                                                    >{money(model.cash(playerId))}</strong
                                                ></span
                                            ></span
                                        >
                                    </div>
                                </td>
                            </tr>
                        {/if}
                    {/each}
                </tbody>
            </table>
        {/if}
        {#if playerId}
            <div class="turn">
                {#if !selected || tiers}<div class="summary">
                        <span
                            >{session.getPlayerName(playerId)} has
                            <strong>{money(model.cash(playerId))}</strong></span
                        >
                    </div>{/if}
                {#if tiers && selected && auction.selection}
                    <div class="summary">
                        <span>Auction <strong>{session.lotName(selected)}</strong></span>
                        {#if selected.company.description}<span class="power full"
                                ><PlaceText text={selected.company.description} /></span
                            >{/if}
                    </div>
                    {@render stepper(selected.id, auction.selection.amount, false)}
                {:else if !selected && auction.ownTurn && auction.passOffered}
                    <button
                        class="pass action-button"
                        disabled={!auction.canPass}
                        onclick={() => auction.pass()}>Pass</button
                    >
                {/if}
            </div>
        {/if}
    </div>
</section>

<style>
    section {
        width: 100%;
        container: selection-lots / inline-size;
    }
    .layout {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px 36px;
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
    .power.full {
        display: block;
    }
    .slot-power {
        font-size: 10px;
        text-align: center;
    }
    .pyramid {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        flex: 0 1 auto;
    }
    .tier {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        padding: 4px 6px;
        border-radius: 8px;
    }
    .tier.open {
        background: var(--rail-surface-raised, #efe7db);
        box-shadow: inset 0 0 0 1px var(--rail-border, #c7b8a6);
    }
    .slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 146px;
        min-height: 44px;
        padding: 4px 6px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514536);
        font: inherit;
        cursor: pointer;
    }
    span.slot {
        cursor: default;
    }
    .slot:disabled,
    .slot.unavailable {
        cursor: default;
        opacity: 0.55;
    }
    .slot.selected {
        background: var(--rail-surface-selected, #e6dccd);
    }
    .slot.empty {
        border-style: dashed;
        background: transparent;
    }
    .slot-heading {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 6px;
    }
    .slot-name {
        font-size: 12px;
        line-height: 1.2;
        text-align: center;
    }
    .slot-value {
        font-size: 11px;
        color: var(--rail-muted, #887969);
        font-variant-numeric: tabular-nums;
    }
    .turn {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        flex: 0 0 200px;
    }
    .summary {
        display: flex;
        flex-direction: column;
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
    @container selection-lots (max-width: 719px) {
        .layout {
            flex-direction: column;
        }
        table {
            flex: none;
        }
        .turn {
            flex-basis: auto;
            align-items: center;
            text-align: center;
        }
        .summary {
            align-items: center;
        }
    }
</style>
