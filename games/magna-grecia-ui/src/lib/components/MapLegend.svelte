<script lang="ts">
    import { PointyHexDirection } from '@tabletop/common'
    import type { RoadEnds } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import CityTileArt from './board/CityTileArt.svelte'
    import MarketPiece from './board/MarketPiece.svelte'
    import RoadTileArt from './board/RoadTileArt.svelte'
    import Village from './board/Village.svelte'

    const NEUTRAL_COLOR = '#c0673f'
    const HEX_VIEW = '-48 -53 96 106'
    const MARKET_VIEW = '-20 -21 42 42'
    const LEGEND_ROAD: RoadEnds = [PointyHexDirection.West, PointyHexDirection.East]
    const hexShape = localHexPoints()

    const gameSession = getGameSession()
    const color = $derived(
        gameSession.myPlayerId
            ? gameSession.colors.getPlayerUiColor(gameSession.myPlayerId)
            : NEUTRAL_COLOR
    )
    const markets = [
        { key: 'active', label: 'Active', active: true, sold: false },
        { key: 'inactive', label: 'Inactive', active: false, sold: false },
        { key: 'sold', label: 'Sold', active: false, sold: true }
    ]
</script>

{#snippet land()}
    <polygon points={hexShape} fill="#d3b360"></polygon>
    <polygon points={hexShape} fill="url(#mg-land-shade)"></polygon>
    <polygon points={hexShape} fill="none" stroke="rgba(120, 90, 40, 0.45)" stroke-width="1.5"
    ></polygon>
{/snippet}

<section class="legend" aria-label="Legend">
    <div class="legend-title">Legend</div>
    <ul class="entries">
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                {@render land()}
                <Village frontier />
            </svg>
            <span>Starting Village</span>
        </li>
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                {@render land()}
                <Village frontier={false} />
            </svg>
            <span>Village</span>
        </li>
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                {@render land()}
            </svg>
            <span>Undeveloped</span>
        </li>
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                <RoadTileArt ends={LEGEND_ROAD} {color} />
            </svg>
            <span>Road</span>
        </li>
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                <CityTileArt {color} />
            </svg>
            <span>City</span>
        </li>
    </ul>
    <div class="markets">
        <div class="markets-label">Markets</div>
        <div class="market-row">
            {#each markets as market (market.key)}
                <span class="market">
                    <svg viewBox={MARKET_VIEW} aria-hidden="true">
                        <MarketPiece {color} active={market.active} sold={market.sold} />
                    </svg>
                    <span>{market.label}</span>
                </span>
            {/each}
        </div>
    </div>
</section>

<style>
    .legend {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-radius: 10px;
        padding: 10px 12px 12px;
        background: rgba(243, 223, 180, 0.55);
        box-shadow: inset 0 0 0 1px rgba(107, 74, 42, 0.3);
    }

    .legend-title {
        font-size: 30px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }

    .entries {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .entries li,
    .market {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 17px;
        color: #3b2a18;
    }

    .entries svg {
        flex-shrink: 0;
        width: 48px;
        height: 54px;
    }

    .markets {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        border-top: 1px solid rgba(107, 74, 42, 0.25);
        padding-top: 8px;
    }

    .markets-label {
        font-size: 17px;
        font-weight: 700;
        text-align: center;
        color: #3b2a18;
    }

    .market-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px 14px;
    }

    .market svg {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
    }
</style>
