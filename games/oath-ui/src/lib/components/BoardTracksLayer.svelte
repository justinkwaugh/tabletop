<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import {
        ActionType,
        CardKind,
        DISCARD_SEARCH_SUPPLY_COST,
        FAVOR_BANK_ORDER,
        FINAL_ROUND,
        type Region,
        SearchSource,
        worldDeckSearchCost
    } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import { visionsMarkerImage } from '$lib/images/tileImages.js'
    import TokenBadge from '$lib/components/TokenBadge.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import {
        DISCARD_CARD_INSET,
        DISCARD_RECTS,
        DISCARD_ROTATED,
        FAVOR_BANK_CENTERS,
        FAVOR_BANK_RADIUS,
        REGIONS,
        RELIC_DECK_RECT,
        SHARED_FAVOR_CENTER,
        VISIONS_TRACK_CELLS,
        WORLD_DECK_RECT,
        WORLD_DECK_ROTATED,
        centerOf,
        fitRect,
        laidCardIn,
        roundMarkerCenter
    } from '$lib/definitions/boardGeometry.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    // R-8.5 fixes five Visions, and the engine stops the track at its last cell.
    let visionsCell = $derived.by(() => {
        const cell = VISIONS_TRACK_CELLS[gameState.visionsDrawn]
        assertExists(cell, `The Visions track has no cell ${gameState.visionsDrawn}`)
        return cell
    })

    const RELIC_ASPECT = cardAspect({ backKind: CardKind.Relic, faceDown: true })
    const WORLD_ASPECT = cardAspect({ backKind: CardKind.Denizen, faceDown: true })

    const relicDeckCard = fitRect(RELIC_DECK_RECT, RELIC_ASPECT)

    // The world deck lies sideways in a landscape space.
    const worldDeckCard = WORLD_DECK_ROTATED
        ? laidCardIn(WORLD_DECK_RECT, WORLD_ASPECT)
        : fitRect(WORLD_DECK_RECT, WORLD_ASPECT)

    const worldDeckCenter = centerOf(WORLD_DECK_RECT)

    let roundCenter = $derived(roundMarkerCenter(gameState.round))

    // R-5.1.1 — a Search picks its source.
    let searching = $derived(gameSession.selection.action === ActionType.Search)
    let sources = $derived(searching ? gameSession.searchSources : [])
    let myRegion = $derived.by(() => {
        const siteId = gameSession.myPlayerState?.siteId
        return siteId ? gameState.regionOf(siteId) : undefined
    })
    let worldDeckPickable = $derived(sources.includes(SearchSource.WorldDeck))
    function discardPickable(region: Region): boolean {
        return sources.includes(SearchSource.Discard) && region === myRegion
    }
</script>

<!-- R-2.1.3 — the six favor banks, in the engine's own bank order. -->
{#each FAVOR_BANK_ORDER as suit (suit)}
    {@const center = FAVOR_BANK_CENTERS[suit]}
    <span
        class="bank"
        title="{gameState.favorBank[suit]} favor in the {suit} bank"
        style="left:{center.x - FAVOR_BANK_RADIUS}px; top:{center.y - FAVOR_BANK_RADIUS}px;
               width:{FAVOR_BANK_RADIUS * 2}px; height:{FAVOR_BANK_RADIUS * 2}px;"
    >
        <TokenBadge kind="favor" count={gameState.favorBank[suit]} size={FAVOR_BANK_RADIUS * 2} />
    </span>
{/each}

<!-- R-2.1.7 — the shared favor supply, a seventh disc beside the banks. -->
<span
    class="bank bank--shared"
    title="{gameState.favorSupply} favor in the shared supply"
    style="left:{SHARED_FAVOR_CENTER.x - FAVOR_BANK_RADIUS}px; top:{SHARED_FAVOR_CENTER.y -
        FAVOR_BANK_RADIUS}px;
           width:{FAVOR_BANK_RADIUS * 2}px; height:{FAVOR_BANK_RADIUS * 2}px;"
>
    <TokenBadge kind="favor" count={gameState.favorSupply} size={FAVOR_BANK_RADIUS * 2} />
</span>
<span
    class="bank-label"
    style="left:{SHARED_FAVOR_CENTER.x}px; top:{SHARED_FAVOR_CENTER.y + FAVOR_BANK_RADIUS + 6}px;"
>
    shared
</span>

<span
    class="round"
    class:round--last={gameState.round >= FINAL_ROUND}
    title="Round {gameState.round} of {FINAL_ROUND}"
    style="left:{roundCenter.x}px; top:{roundCenter.y}px;"
>
    {gameState.round}
</span>

<!-- R-2.1.6 — the Visions Drawn marker; the Search price is on the deck while a Search is chosen. -->
<span
    class="visions"
    title="{gameState.visionsDrawn} Visions drawn — Searching the world deck costs {worldDeckSearchCost(
        gameState.visionsDrawn
    )} Supply"
    style="left:{visionsCell.x}px; top:{visionsCell.y}px;
           width:{visionsCell.width}px; height:{visionsCell.height}px;"
>
    <img src={visionsMarkerImage()} alt="Visions drawn: {gameState.visionsDrawn}" />
</span>

<!-- R-2.1.2 — one discard box per region. R-9.4 keeps the pile's fronts private;
     its count and the back on top are public. -->
{#each REGIONS as region (region)}
    {@const box = DISCARD_RECTS[region]}
    {@const count = gameState.discardPileCountIn(region)}
    {@const back = gameState.discardTopBackIn(region)}
    {@const pickable = discardPickable(region)}
    <button
        type="button"
        class="discard"
        class:empty={count === 0}
        class:pickable
        disabled={!pickable}
        title={pickable
            ? `Search this discard pile — ${DISCARD_SEARCH_SUPPLY_COST} Supply`
            : `${count} cards in the ${region} discard pile`}
        style="left:{box.x}px; top:{box.y}px; width:{box.width}px; height:{box.height}px;"
        onclick={() => void gameSession.chooseSearchSource(SearchSource.Discard)}
    >
        {#if count > 0 && back}
            {@const pile = laidCardIn(box, WORLD_ASPECT, DISCARD_CARD_INSET)}
            <span
                class="discard__pile"
                class:discard__pile--laid={DISCARD_ROTATED}
                style="left:{pile.center.x - box.x}px; top:{pile.center.y - box.y}px;"
            >
                <CardImage
                    faceDown
                    backKind={back}
                    width={pile.width}
                    label="{region} discard pile"
                />
            </span>
        {/if}
        <span class="discard__count">{count}</span>
        {#if pickable}<span class="pick-cost pick-cost--discard"
                >{DISCARD_SEARCH_SUPPLY_COST} supply</span
            >{/if}
    </button>
{/each}

<!-- R-2.7 — the Relic Deck; R-9.4 makes its count private. -->
<div class="deck" style="left:{relicDeckCard.x}px; top:{relicDeckCard.y}px;" title="The relic deck">
    <CardImage faceDown backKind={CardKind.Relic} width={relicDeckCard.width} label="Relic deck" />
</div>

<!-- R-2.7 — the World Deck, sideways. Its count is private; the top card's back
     type is public and is what says a Vision is next (R-2.7.1). -->
{#snippet worldDeckFace()}
    {#if worldDeckPickable}
        <span class="pick-cost pick-cost--deck"
            >{worldDeckSearchCost(gameState.visionsDrawn)} supply</span
        >
    {/if}
    {#if gameState.worldDeckExhausted}
        <span class="deck__exhausted" style="width:{worldDeckCard.height}px;">exhausted</span>
    {:else}
        <CardImage
            faceDown
            backKind={gameState.topCardBackType ?? CardKind.Denizen}
            width={worldDeckCard.width}
            label="World deck — next card is a {gameState.topCardBackType ?? 'card'}"
        />
    {/if}
{/snippet}
{#if worldDeckPickable}
    <button
        type="button"
        class="deck deck--laid pickable"
        title="Search the world deck — {worldDeckSearchCost(gameState.visionsDrawn)} Supply"
        style="left:{worldDeckCenter.x}px; top:{worldDeckCenter.y}px;"
        onclick={() => void gameSession.chooseSearchSource(SearchSource.WorldDeck)}
    >
        {@render worldDeckFace()}
    </button>
{:else}
    <div class="deck deck--laid" style="left:{worldDeckCenter.x}px; top:{worldDeckCenter.y}px;">
        {@render worldDeckFace()}
    </div>
{/if}

<style>
    .bank {
        position: absolute;
        z-index: 6;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        pointer-events: auto;
    }

    .bank--shared {
        filter: brightness(1.08);
    }

    .bank-label {
        position: absolute;
        z-index: 6;
        transform: translateX(-50%);
        color: #fef3c7;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
        pointer-events: none;
    }

    .round {
        position: absolute;
        z-index: 6;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #d6d3d1, #78716c 70%);
        border: 3px solid rgba(28, 25, 23, 0.85);
        color: #1c1917;
        font-size: 32px;
        font-weight: 800;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        pointer-events: auto;
    }

    .round--last {
        background: radial-gradient(circle at 35% 30%, #fecaca, #b91c1c 70%);
        color: #fff;
    }

    /* The same amber ring the sites wear when pickable, with the price on a chip. */
    .pickable {
        cursor: pointer;
        outline: 4px solid #fbbf24;
        outline-offset: 2px;
        border-radius: 8px;
        box-shadow: 0 0 18px 4px rgba(251, 191, 36, 0.55);
    }
    .pickable:hover,
    .pickable:focus-visible {
        outline-color: #fde68a;
    }
    button.discard,
    button.deck {
        background: transparent;
        border: 0;
        padding: 0;
        font: inherit;
        color: inherit;
        text-align: inherit;
    }
    button.discard:disabled {
        cursor: default;
    }
    .pick-cost {
        position: absolute;
        left: 50%;
        bottom: -14px;
        transform: translateX(-50%);
        z-index: 7;
        padding: 3px 12px;
        border-radius: 999px;
        background: rgba(251, 191, 36, 0.96);
        color: #1c1917;
        font-size: 18px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
    }
    .pick-cost--discard {
        bottom: -22px;
    }
    .pick-cost--deck {
        transform: translateX(-50%) rotate(-90deg);
        bottom: auto;
        left: 50%;
        top: 50%;
    }

    .visions {
        position: absolute;
        z-index: 6;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    }
    .visions img {
        height: 112%;
        width: auto;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
    }

    .discard {
        position: absolute;
        z-index: 6;
        display: flex;
        cursor: default;
        align-items: center;
        justify-content: flex-end;
        padding-right: 14px;
        pointer-events: auto;
    }

    .discard__pile {
        position: absolute;
        line-height: 0;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
    }

    .discard__pile--laid {
        transform: translate(-50%, -50%) rotate(90deg);
    }

    .discard__count {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 62px;
        height: 62px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(12, 10, 9, 0.82);
        color: #fef3c7;
        font-size: 34px;
        font-weight: 800;
        line-height: 1;
    }

    .discard.empty .discard__count {
        background: rgba(12, 10, 9, 0.4);
        color: rgba(254, 243, 199, 0.55);
    }

    .deck {
        position: absolute;
        z-index: 6;
        line-height: 0;
    }

    /* Positioned by its centre and turned about it, so box and card centres coincide. */
    .deck--laid {
        transform: translate(-50%, -50%) rotate(90deg);
    }

    .deck__exhausted {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 0;
        border-radius: 8px;
        background: rgba(12, 10, 9, 0.82);
        color: #fca5a5;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
</style>
