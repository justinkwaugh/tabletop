<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import type { HistoryOperatingOrder } from './historyOperatingOrder.js'
    import { operatingOrderMoves } from './operatingOrderMoves.js'
    let {
        order,
        stations,
        companyName
    }: {
        order: HistoryOperatingOrder
        stations: Readonly<Record<string, StationAppearance>>
        companyName: (id: string) => string
    } = $props()
    const moves = $derived(operatingOrderMoves(order))
    function appearance(id: string) {
        const token = stations[id]
        assertExists(token, `Operating order requires a token for ${id}`)
        return token
    }
</script>

<span class="order-history">
    {#if moves.length}
        {#each moves as move, moveIndex (moveIndex)}
            <svg
                width={move.companies.length * 28}
                height="37"
                viewBox={`0 0 ${move.companies.length * 28} 37`}
                role="img"
                aria-label={`${companyName(move.companies[move.from])} moved ${move.to > move.from ? 'later' : 'earlier'} past ${move.companies.slice(1, -1).map(companyName).join(', ')}`}
            >
                <path
                    d={`M ${move.from * 28 + 14} 10 V 8 Q ${move.from * 28 + 14} 4 ${move.from * 28 + 14 + (move.to > move.from ? 7 : -7)} 4 H ${move.to * 28 + 14 + (move.to > move.from ? -7 : 7)} Q ${move.to * 28 + 14} 4 ${move.to * 28 + 14} 8 V 10`}
                    fill="none"
                    stroke="#62584b"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                ></path>
                <path
                    d={`M ${move.to * 28 + 11.5} 10 L ${move.to * 28 + 14} 13 L ${move.to * 28 + 16.5} 10 Z`}
                    fill="#62584b"
                ></path>
                {#each move.companies as id, index (index)}
                    <g opacity={index === move.from ? 0.3 : 1}>
                        <CompanyToken
                            appearance={appearance(id)}
                            size={22}
                            x={index * 28 + 3}
                            y={13}
                        />
                    </g>
                {/each}
            </svg>
        {/each}
    {:else}
        <span class="order" aria-label={order.after.map(companyName).join(', ')}>
            {#each order.after as id, index (index)}<CompanyToken
                    appearance={appearance(id)}
                    size={22}
                />{/each}
        </span>
    {/if}
</span>

<style>
    .order-history {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.167em 0.583em;
        grid-column: 1 / -1;
    }
    .order {
        display: flex;
        gap: 0.333em;
        flex-wrap: wrap;
    }
    .order > :global(svg) {
        width: 1.833em;
        height: 1.833em;
    }
    svg {
        width: auto;
        max-width: 100%;
        height: 3.083em;
        flex-shrink: 0;
    }
</style>
