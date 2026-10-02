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
                founding: index === 0
            }))
        )
    )
    const oracles = $derived(oracleViews(board, network))
    const markets = $derived(marketViews(board, network))
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
    {#each cityTiles as { key, center, playerId, founding } (key)}
        <g transform="translate({center.x} {center.y})">
            <CityTileArt color={playerColor(playerId)} {founding} />
        </g>
    {/each}
</g>

<g class="oracles">
    {#each oracles as oracle (oracle.key)}
        <g transform="translate({oracle.center.x} {oracle.center.y})">
            <OracleArt
                angle={oracle.attention?.angle}
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
            <MarketPiece
                color={playerColor(market.playerId)}
                sold={market.sold}
                active={market.active}
            />
        </g>
    {/each}
</g>

<g class="connection-badges" pointer-events="none">
    {#each badges as badge (badge.key)}
        <g transform="translate({badge.point.x} {badge.point.y})">
            <circle r="14.25" fill="#fbf3dc" stroke="#6b3f1d" stroke-width="2.1"></circle>
            <text
                y="6"
                text-anchor="middle"
                font-family="'Libre Baskerville', Georgia, serif"
                font-size="18"
                font-weight="700"
                fill="#6b3f1d">{badge.count}</text
            >
        </g>
    {/each}
</g>
