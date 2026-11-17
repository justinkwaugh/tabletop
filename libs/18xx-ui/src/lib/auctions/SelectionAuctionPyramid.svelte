<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import LotPyramid from './LotPyramid.svelte'
    import LotPyramidDetail from './LotPyramidDetail.svelte'
    import { lotSaleConsequence, openTier, pyramidTiers, type PyramidLot } from './lotPyramid.js'

    let { session }: { session: EighteenXXSessionView } = $props()
    const auction = $derived(session.selectionAuction)
    const model = $derived.by(() => {
        assertExists(auction.model, 'The lot pyramid requires a selection auction')
        return auction.model
    })
    const tiers = $derived(pyramidTiers(model))
    const lots = $derived(tiers.flat().filter((lot) => !!lot))
    const nominating = $derived(auction.ownTurn && !model.auction.bidding)
    const turnLotId = $derived(model.auction.bidding?.lotId ?? auction.selection?.lotId)

    let inspectedLotId = $state<string>()
    let hoveredLotId = $state<string>()
    const focus = $derived.by(() => {
        const lotId = hoveredLotId ?? inspectedLotId ?? turnLotId
        return lots.find((lot) => lot.lotId === lotId)
    })
    const consequenceOf = (lot: PyramidLot | undefined) => {
        if (!lot) return undefined
        const selection = auction.selection
        const amount =
            selection?.lotId === lot.lotId ? selection.amount : model.minimumBid(lot.lotId)
        return lotSaleConsequence(model, lot, amount)
    }
    const consequence = $derived(consequenceOf(focus))
    const turnLot = $derived(lots.find((lot) => lot.lotId === turnLotId))
    const doomedLotIds = $derived((consequence ?? consequenceOf(turnLot))?.removedLotIds ?? [])

    function inspect(lot: PyramidLot) {
        const shownBeforeTap = (inspectedLotId ?? turnLotId) === lot.lotId
        inspectedLotId = lot.lotId
        if (nominating && lot.status.kind === 'open') stage(lot, shownBeforeTap)
    }
    function stage(lot: PyramidLot, shownBeforeTap: boolean) {
        if (auction.selection?.lotId === lot.lotId) {
            if (shownBeforeTap) auction.toggle(lot.lotId)
        } else if (auction.canNominate(lot.lotId, model.minimumBid(lot.lotId))) {
            auction.select(lot.lotId)
        }
    }
</script>

<div class="frame">
    <div class="layout">
        <LotPyramid
            {session}
            {tiers}
            openTier={openTier(model)}
            inspectedLotId={focus?.lotId}
            {turnLotId}
            {doomedLotIds}
            onInspect={inspect}
            onHover={(lot) => (hoveredLotId = lot?.lotId)}
        />
        <div class="strip">
            {#if focus}
                <LotPyramidDetail {session} lot={focus} {consequence} />
            {:else}
                <p class="hint">
                    <span>Tap a lot to read it.</span>{#if nominating}
                        <span>Lots in the highlighted row can be auctioned.</span>{/if}
                </p>
            {/if}
        </div>
    </div>
</div>

<style>
    .frame {
        width: 100%;
        container: lot-pyramid / inline-size;
    }
    .layout {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    .strip {
        align-self: stretch;
        display: flex;
        justify-content: center;
        min-height: 64px;
        padding-top: 8px;
        border-top: 1px solid var(--rail-border, #c7b8a6);
    }
    .hint {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0;
        color: var(--rail-muted, #887969);
        font-size: 11px;
        font-style: italic;
    }
    @container lot-pyramid (min-width: 340px) {
        .layout {
            flex-direction: row;
            justify-content: center;
            align-items: center;
            gap: 12px;
        }
        .strip {
            align-self: center;
            flex: 1 1 140px;
            max-width: 280px;
            justify-content: flex-start;
            padding: 0 0 0 12px;
            border-top: 0;
            border-left: 1px solid var(--rail-border, #c7b8a6);
        }
    }
</style>
