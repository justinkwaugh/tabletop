<script lang="ts">
    import { MARKET_SPACES, RESOURCES, Resource } from '@tabletop/power-grid'
    import { RESOURCE_NAMES } from '$lib/utils/resourceNames.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ResourceToken from '../ResourceToken.svelte'

    let { width }: { width: number } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)

    const PAD = 16
    const LABEL = 104
    const HEADER = 50
    const ROW = 64
    const COIN_ROW = 26
    const height = HEADER + COIN_ROW + ROW * 4 + PAD

    type Slot = { x: number; filled: boolean; inCart: boolean }
    type Cell = { x: number; width: number; price: number; slots: Slot[] }

    const rows = $derived(
        RESOURCES.map((resource, index) => {
            const spaces = MARKET_SPACES[resource]
            const cellWidth = (width - 2 * PAD - LABEL) / spaces.length
            const capacity = spaces.reduce((sum, space) => sum + space.capacity, 0)
            const firstFilled = capacity - state.resourceMarket[resource]
            const inCart = session.basket[resource]
            let slotIndex = 0
            const cells: Cell[] = spaces.map((space, spaceIndex) => {
                const x = PAD + LABEL + spaceIndex * cellWidth
                const slots = Array.from({ length: space.capacity }, (_, slot) => {
                    const position = slotIndex++
                    return {
                        x: x + ((slot + 0.5) * cellWidth) / space.capacity,
                        filled: position >= firstFilled,
                        inCart: position >= firstFilled && position < firstFilled + inCart
                    }
                })
                return { x, width: cellWidth, price: space.price, slots }
            })
            return {
                resource,
                y: HEADER + COIN_ROW + index * ROW,
                cells,
                addable: session.canAddToCart(resource),
                supply: state.supply(resource)
            }
        })
    )
    const threeSpaceCells = $derived(rows[0].cells)
</script>

<svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    class="block select-none"
    role="img"
    aria-label="Resource market"
>
    <rect
        x="1.5"
        y="1.5"
        width={width - 3}
        height={height - 3}
        rx="10"
        fill="#56643f"
        stroke="#2f3825"
        stroke-width="3"
    ></rect>
    <rect
        x="4.5"
        y="4.5"
        width={width - 9}
        height={height - 9}
        rx="8"
        fill="none"
        stroke="#6b7a4f"
        stroke-width="2"
    ></rect>
    <text class="title" x={PAD} y="34">Resource market</text>
    <line
        x1={PAD}
        y1={HEADER - 6}
        x2={width - PAD}
        y2={HEADER - 6}
        stroke="#3a4528"
        stroke-width="2"
    ></line>

    {#each threeSpaceCells as cell (cell.price)}
        <g transform="translate({cell.x + cell.width / 2} {HEADER + COIN_ROW / 2})">
            <circle r="11" fill="#d7b04a" stroke="#8a6b1f" stroke-width="2"></circle>
            <text class="coin" text-anchor="middle" dominant-baseline="central">{cell.price}</text>
        </g>
    {/each}

    {#each rows as row (row.resource)}
        {@const uranium = row.resource === Resource.Uranium}
        <g
            class:addable={row.addable}
            role="button"
            aria-disabled={!row.addable}
            tabindex={row.addable ? 0 : -1}
            aria-label="Buy {RESOURCE_NAMES[row.resource].toLowerCase()}"
            onclick={() => session.addToCart(row.resource)}
            onkeydown={(event) =>
                (event.key === 'Enter' || event.key === ' ') && session.addToCart(row.resource)}
        >
            <rect
                class="row-hit"
                x={PAD - 6}
                y={row.y + 2}
                width={width - 2 * PAD + 12}
                height={ROW - 4}
                rx="6"
                fill={row.addable ? '#647349' : 'transparent'}
            ></rect>
            <ResourceToken resource={row.resource} x={PAD + 12} y={row.y + ROW / 2 - 4} size={20} />
            <text class="label" x={PAD + 28} y={row.y + ROW / 2 - 6} dominant-baseline="central"
                >{RESOURCE_NAMES[row.resource]}</text
            >
            <text class="supply" x={PAD + 28} y={row.y + ROW / 2 + 11} dominant-baseline="central"
                >{uranium && state.uraniumPhasedOut ? 'phased out' : `supply ${row.supply}`}</text
            >
            {#each row.cells as cell (cell.price)}
                <rect
                    x={cell.x + 2}
                    y={row.y + 6}
                    width={cell.width - 4}
                    height={ROW - 12}
                    rx="5"
                    fill="#cbc4ab"
                    stroke="#2f3825"
                    stroke-width="1.5"
                ></rect>
                {#if uranium}
                    <text class="mini-price" x={cell.x + 6} y={row.y + 15}>{cell.price}</text>
                {/if}
                {#each cell.slots as slot, index (index)}
                    {#if slot.filled}
                        <g opacity={slot.inCart ? 0.3 : 1}>
                            <ResourceToken
                                resource={row.resource}
                                x={slot.x}
                                y={row.y + ROW / 2 + (uranium ? 4 : 0)}
                                size={uranium ? 18 : 16}
                            />
                        </g>
                        {#if slot.inCart}
                            <circle
                                cx={slot.x}
                                cy={row.y + ROW / 2 + (uranium ? 4 : 0)}
                                r="13"
                                fill="none"
                                stroke="#1f2a22"
                                stroke-width="2.5"
                                stroke-dasharray="4 2"
                            ></circle>
                        {/if}
                    {:else}
                        <circle
                            cx={slot.x}
                            cy={row.y + ROW / 2 + (uranium ? 4 : 0)}
                            r="4"
                            fill="#a39c84"
                        ></circle>
                    {/if}
                {/each}
            {/each}
        </g>
    {/each}
</svg>

<style>
    .title {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 30px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        fill: #ecebe1;
    }
    .coin {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 14px;
        fill: #2b2210;
    }
    .label {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 20px;
        fill: #ecebe1;
    }
    .supply {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 600;
        font-size: 14px;
        fill: #c4caa9;
    }
    .mini-price {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        font-size: 12px;
        fill: #4a4535;
    }
    .addable {
        cursor: pointer;
    }
    .addable:hover .row-hit {
        fill: #71814f;
    }
</style>
