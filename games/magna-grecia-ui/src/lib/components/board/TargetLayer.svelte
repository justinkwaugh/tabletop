<script lang="ts">
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { spaceKey } from '@tabletop/magna-grecia'
    import { BuildTool } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter, localHexPoints } from '$lib/utils/boardGeometry.js'
    import { placeCenter } from '$lib/utils/boardView.js'
    import CityTileArt from './CityTileArt.svelte'
    import TileLayingWidget from './TileLayingWidget.svelte'

    const gameSession = getGameSession()
    const targetShape = localHexPoints(3)
    const CITY_GLYPH_HOUSES = [
        { x: -22, y: -3 },
        { x: 22, y: -3 },
        { x: -14, y: 17 },
        { x: 14, y: 17 },
        { x: 0, y: 25 }
    ]

    let hoveredCity: AxialCoordinates | undefined = $state()

    const myColor = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayerId))
    const roadTargets = $derived([...gameSession.roadTargets.values()])
    const priceTargets = $derived.by(() => {
        if (gameSession.activeTool === BuildTool.Market) {
            return gameSession.marketTargets.map((target) => ({
                key: target.place.id,
                center: placeCenter(target.place),
                label: 'Build a market here',
                price: `−${target.amount}`,
                choose: () => gameSession.buildMarket(target.place.id)
            }))
        }
        if (gameSession.activeTool === BuildTool.Sell) {
            return gameSession.sellTargets.map((target) => ({
                key: spaceKey(target.coords),
                center: hexCenter(target.coords),
                label: 'Sell this market',
                price: `+${target.amount}`,
                choose: () => gameSession.sellMarket(target.coords)
            }))
        }
        return []
    })

    function activate(event: KeyboardEvent, handler: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }
</script>

{#each roadTargets as target (spaceKey(target.coords))}
    {@const center = hexCenter(target.coords)}
    {@const selected =
        !!gameSession.roadSpace && sameCoordinates(gameSession.roadSpace, target.coords)}
    <g
        role="button"
        tabindex="0"
        aria-label="Build a road here"
        class="target cursor-pointer"
        class:selected
        transform="translate({center.x} {center.y})"
        onclick={() => gameSession.chooseRoadSpace(target.coords)}
        onkeydown={(event) => activate(event, () => gameSession.chooseRoadSpace(target.coords))}
    >
        <polygon points={targetShape} class="target-hex"></polygon>
        <path d="M -19 3 Q 0 -15 19 3" class="target-glyph"></path>
    </g>
{/each}

{#each gameSession.cityTargets as { coords, startsClaim, startsFounding } (spaceKey(coords))}
    {@const center = hexCenter(coords)}
    {@const claim = gameSession.cityUnfinished}
    <g
        role="button"
        tabindex="0"
        aria-label={startsClaim
            ? 'Place a city tile here, then on the neighbouring village'
            : startsFounding
              ? 'Found a city here, then build it on to a village this turn'
              : 'Place a city tile here'}
        class="target cursor-pointer"
        class:claim
        class:two-step={startsClaim || startsFounding}
        transform="translate({center.x} {center.y})"
        onmouseenter={() => (hoveredCity = coords)}
        onmouseleave={() => (hoveredCity = undefined)}
        onclick={() => gameSession.placeCity(coords)}
        onkeydown={(event) => activate(event, () => gameSession.placeCity(coords))}
    >
        {#if hoveredCity && sameCoordinates(hoveredCity, coords)}
            <CityTileArt color={myColor} ghost />
        {/if}
        <polygon points={targetShape} class="target-hex"></polygon>
        {#if !hoveredCity || !sameCoordinates(hoveredCity, coords)}
            <g class="target-glyph target-city">
                {#each CITY_GLYPH_HOUSES as house, index (index)}
                    <rect x={house.x - 6} y={house.y - 5} width="12" height="10" rx="1"></rect>
                {/each}
                <path d="M -13 3 H 13 M -11 3 V -8 H 11 V 3 M -14 -8 L 0 -17 L 14 -8 Z"></path>
                <path d="M -6 -6 V 1 M 0 -6 V 1 M 6 -6 V 1"></path>
            </g>
        {/if}
    </g>
{/each}

{#each priceTargets as target (target.key)}
    <g
        role="button"
        tabindex="0"
        aria-label={target.label}
        class="target cursor-pointer"
        transform="translate({target.center.x} {target.center.y})"
        onclick={target.choose}
        onkeydown={(event) => activate(event, target.choose)}
    >
        <polygon points={targetShape} class="target-hex"></polygon>
        <g transform="translate(0 -30)">
            <rect x="-17" y="-11" width="34" height="20" rx="10" class="price-tag"></rect>
            <text y="4" text-anchor="middle" class="price-text">{target.price}</text>
        </g>
    </g>
{/each}

{#if gameSession.roadSpace}
    <TileLayingWidget coords={gameSession.roadSpace} />
{/if}

<style>
    .target-hex {
        fill: rgba(255, 246, 214, 0.58);
        stroke: #fff4c9;
        stroke-width: 3;
        stroke-dasharray: 7 5;
        animation: target-pulse 1.6s ease-in-out infinite;
    }
    .target:hover .target-hex,
    .target:focus-visible .target-hex,
    .target.selected .target-hex {
        fill: rgba(255, 250, 232, 0.8);
        stroke-dasharray: none;
    }
    .target.two-step .target-hex {
        fill: rgba(255, 246, 214, 0.38);
        stroke-dasharray: 3 6;
    }
    .target.claim .target-hex {
        stroke: #ffffff;
        stroke-width: 4;
        fill: rgba(255, 250, 232, 0.75);
    }
    .target:focus {
        outline: none;
    }
    .target-glyph {
        fill: none;
        stroke: rgba(107, 63, 29, 0.7);
        stroke-width: 7;
        stroke-linecap: round;
    }
    .target-city {
        pointer-events: none;
        stroke-width: 3;
        stroke-linejoin: round;
    }
    .price-tag {
        fill: #fbf3dc;
        stroke: #6b3f1d;
        stroke-width: 1.5;
    }
    .price-text {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #6b3f1d;
    }
    @keyframes target-pulse {
        0%,
        100% {
            stroke-opacity: 1;
        }
        50% {
            stroke-opacity: 0.45;
        }
    }
</style>
