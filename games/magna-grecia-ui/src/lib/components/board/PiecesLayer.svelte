<script lang="ts">
    import { spaceKey } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { connectionBadges, marketViews, oracleViews } from '$lib/utils/boardView.js'
    import CityTileArt from './CityTileArt.svelte'
    import MarketPiece from './MarketPiece.svelte'
    import OracleArt from './OracleArt.svelte'
    import RoadTileArt from './RoadTileArt.svelte'

    const gameSession = getGameSession()

    const board = $derived(gameSession.gameState.board)
    const network = $derived(board.network())
    const roads = $derived(
        board.roads.map((road) => ({
            key: spaceKey(road.coords),
            center: hexCenter(road.coords),
            road
        }))
    )
    const cityTiles = $derived(
        board.cities.flatMap((city) =>
            city.spaces.map((coords, index) => ({
                key: spaceKey(coords),
                center: hexCenter(coords),
                playerId: city.playerId,
                variant: index
            }))
        )
    )
    const oracles = $derived(oracleViews(board, network))
    const markets = $derived(marketViews(board))
    const badges = $derived(connectionBadges(board, network))

    function playerColor(playerId: string): string {
        return gameSession.colors.getPlayerUiColor(playerId)
    }
</script>

<g class="roads" filter="url(#mg-tile-shadow)">
    {#each roads as { key, center, road } (key)}
        <g transform="translate({center.x} {center.y})">
            <RoadTileArt ends={road.ends} color={playerColor(road.playerId)} />
        </g>
    {/each}
</g>

<g class="cities" filter="url(#mg-tile-shadow)">
    {#each cityTiles as { key, center, playerId, variant } (key)}
        <g transform="translate({center.x} {center.y})">
            <CityTileArt color={playerColor(playerId)} {variant} />
        </g>
    {/each}
</g>

<g class="oracles">
    {#each oracles as oracle (oracle.key)}
        <g transform="translate({oracle.center.x} {oracle.center.y})">
            {#if oracle.attention}
                <g transform="rotate({oracle.attention.angle})">
                    <path
                        d="M 10 -9 L 44 -4 L 44 4 L 10 9 Z"
                        fill="url(#mg-oracle-gaze)"
                        opacity="0.9"
                    ></path>
                    <circle
                        cx="41"
                        cy="0"
                        r="5"
                        fill={playerColor(oracle.attention.playerId)}
                        stroke="#fff6d8"
                        stroke-width="1.5"
                    ></circle>
                </g>
            {/if}
            <OracleArt
                attentionColor={oracle.attention
                    ? playerColor(oracle.attention.playerId)
                    : undefined}
            />
        </g>
    {/each}
</g>

<g class="markets">
    {#each markets as market (market.key)}
        <g transform="translate({market.point.x} {market.point.y})">
            <MarketPiece color={playerColor(market.playerId)} sold={market.sold} />
        </g>
    {/each}
</g>

<g class="connection-badges" pointer-events="none">
    {#each badges as badge (badge.key)}
        <g transform="translate({badge.point.x} {badge.point.y})">
            <circle r="9.5" fill="#fbf3dc" stroke="#6b3f1d" stroke-width="1.4"></circle>
            <text
                y="4"
                text-anchor="middle"
                font-family="Georgia, 'Times New Roman', serif"
                font-size="12"
                font-weight="700"
                fill="#6b3f1d">{badge.count}</text
            >
        </g>
    {/each}
</g>
