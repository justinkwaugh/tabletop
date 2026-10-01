<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import BoardCard from '$lib/components/BoardCard.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { siteName, slotLabel } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { SiteOffer } from '$lib/model/actionOffers.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { SITE_SLOT_RECTS, SITE_TOKEN_RADIUS, fitRect } from '$lib/definitions/boardGeometry.js'

    // Keyed by slot and card: a facedown slot's card is in the vault (R-9.4), and R-8.3.5's refill
    // moves cards, so a card that leaves unmounts and ends the preview it opened.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let offers = $derived(gameSession.siteOffers)

    const SITE_ASPECT = cardAspect({ backKind: CardKind.Site, faceDown: true })

    function restingLabel(slotId: string): string {
        return gameState.isSiteFaceup(slotId)
            ? siteName(gameState, slotId)
            : `Facedown site — ${slotLabel(slotId)}`
    }

    // One reading of the offer: the tooltip and the chip under the card.
    function offerText(slotId: string, offer: SiteOffer | undefined) {
        const resting = restingLabel(slotId)
        switch (offer?.intent) {
            case 'start':
                return { title: `Tap to choose ${siteName(gameState, slotId)}`, chip: offer.label }
            case 'travel':
                // R-5.6.1 prices by region, R-7.1.4 adds tolls: shown before the tap.
                return offer.cost === undefined
                    ? { title: resting, chip: undefined }
                    : {
                          title: `Travel here — ${offer.cost} Supply${offer.toll}`,
                          chip: `${offer.cost} supply${offer.toll}`
                      }
            case 'target':
                return offer.targeted
                    ? {
                          title: `Targeted — tap to drop ${siteName(gameState, slotId)}`,
                          chip: '✓ target'
                      }
                    : { title: `Tap to target ${siteName(gameState, slotId)}`, chip: 'target?' }
            case 'moveWarbands':
                return {
                    title: 'Tap to move warbands from your board onto this site',
                    chip: undefined
                }
            case undefined:
                return { title: resting, chip: undefined }
        }
    }
</script>

{#each Object.entries(SITE_SLOT_RECTS) as [slotId, slot] (`${slotId}:${gameState.siteCardAt(slotId) ?? ''}`)}
    {@const rect = fitRect(slot, SITE_ASPECT)}
    {@const cardId = gameState.siteCardAt(slotId)}
    {@const faceUp = gameState.isSiteFaceup(slotId)}
    {@const offer = offers.find((o) => o.slotId === slotId)}
    {@const targeted = offer?.intent === 'target' && offer.targeted}
    {@const tokens = cardId ? gameState.tokensOn(cardId) : { favor: 0, secrets: 0 }}
    {@const text = offerText(slotId, offer)}

    <div
        class="site"
        class:dimmed={gameSession.mapDimmed && !offer}
        class:targeted
        style="left:{rect.x}px; top:{rect.y}px; width:{rect.width}px; height:{rect.height}px;"
    >
        <BoardCard
            {cardId}
            faceDown={!faceUp}
            backKind={CardKind.Site}
            label={restingLabel(slotId)}
            x={0}
            y={0}
            width={rect.width}
            pickable={offer !== undefined}
            onpick={() => gameSession.chooseSite(slotId)}
            previewSlotId={slotId}
            title={text.title}
        />

        {#if text.chip !== undefined}
            <span class="travel-cost" class:targeted>{text.chip}</span>
        {/if}

        {#if tokens.favor > 0 || tokens.secrets > 0}
            <span class="tokens">
                <TokenPair
                    favor={tokens.favor}
                    secrets={tokens.secrets}
                    size={SITE_TOKEN_RADIUS * 2}
                />
            </span>
        {/if}
    </div>
{/each}

<style>
    .site {
        position: absolute;
    }

    /* Dimming belongs to the site, so `BoardCard` never learns board state. */
    .site.dimmed {
        filter: grayscale(0.55) brightness(0.62);
    }

    .site.targeted {
        outline: 5px solid #f43f5e;
        outline-offset: 3px;
        border-radius: 8px;
    }

    .travel-cost.targeted {
        background: #f43f5e;
        color: #fff;
    }

    .travel-cost {
        position: absolute;
        left: 50%;
        bottom: -13px;
        transform: translateX(-50%);
        z-index: 3;
        padding: 2px 10px 1px;
        border-radius: 999px;
        background: #fbbf24;
        color: #1c1917;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.04em;
        white-space: nowrap;
        pointer-events: none;
    }

    /* Top-left: the only corner the site's own print leaves free. */
    .tokens {
        position: absolute;
        left: 6px;
        top: 6px;
        z-index: 4;
        display: flex;
        flex-direction: row;
        gap: 4px;
        pointer-events: none;
    }
</style>
