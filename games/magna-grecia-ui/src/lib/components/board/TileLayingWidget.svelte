<script lang="ts">
    import type { AxialCoordinates } from '@tabletop/common'
    import { RoadShape } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BOARD_HEIGHT, BOARD_WIDTH, HEX, hexCenter } from '$lib/utils/boardGeometry.js'
    import { tileChoiceArc } from '$lib/utils/tileChoiceArc.js'
    import RoadTileArt from './RoadTileArt.svelte'

    let { coords }: { coords: AxialCoordinates } = $props()

    const CHOICE_SCALE = 0.72
    const BACKDROP_RADIUS = HEX.yRadius + 8
    const CHOICE_SIZE = BACKDROP_RADIUS * 2 * CHOICE_SCALE
    const SHAPE_LABELS: Record<RoadShape, string> = {
        [RoadShape.Straight]: 'straight',
        [RoadShape.Curve]: 'curved'
    }

    const gameSession = getGameSession()
    const center = $derived(hexCenter(coords))
    const color = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayerId))
    const choices = $derived(gameSession.roadShapeChoices)
    const preview = $derived(gameSession.roadPreview)
    const rotations = $derived(gameSession.roadPlacements.length)
    const arc = $derived(
        tileChoiceArc({
            center,
            count: choices.length,
            radius: HEX.yRadius * 2.05,
            choiceSize: CHOICE_SIZE,
            bounds: { width: BOARD_WIDTH, height: BOARD_HEIGHT }
        })
    )
    const CONTROLS_OFFSET = HEX.yRadius + 20
    const controlsY = $derived(
        center.y - CONTROLS_OFFSET < 20 ? center.y + CONTROLS_OFFSET : center.y - CONTROLS_OFFSET
    )

    function activate(event: KeyboardEvent, handler: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }
</script>

<g class="tile-laying" aria-label="Road tile picker">
    {#each choices as choice, index (choice.shape)}
        {@const point = arc[index]}
        {@const chosen = choice.shape === gameSession.roadShape}
        {#if point && !chosen}
            <g
                role="button"
                tabindex="0"
                aria-label={`Choose the ${SHAPE_LABELS[choice.shape]} road tile`}
                class="tile-choice cursor-pointer"
                transform="translate({point.x} {point.y})"
                onclick={() => gameSession.chooseRoadShape(choice.shape)}
                onkeydown={(event) =>
                    activate(event, () => gameSession.chooseRoadShape(choice.shape))}
            >
                <g transform="scale({CHOICE_SCALE})">
                    <g class="tile-choice-art">
                        <circle r={BACKDROP_RADIUS} class="choice-backdrop"></circle>
                        <RoadTileArt ends={choice.placements[0]} {color} />
                    </g>
                </g>
            </g>
        {/if}
    {/each}

    {#if preview}
        <g
            role="button"
            tabindex="0"
            aria-label={rotations > 1 ? 'Rotate the road tile' : 'Road tile preview'}
            class="tile-preview"
            class:cursor-pointer={rotations > 1}
            transform="translate({center.x} {center.y})"
            onclick={() => gameSession.rotateRoad()}
            onkeydown={(event) => activate(event, () => gameSession.rotateRoad())}
        >
            <RoadTileArt ends={preview} {color} />
            {#if rotations > 1}
                <g transform="translate({HEX.xRadius - 12} {HEX.yRadius / 2 - 4})">
                    <circle r="11" class="rotate-badge"></circle>
                    <path d="M 5 -1.5 A 5.5 5.5 0 1 0 3.2 4.3" class="rotate-arrow"></path>
                    <path d="M 5.8 -6 L 5.2 -1 L 0.6 -2.6" class="rotate-arrow"></path>
                </g>
            {/if}
        </g>

        <g class="controls" transform="translate({center.x} {controlsY})">
            <g
                role="button"
                tabindex="0"
                aria-label="Cancel road placement"
                class="control cancel cursor-pointer"
                transform="translate(-19 0)"
                onclick={() => gameSession.cancelRoad()}
                onkeydown={(event) => activate(event, () => gameSession.cancelRoad())}
            >
                <circle r="16"></circle>
                <path d="M -6 -6 L 6 6 M 6 -6 L -6 6"></path>
            </g>
            <g
                role="button"
                tabindex="0"
                aria-label="Place this road tile"
                class="control accept cursor-pointer"
                transform="translate(19 0)"
                onclick={() => gameSession.confirmRoad()}
                onkeydown={(event) => activate(event, () => gameSession.confirmRoad())}
            >
                <circle r="16"></circle>
                <path d="M -7 0 L -2 5 L 7 -5"></path>
            </g>
        </g>
    {/if}
</g>

<style>
    .tile-choice {
        filter: drop-shadow(0 3px 4px rgba(20, 12, 4, 0.55));
    }

    .tile-choice-art {
        transform-box: fill-box;
        transform-origin: center;
        animation: choice-enter 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tile-choice:hover .tile-choice-art,
    .tile-choice:focus-visible .tile-choice-art {
        scale: 1.1;
    }

    .choice-backdrop {
        fill: rgba(251, 243, 220, 0.92);
        stroke: #6b3f1d;
        stroke-width: 3;
    }

    .tile-preview {
        filter: drop-shadow(0 3px 5px rgba(20, 12, 4, 0.5));
    }

    .rotate-badge {
        fill: #fbf3dc;
        stroke: #6b3f1d;
        stroke-width: 1.6;
    }

    .rotate-arrow {
        fill: none;
        stroke: #6b3f1d;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .control circle {
        stroke: rgba(255, 255, 255, 0.75);
        stroke-width: 1.5;
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
    }

    .control path {
        fill: none;
        stroke: #ffffff;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .cancel circle {
        fill: #b34242;
    }

    .accept circle {
        fill: #347752;
    }

    .control:hover circle,
    .control:focus-visible circle {
        filter: brightness(1.15) drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
    }

    [role='button']:focus-visible {
        outline: 3px solid #d52f83;
        outline-offset: 3px;
    }

    @keyframes choice-enter {
        from {
            opacity: 0;
            transform: scale(0.35);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .tile-choice-art {
            animation: none;
        }
    }
</style>
