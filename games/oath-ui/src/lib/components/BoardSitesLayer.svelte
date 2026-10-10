<script lang="ts">
    import { menuPointer } from '$lib/model/menuPointer.svelte.js'
    import { CardKind } from '@tabletop/oath'
    import BoardCard from '$lib/components/BoardCard.svelte'
    import SiteMagnifier from '$lib/components/SiteMagnifier.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { siteName, slotLabel } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { SiteOffer } from '$lib/model/actionOffers.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { travelChip, type ChipWay, type TravelChip } from '$lib/model/travelOnTheMap.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { SITE_SLOT_RECTS, SITE_TOKEN_RADIUS, fitRect } from '$lib/definitions/boardGeometry.js'

    // Keyed by slot and card: a facedown slot's card is in the vault (R-9.4), and R-8.3.5's refill
    // moves cards, so a card that leaves unmounts and ends the preview it opened.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    let offers = $derived(gameSession.siteOffers)

    // On a phone the lit map is Travel's menu: a tap on a destination picks it.
    const layout = new PhoneLayout()

    const SITE_ASPECT = cardAspect({ back: CardKind.Site })

    function restingLabel(slotId: string): string {
        return gameState.isSiteFaceup(slotId)
            ? siteName(gameState, slotId)
            : `Facedown site — ${slotLabel(slotId)}`
    }

    // One reading of the offer: the tooltip and the chip on the card.
    function offerText(
        slotId: string,
        offer: SiteOffer | undefined
    ): { title: string; chip: TravelChip | undefined } {
        const resting = restingLabel(slotId)
        switch (offer?.intent) {
            case 'start':
                return {
                    title: `${siteName(gameState, slotId)} — a start site`,
                    chip: { words: offer.label }
                }
            case 'travel':
                // R-5.6.1 prices by region, R-7.1.4 adds tolls, R-11.12 the Buried Giant's flip.
                return offer.cost === undefined
                    ? { title: resting, chip: undefined }
                    : {
                          title: `Travel here — ${offer.cost} Supply${offer.toll}`,
                          chip: travelChip(offer.ways)
                      }
            case 'target':
                return offer.targeted
                    ? {
                          title: `${siteName(gameState, slotId)} — targeted`,
                          chip: { words: '✓ target' }
                      }
                    : {
                          title: `${siteName(gameState, slotId)} — a target`,
                          chip: { words: 'target?' }
                      }
            case 'moveWarbands':
                return {
                    title: 'Warbands may move from your board onto this site',
                    chip: undefined
                }
            case undefined:
                return { title: resting, chip: undefined }
        }
    }
</script>

{#snippet chipWay(way: ChipWay)}
    <span class="travel-cost__way"
        >{way.cost}{#if way.favor > 0}+{way.favor > 1 ? way.favor : ''}<img
                class="travel-cost__token"
                src={favorTokenImage()}
                alt="favor"
            />{/if}{#if way.secret}+<img
                class="travel-cost__token"
                src={secretTokenImage()}
                alt="secret"
            />{/if}</span
    >
{/snippet}

{#each Object.entries(SITE_SLOT_RECTS) as [slotId, slot] (`${slotId}:${gameState.siteCardAt(slotId) ?? ''}`)}
    {@const rect = fitRect(slot, SITE_ASPECT)}
    {@const cardId = gameState.siteCardAt(slotId)}
    {@const faceUp = gameState.isSiteFaceup(slotId)}
    {@const offer = offers.find((o) => o.slotId === slotId)}
    {@const targeted = offer?.intent === 'target' && offer.targeted}
    {@const tokens = cardId ? gameState.tokensOn(cardId) : { favor: 0, secrets: 0 }}
    {@const text = offerText(slotId, offer)}
    {@const onMap = layout.phone && offer?.intent === 'travel'}

    <div
        class="site"
        class:dimmed={gameSession.mapDimmed && !offer}
        class:targeted
        class:on-map={onMap}
        data-slot={slotId}
        style="left:{rect.x}px; top:{rect.y}px; width:{rect.width}px; height:{rect.height}px;"
    >
        <BoardCard
            {cardId}
            back={faceUp ? undefined : CardKind.Site}
            label={restingLabel(slotId)}
            x={0}
            y={0}
            width={rect.width}
            offered={offer !== undefined}
            pointed={menuPointer.is({ kind: 'site', slotId })}
            picked={offer?.intent === 'travel' && offer.picked}
            previewSlotId={slotId}
            title={text.title}
            onpick={onMap ? () => void gameSession.pickTravelSite(slotId) : undefined}
        />

        {#if text.chip !== undefined}
            <span class="travel-cost" class:targeted>
                {#if 'words' in text.chip}
                    {text.chip.words}
                {:else}
                    {#each text.chip.ways as way, index (index)}
                        {#if index > 0}<span class="travel-cost__or">{' or '}</span>{/if}
                        {@render chipWay(way)}
                    {/each}
                {/if}
            </span>
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

        {#if onMap}
            <SiteMagnifier
                preview={{
                    cardId,
                    back: faceUp ? undefined : CardKind.Site,
                    label: restingLabel(slotId),
                    slotId
                }}
                label={restingLabel(slotId)}
            />
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
        display: inline-flex;
        align-items: center;
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

    .travel-cost__way {
        display: inline-flex;
        align-items: center;
    }

    /* "or" reads smaller than the costs it joins. */
    .travel-cost__or {
        font-size: 0.7em;
        white-space: pre;
    }

    /* Sized by its height alone: a percentage cap would let the chip measure it at no width. */
    .travel-cost__token {
        flex: none;
        height: 1em;
        width: auto;
        max-width: none;
        margin-left: 0.1em;
    }

    /* On the phone map a token is no taller than the numeral beside it. */
    .site.on-map .travel-cost__token {
        height: 0.78em;
    }

    /* On a phone the chip is read at the map's zoom: larger, wholly on its own card, and over
       the pieces standing there. */
    .site.on-map .travel-cost {
        z-index: 6;
        left: 0;
        right: 0;
        bottom: 14px;
        width: max-content;
        max-width: calc(100% - 16px);
        margin-inline: auto;
        transform: none;
        padding: 3px 20px 2px;
        font-size: 36px;
        white-space: normal;
        text-align: center;
        justify-content: center;
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
