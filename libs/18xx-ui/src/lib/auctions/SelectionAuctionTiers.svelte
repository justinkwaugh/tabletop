<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { namedPlaceText } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { privateLotDetail } from './auctionLotDetails.js'

    let { session }: { session: EighteenXXSessionView } = $props()
    const money = $derived(session.presentation.money)
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'Lot tiers require a selection auction')
        return auction.model
    })
    const lotDetail = (lotId: string) => {
        const lot = model.lots.find((item) => item.id === lotId)
        assertExists(lot, 'Remaining auction lot must be known')
        return privateLotDetail(session, lot)
    }
    const nominable = $derived(model.nominationLotIds)
    const tiers = $derived(
        (model.tiers ?? []).map((slots, index) => ({
            label: `Tier ${index + 1}`,
            open: slots.some((lotId) => !!lotId && nominable.includes(lotId)),
            slots: slots.map((lotId) => (lotId ? lotDetail(lotId) : undefined))
        }))
    )
    // While a lot is bid on, the pyramid shows it and takes no nomination.
    const biddingLotId = $derived(model.auction.bidding?.lotId)
    const nominating = $derived(auction.ownTurn && !biddingLotId)
    const selectedLotId = $derived(biddingLotId ?? auction.selection?.lotId)
    const plainDescription = (description: string) => namedPlaceText(description, session.placeName)
    const lotTitle = (lot: ReturnType<typeof lotDetail>) =>
        lot.company.description && plainDescription(lot.company.description)
</script>

{#snippet slotContent(lot: ReturnType<typeof lotDetail>, open: boolean)}
    <span class="slot-heading"
        ><span class="slot-name">{session.lotName(lot)}</span>
        <span class="slot-value">{money(lot.price)}</span></span
    >
    {#if open && lot.company.description}<span class="slot-power"
            >{plainDescription(lot.company.description)}</span
        >{/if}
{/snippet}

<div class="pyramid" role="group" aria-label="Lot tiers">
    {#each tiers as tier (tier.label)}
        <div class="tier" class:open={tier.open} role="group" aria-label={tier.label}>
            {#each tier.slots as lot, index (lot?.id ?? `empty:${index}`)}
                {#if lot && nominating}
                    <button
                        class="slot"
                        class:selected={selectedLotId === lot.id}
                        aria-label={`Auction ${session.lotName(lot)}`}
                        aria-pressed={selectedLotId === lot.id}
                        title={lotTitle(lot)}
                        disabled={!auction.canNominate(lot.id, model.minimumBid(lot.id))}
                        onclick={() => auction.toggle(lot.id)}
                    >
                        {@render slotContent(lot, tier.open)}
                    </button>
                {:else if lot}
                    <span
                        class="slot"
                        class:selected={biddingLotId === lot.id}
                        class:unavailable={biddingLotId !== lot.id && !nominable.includes(lot.id)}
                        aria-current={biddingLotId === lot.id || undefined}
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

<style>
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
    .slot-power {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        max-width: 26rem;
        font-size: 10px;
        font-weight: 400;
        line-height: 1.35;
        text-align: center;
        color: var(--rail-muted, #887969);
    }
</style>
