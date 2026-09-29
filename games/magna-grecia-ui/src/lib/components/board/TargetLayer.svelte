<script lang="ts">
    import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
    import { spaceKey } from '@tabletop/magna-grecia'
    import { BuildTool, type MarketTarget } from '$lib/model/session.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter, localHexPoints } from '$lib/utils/boardGeometry.js'
    import { placeCenter } from '$lib/utils/boardView.js'
    import CityTileArt from './CityTileArt.svelte'
    import RoadPicker from './RoadPicker.svelte'

    const gameSession = getGameSession()
    const targetShape = localHexPoints(3)

    let hoveredCity: AxialCoordinates | undefined = $state()

    const myColor = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayerId))
    const roadTargets = $derived([...gameSession.roadTargets.values()])
    const placeTargets = $derived.by(() => {
        const tool = gameSession.activeTool
        const targets: MarketTarget[] =
            tool === BuildTool.Market
                ? gameSession.marketTargets
                : tool === BuildTool.Sell
                  ? gameSession.sellTargets
                  : []
        return targets.map((target) => ({ ...target, center: placeCenter(target.place) }))
    })

    function activate(event: KeyboardEvent, handler: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }

    function choosePlace(target: MarketTarget) {
        if (gameSession.activeTool === BuildTool.Sell) {
            gameSession.sellMarket(target.place.id)
        } else {
            gameSession.buildMarket(target.place.id)
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
        <path d="M -12 0 Q 0 -10 12 0" class="target-glyph"></path>
    </g>
{/each}

{#each gameSession.cityTargets as { coords, startsClaim } (spaceKey(coords))}
    {@const center = hexCenter(coords)}
    {@const claim = !!gameSession.pendingClaim}
    <g
        role="button"
        tabindex="0"
        aria-label={startsClaim
            ? 'Place a city tile here, then on the neighbouring village'
            : 'Place a city tile here'}
        class="target cursor-pointer"
        class:claim
        class:two-step={startsClaim}
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
    </g>
{/each}

{#each placeTargets as target (target.place.id)}
    <g
        role="button"
        tabindex="0"
        aria-label={gameSession.activeTool === BuildTool.Sell
            ? 'Sell this market'
            : 'Build a market here'}
        class="target cursor-pointer"
        transform="translate({target.center.x} {target.center.y})"
        onclick={() => choosePlace(target)}
        onkeydown={(event) => activate(event, () => choosePlace(target))}
    >
        <polygon points={targetShape} class="target-hex"></polygon>
        <g transform="translate(0 -30)">
            <rect x="-17" y="-11" width="34" height="20" rx="10" class="price-tag"></rect>
            <text y="4" text-anchor="middle" class="price-text"
                >{gameSession.activeTool === BuildTool.Sell ? '+' : '−'}{target.amount}</text
            >
        </g>
    </g>
{/each}

{#if gameSession.roadSpace && gameSession.roadOptions.length > 1}
    <RoadPicker coords={gameSession.roadSpace} options={gameSession.roadOptions} />
{/if}

<style>
    .target-hex {
        fill: rgba(255, 238, 170, 0.22);
        stroke: #fff4c9;
        stroke-width: 3;
        stroke-dasharray: 7 5;
        animation: target-pulse 1.6s ease-in-out infinite;
    }
    .target:hover .target-hex,
    .target:focus-visible .target-hex,
    .target.selected .target-hex {
        fill: rgba(255, 238, 170, 0.45);
        stroke-dasharray: none;
    }
    .target.two-step .target-hex {
        fill: rgba(255, 238, 170, 0.1);
        stroke-dasharray: 3 6;
    }
    .target.claim .target-hex {
        stroke: #ffffff;
        stroke-width: 4;
        fill: rgba(255, 245, 200, 0.5);
    }
    .target:focus {
        outline: none;
    }
    .target-glyph {
        fill: none;
        stroke: rgba(107, 63, 29, 0.55);
        stroke-width: 4;
        stroke-linecap: round;
    }
    .price-tag {
        fill: #fbf3dc;
        stroke: #6b3f1d;
        stroke-width: 1.5;
    }
    .price-text {
        font-family: Georgia, 'Times New Roman', serif;
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
