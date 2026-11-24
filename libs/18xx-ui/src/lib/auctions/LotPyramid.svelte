<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { selectionLotName } from './auctionLotDetails.js'
    import { lotStandingText, type PyramidLot } from './lotPyramid.js'

    let {
        session,
        tiers,
        openTier,
        inspectedLotId,
        turnLotId,
        doomedLotIds,
        onInspect,
        onHover
    }: {
        session: EighteenXXSessionView
        tiers: readonly (readonly (PyramidLot | undefined)[])[]
        openTier: number
        inspectedLotId?: string
        turnLotId?: string
        doomedLotIds: readonly string[]
        onInspect: (lot: PyramidLot) => void
        onHover: (lot: PyramidLot | undefined) => void
    } = $props()

    const initials = (lotId: string) => session.lotInitials({ id: lotId })
    const label = (lot: PyramidLot) =>
        `${selectionLotName(session, lot.lotId)}, ${lotStandingText(lot, (id) => session.getPlayerName(id), session.presentation.money)}`
    function hover(event: PointerEvent, lot: PyramidLot | undefined) {
        if (event.pointerType === 'mouse') onHover(lot)
    }
</script>

<div class="pyramid" role="group" aria-label="Lot pyramid">
    {#each tiers as row, tier (tier)}
        <div
            class="tier"
            class:open={tier === openTier}
            role="group"
            aria-label={`Row ${tier + 1}`}
        >
            {#each row as lot, index (lot?.lotId ?? `empty:${index}`)}
                {#if lot}
                    {@const sold = lot.status.kind === 'sold' ? lot.status.award : undefined}
                    <button
                        class={['disc', lot.status.kind]}
                        class:inspected={inspectedLotId === lot.lotId}
                        class:turn-lot={turnLotId === lot.lotId}
                        class:doomed={doomedLotIds.includes(lot.lotId)}
                        style:background={sold
                            ? session.playerColorValue(sold.playerId)
                            : undefined}
                        style:color={sold ? session.playerTextColorValue(sold.playerId) : undefined}
                        aria-label={label(lot)}
                        aria-pressed={inspectedLotId === lot.lotId}
                        title={selectionLotName(session, lot.lotId)}
                        onclick={() => onInspect(lot)}
                        onpointerenter={(event) => hover(event, lot)}
                        onpointerleave={(event) => hover(event, undefined)}
                        >{initials(lot.lotId)}</button
                    >
                {:else}
                    <span class="disc empty" aria-label="Empty slot"></span>
                {/if}
            {/each}
        </div>
    {/each}
</div>

<style>
    .pyramid {
        --disc: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
    }
    .tier {
        display: flex;
        gap: 3px;
        padding: 2px 6px;
        border-radius: calc(var(--disc) / 2 + 3px);
    }
    .tier.open {
        background: var(--rail-surface-raised, #efe7db);
        box-shadow: inset 0 0 0 1px var(--rail-border, #c7b8a6);
    }
    /* Beats the action panel's own button font. */
    .pyramid .disc {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: var(--disc);
        height: var(--disc);
        padding: 0;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 50%;
        background: var(--rail-surface-inset, #ece4d8);
        color: var(--rail-muted, #887969);
        font-family: inherit;
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        white-space: nowrap;
        cursor: pointer;
    }
    .disc.open,
    .disc.bidding {
        background: var(--rail-text, #514536);
        color: var(--rail-surface, #fffdf8);
        border-color: var(--rail-text, #514536);
    }
    .disc.sold {
        border-color: transparent;
    }
    .disc.removed,
    .disc.empty {
        border-style: dashed;
        background: transparent;
    }
    .disc.removed {
        color: transparent;
    }
    .disc.empty {
        cursor: default;
    }
    .disc.doomed {
        background: repeating-linear-gradient(
            45deg,
            var(--rail-text, #514536) 0 3px,
            var(--rail-muted, #887969) 3px 6px
        );
    }
    .disc.turn-lot {
        box-shadow:
            0 0 0 2px var(--rail-surface, #fffdf8),
            0 0 0 4px var(--rail-warning, #d08a1c);
    }
    .disc.inspected {
        outline: 2px solid var(--rail-text, #514536);
        outline-offset: 2px;
    }
    @container lot-pyramid (max-width: 299px) {
        .pyramid {
            --disc: 26px;
        }
        .pyramid .disc {
            font-size: 8px;
        }
    }
</style>
