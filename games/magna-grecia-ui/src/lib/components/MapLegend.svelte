<script lang="ts">
    import { PointyHexDirection } from '@tabletop/common'
    import type { RoadEnds } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import CityTileArt from './board/CityTileArt.svelte'
    import MarketPiece from './board/MarketPiece.svelte'
    import OracleArt from './board/OracleArt.svelte'
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
                <CityTileArt {color} founding />
            </svg>
            <span>City</span>
        </li>
        <li>
            <svg viewBox={HEX_VIEW} aria-hidden="true">
                <OracleArt />
            </svg>
            <span>Oracle</span>
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
        gap: 6px;
        border-radius: 10px;
        padding: 8px 12px 10px;
        background: rgba(243, 230, 196, 0.94);
        box-shadow:
            inset 0 0 0 1px rgba(107, 74, 42, 0.35),
            0 6px 14px rgba(20, 50, 70, 0.35);
    }

    .legend-title {
        font-size: 20px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
    }

    .entries {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .entries li,
    .market {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: #3b2a18;
    }

    .entries svg {
        flex-shrink: 0;
        width: 34px;
        height: 38px;
    }

    .markets {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        border-top: 1px solid rgba(107, 74, 42, 0.25);
        padding-top: 6px;
    }

    .markets-label {
        font-size: 15px;
        font-weight: 700;
        color: #3b2a18;
    }

    .market-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .market svg {
        flex-shrink: 0;
        width: 34px;
        height: 30px;
    }
</style>
