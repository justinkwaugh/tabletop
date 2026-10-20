<script lang="ts">
    import { menuPointer } from '$lib/model/menuPointer.svelte.js'
    import { CardKind } from '@tabletop/oath'
    import BoardCard from '$lib/components/BoardCard.svelte'
    import SiteMagnifier from '$lib/components/SiteMagnifier.svelte'
    import TokenPair from '$lib/components/TokenPair.svelte'
    import { cardName, siteName, slotLabel, suitName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { dimsTheMap, type SiteOffer } from '$lib/model/actionOffers.js'
    import {
        chipWords,
        pickChip,
        travelChip,
        type ChipWay,
        type TravelChip
    } from '$lib/model/travelOnTheMap.js'
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { SITE_SLOT_RECTS, SITE_TOKEN_RADIUS, fitRect } from '$lib/definitions/boardGeometry.js'

    // Keyed by slot and card: a facedown slot's card is in the vault (R-9.4), and R-8.3.5's refill
    // moves cards, so a card that leaves unmounts and ends the preview it opened.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    // The lit map is Setup's start-site menu, the spoils' banish, Travel's, a Travel question's
    // (the Shrouded Wood ruler's pick, the Brass Horse's own) and the site of a power in Use a
    // power, at every width: a tap on a lit site picks it.
    let offers = $derived(gameSession.siteOffers)
    let dimmed = $derived(dimsTheMap(offers))

    function pickOnMap(offer: SiteOffer | undefined): (() => void) | undefined {
        if (offer?.intent === 'start' && offer.pickable) {
            return () => gameSession.setup.chooseSite(offer.slotId)
        }
        if (offer?.intent === 'banish') {
            return () => gameSession.victory.banishTo(offer.slotId)
        }
        if (offer?.intent === 'travel') {
            return () => void gameSession.pickTravelSite(offer.slotId)
        }
        if (offer?.intent === 'question') {
            return () => void gameSession.question.pickTravelSite(offer.slotId)
        }
        if (offer?.intent === 'power') {
            return () => gameSession.actionPowers.pickSite(offer.slotId)
        }
        return undefined
    }

    const SITE_ASPECT = cardAspect({ back: CardKind.Site })

    function restingLabel(slotId: string): string {
        return gameState.isSiteFaceup(slotId)
            ? siteName(gameState, slotId)
            : `Facedown site — ${slotLabel(slotId)}`
    }

    // One reading of the offer: the chip on the card, and what the pick's accessible name adds
    // after it.
    function offerText(offer: SiteOffer | undefined): {
        chip: TravelChip | undefined
        note: string
    } {
        switch (offer?.intent) {
            case 'start':
                // "start here" marks the pick alone; the other start sites are lit with no chip.
                return { chip: offer.picked ? { words: offer.label } : undefined, note: '' }
            case 'travel':
                // R-5.6.1 prices by region, R-7.1.4 adds tolls, R-11.12 the Buried Giant's flip.
                return {
                    chip: offer.cost === undefined ? undefined : travelChip(offer.ways),
                    note: ''
                }
            case 'target':
                return { chip: { words: offer.targeted ? '✓ target' : 'target?' }, note: '' }
            case 'banish':
                return { chip: { words: 'banish' }, note: '' }
            case 'power':
                // What a tap there does: the words of every row it fills.
                return { chip: { words: offer.rows.join(' · ') }, note: '' }
            case 'question':
                // R-11.7 — what the traveller pays there; the card that changed it is named after it.
                // A free move draws only what it still costs (R-7.1.4, R-11.13-H1).
                return {
                    chip: pickChip(offer),
                    note:
                        offer.foldedBy.length > 0
                            ? ` (${offer.foldedBy.map(cardName).join(', ')})`
                            : ''
                }
            case 'moveWarbands':
            case undefined:
                return { chip: undefined, note: '' }
        }
    }
</script>

{#snippet chipWay(way: ChipWay)}
    <span class="travel-cost__way"
        >{way.cost}{#if way.favor > 0}+{way.favor > 1 ? way.favor : ''}<img
                class="travel-cost__token"
                src={favorTokenImage()}
                alt="favor"
            />{/if}{#if way.secrets > 0}+{#each { length: way.secrets }, index (index)}<img
                    class="travel-cost__token"
                    src={secretTokenImage()}
                    alt="secret"
                />{/each}{/if}</span
    >
{/snippet}

{#each Object.entries(SITE_SLOT_RECTS) as [slotId, slot] (`${slotId}:${gameState.siteCardAt(slotId) ?? ''}`)}
    {@const rect = fitRect(slot, SITE_ASPECT)}
    {@const cardId = gameState.siteCardAt(slotId)}
    {@const faceUp = gameState.isSiteFaceup(slotId)}
    {@const offer = offers.find((o) => o.slotId === slotId)}
    {@const targeted = offer?.intent === 'target' && offer.targeted}
    {@const tokens = cardId ? gameState.tokensOn(cardId) : { favor: 0, secrets: 0 }}
    {@const text = offerText(offer)}
    {@const onpick = pickOnMap(offer)}
    {@const onMap =
        offer?.intent === 'travel' ||
        offer?.intent === 'start' ||
        offer?.intent === 'banish' ||
        offer?.intent === 'question' ||
        offer?.intent === 'power'}

    <div
        class="site"
        class:dimmed={dimmed && !offer}
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
            picked={(offer?.intent === 'travel' ||
                offer?.intent === 'start' ||
                offer?.intent === 'power') &&
                offer.picked}
            previewSlotId={slotId}
            {onpick}
            pickLabel={text.chip === undefined
                ? restingLabel(slotId)
                : `${restingLabel(slotId)}, ${chipWords(text.chip)}${text.note}`}
        />

        {#if text.chip !== undefined}
            <!-- Hospitality's gain ends the chip in a dark part: "+1 [favor] [suit] or [suit]". -->
            <span
                class="travel-cost"
                class:targeted
                class:with-gain={'banks' in text.chip && text.chip.banks !== undefined}
            >
                {#if 'words' in text.chip}
                    {text.chip.words}
                {:else if 'free' in text.chip}
                    <!-- A free move: Toll Roads' "toll 1 [favor]", The Hidden Place's "+[secret]", and
                         with the Buried Giant's past a Narrow Pass "+[secret][secret]". -->
                    <span class="travel-cost__cost"
                        >{#if text.chip.free.toll}toll 1<img
                                class="travel-cost__token"
                                src={favorTokenImage()}
                                alt="favor"
                            />{/if}{#if text.chip.free.toll && text.chip.free.secrets > 0}<span
                                class="travel-cost__or">{' · '}</span
                            >{/if}{#if text.chip.free.secrets > 0}+{#each { length: text.chip.free.secrets }, index (index)}<img
                                    class="travel-cost__token"
                                    src={secretTokenImage()}
                                    alt="secret"
                                />{/each}{/if}</span
                    >
                {:else}
                    <span class="travel-cost__cost">
                        {#each text.chip.ways as way, index (index)}
                            {#if index > 0}<span class="travel-cost__or">{' or '}</span>{/if}
                            {@render chipWay(way)}
                        {/each}
                    </span>{#if text.chip.banks}<span class="travel-cost__gain"
                            >+1<img
                                class="travel-cost__token"
                                src={favorTokenImage()}
                                alt="favor"
                            />{#each text.chip.banks as suit, index (suit)}{#if index > 0}<span
                                        class="travel-cost__or">{' or '}</span
                                    >{/if}<img
                                    class="travel-cost__token travel-cost__suit"
                                    src={suitImage(suit)}
                                    alt={`the ${suitName(suit)} bank`}
                                />{/each}</span
                        >{/if}
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

        {#if onpick}
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
        --pad-top: 2px;
        --pad-x: 10px;
        --pad-bottom: 1px;
        display: inline-flex;
        align-items: center;
        padding: var(--pad-top) var(--pad-x) var(--pad-bottom);
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

    /* The ways to pay stay together on one line, as the gain does. */
    .travel-cost__cost {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
    }

    /* With Hospitality's gain the chip breaks only between the cost and the gain: one too wide for
       its card puts the gain on a row under the cost. Each part reaches the chip's edges, so the
       cost is gold and the gain dark whichever way the chip falls; the chip clips both to its
       shape, a pill on one line and rounded corners on two. */
    .travel-cost.with-gain {
        flex-wrap: wrap;
        align-items: stretch;
        column-gap: 0.7em;
        row-gap: calc(var(--pad-top) + var(--pad-bottom));
        overflow: clip;
        border-radius: 1em;
    }

    .travel-cost.with-gain .travel-cost__cost,
    .travel-cost__gain {
        margin-block: calc(-1 * var(--pad-top)) calc(-1 * var(--pad-bottom));
        padding-block: var(--pad-top) var(--pad-bottom);
    }

    /* Gold to the chip's left edge and half way across the gap, over the gain's dark. */
    .travel-cost.with-gain .travel-cost__cost {
        z-index: 1;
        margin-inline: calc(-1 * var(--pad-x)) -0.35em;
        padding-inline: var(--pad-x) 0.35em;
        background: inherit;
    }

    /* Hospitality's gain is not a cost, so not gold: dark to the chip's right edge, and out across
       its whole row (the chip clips it) for the cost to cover where they share one. */
    .travel-cost__gain {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        margin-right: calc(-1 * var(--pad-x));
        padding-right: var(--pad-x);
        background: #1c1917;
        border-image-source: linear-gradient(#1c1917, #1c1917);
        border-image-slice: 0 fill;
        border-image-outset: 0 100vw;
        color: #fafaf9;
    }

    .travel-cost__suit {
        margin-left: 0.15em;
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

    /* On the lit map a token is no taller than the numeral beside it. */
    .site.on-map .travel-cost__token {
        height: 0.78em;
    }

    /* A pick on the map, at every width: the chip is read at the board's zoom, so it is larger
       (about 13 px on screen with the whole board at 1280), wholly on its own card, and over the
       pieces standing there. */
    .site.on-map .travel-cost {
        z-index: 6;
        left: 0;
        right: 0;
        bottom: 14px;
        width: max-content;
        max-width: calc(100% - 16px);
        margin-inline: auto;
        transform: none;
        --pad-top: 3px;
        --pad-x: 20px;
        --pad-bottom: 2px;
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
