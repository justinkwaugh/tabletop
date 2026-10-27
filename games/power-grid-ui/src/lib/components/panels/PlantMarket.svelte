<script lang="ts">
    import { PlantBack, Step, isPlant, marketSize } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marketView } from '$lib/animators/marketAnimator.js'
    import {
        MARKET_CARD,
        MARKET_COLUMN_GAP,
        MARKET_ROW_GAP,
        marketColumns
    } from '$lib/utils/marketLayout.js'
    import { SOCKET_BACK_IMAGE } from '$lib/utils/plantImages.js'
    import PlantCard from '../PlantCard.svelte'
    import PlugBack from './PlugBack.svelte'

    let { width }: { width: number } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)

    const CARD = MARKET_CARD
    const view = $derived(session.animatedMarket ?? marketView(state))
    const columns = $derived(marketColumns(view.step))
    const slotCount = $derived(marketSize(view.step))
    const auctionPlant = $derived(state.auction?.plant)
    const highBid = $derived(state.auction?.bidding.highBid)
</script>

<section class="panel" style:width="{width}px">
    <header>
        <h2>Power plant market</h2>
        <div class="step">Step {state.step}</div>
    </header>
    <div class="body">
        <div
            class="rows"
            style:--card="{CARD}px"
            style:--columns={columns}
            style:--column-gap="{MARKET_COLUMN_GAP}px"
            style:--row-gap="{MARKET_ROW_GAP}px"
        >
            <div class="row-label first">
                {view.step === Step.Three ? 'Market' : 'Current market'}
            </div>
            {#if view.step !== Step.Three}
                <div class="row-label second">Future market</div>
            {/if}
            <div class="grid slots" aria-hidden="true">
                {#each { length: slotCount } as _, slot (slot)}
                    <div class="slot"></div>
                {/each}
            </div>
            <div class="cards">
                {#each view.cards as { card, at } (card)}
                    {@const plant = isPlant(card) ? card : undefined}
                    <div
                        class="card-cell"
                        style:left="{at.x}px"
                        style:top="{at.y}px"
                        {@attach session.marketAnimator.attach(card)}
                    >
                        <PlantCard
                            plant={card}
                            size={CARD}
                            targetable={plant !== undefined &&
                                session.choosablePlants.includes(plant) &&
                                session.chosenPlant !== plant}
                            selected={plant !== undefined &&
                                (session.chosenPlant === plant || auctionPlant === plant)}
                            dimmed={session.choosingPlant &&
                                (plant === undefined || !session.choosablePlants.includes(plant))}
                            onclick={plant !== undefined && session.choosablePlants.includes(plant)
                                ? () => session.choosePlant(plant)
                                : undefined}
                        >
                            {#if plant !== undefined && plant === state.discountPlant}
                                <div class="discount" title="Discount: minimum bid 1">1</div>
                            {/if}
                            {#if plant !== undefined && plant === auctionPlant}
                                <div class="gavel">Bid {highBid}</div>
                            {/if}
                        </PlantCard>
                    </div>
                {/each}
            </div>
        </div>
        <div class="stack">
            <div class="row-label">Stack</div>
            {#if state.deckCount > 0}
                <div class="deck" style:width="{CARD * 0.8}px" style:height="{CARD * 0.8}px">
                    {#each { length: Math.min(3, state.deckCount) } as _, layer (layer)}
                        <div
                            class="layer"
                            style:transform="translate({layer * -2}px, {layer * -2}px)"
                        >
                            {#if state.deckTopBack === PlantBack.Plug}
                                <PlugBack />
                            {:else}
                                <img src={SOCKET_BACK_IMAGE} alt="" draggable="false" />
                            {/if}
                        </div>
                    {/each}
                </div>
                <div class="count">{state.deckCount} left</div>
            {:else}
                <div class="empty" style:width="{CARD * 0.8}px" style:height="{CARD * 0.8}px">
                    Empty
                </div>
            {/if}
            {#if state.underStack.length > 0}
                <div class="under">
                    <div class="row-label">Under the stack</div>
                    <div class="under-list">
                        {#each state.underStack as plant (plant)}
                            <span>{plant}</span>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</section>

<style>
    .panel {
        background: #56643f;
        border-radius: 10px;
        border: 3px solid #2f3825;
        box-shadow: inset 0 0 0 2px #6b7a4f;
        color: #ecebe1;
        padding: 10px 16px 16px;
    }
    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        border-bottom: 2px solid #3a4528;
        margin-bottom: 8px;
    }
    h2 {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 30px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 1.1;
    }
    .step {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 22px;
        text-transform: uppercase;
        background: #23291c;
        color: #f3c534;
        padding: 0 10px;
        border-radius: 4px;
    }
    .body {
        display: flex;
        gap: 18px;
    }
    .rows {
        position: relative;
        width: calc(var(--columns) * var(--card) + (var(--columns) - 1) * var(--column-gap));
        height: calc(2 * var(--card) + var(--row-gap) + 22px);
    }
    .grid {
        position: absolute;
        top: 22px;
        left: 0;
        display: grid;
        grid-template-columns: repeat(var(--columns), var(--card));
        grid-auto-rows: var(--card);
        column-gap: var(--column-gap);
        row-gap: var(--row-gap);
    }
    .cards {
        position: absolute;
        top: 22px;
        left: 0;
    }
    .row-label.first,
    .row-label.second {
        position: absolute;
        left: 0;
        margin: 0;
    }
    .row-label.first {
        top: 0;
    }
    .row-label.second {
        top: calc(var(--card) + var(--row-gap));
    }
    .card-cell {
        position: absolute;
        width: var(--card);
        height: var(--card);
    }
    .row-label {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 600;
        font-size: 15px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #cfd4bd;
        margin: 4px 0 4px;
        min-height: 18px;
    }
    .slot {
        border-radius: 9px;
        background: #3b4529;
        box-shadow: inset 0 2px 5px rgb(0 0 0 / 0.45);
    }
    .discount {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #d7b04a;
        border: 3px solid #8a6b1f;
        color: #2b2210;
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 22px;
        display: grid;
        place-items: center;
        box-shadow: 0 2px 3px rgb(0 0 0 / 0.5);
    }
    .gavel {
        position: absolute;
        left: 50%;
        bottom: -12px;
        transform: translateX(-50%);
        white-space: nowrap;
        background: #1e241a;
        color: #f3c534;
        border: 2px solid #f3c534;
        border-radius: 5px;
        padding: 0 8px;
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 17px;
    }
    .stack {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }
    .deck {
        position: relative;
        margin: 6px 0 0 6px;
    }
    .layer {
        position: absolute;
        inset: 0;
        border-radius: 8%;
        overflow: hidden;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
    }
    .layer img {
        width: 100%;
        height: 100%;
        display: block;
    }
    .count {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 17px;
        margin-top: 6px;
    }
    .empty {
        border: 2px dashed #8d987a;
        border-radius: 8%;
        display: grid;
        place-items: center;
        font-family: 'Barlow Condensed', sans-serif;
        color: #b9c0a6;
    }
    .under {
        margin-top: 10px;
        max-width: 110px;
    }
    .under-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .under-list span {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 15px;
        background: #2a3220;
        border-radius: 4px;
        padding: 0 5px;
    }
</style>
