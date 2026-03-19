<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { ContainerColor, type HydratedContainerPlayerState } from '@tabletop/container'
    import ContainerCountMarker from '$lib/components/ContainerCountMarker.svelte'
    import CostSquare from '$lib/components/CostSquare.svelte'
    import Factory from '$lib/components/Factory.svelte'
    import PlayerBoardFactoryOffer2 from '$lib/components/PlayerBoardFactoryOffer2.svelte'
    import PlayerBoardFactoryOffer1 from '$lib/components/PlayerBoardFactoryOffer1.svelte'
    import PlayerBoardFactoryOffer3 from '$lib/components/PlayerBoardFactoryOffer3.svelte'
    import PlayerBoardFactoryOffer4 from '$lib/components/PlayerBoardFactoryOffer4.svelte'
    import Warehouse from '$lib/components/Warehouse.svelte'
    import blueSignImg from '$lib/images/blue-sign.svg'
    import brownSignImg from '$lib/images/brown-sign.svg'
    import orangeSignImg from '$lib/images/orange-sign.svg'
    import pinkSignImg from '$lib/images/pink-sign.svg'
    import purpleSignImg from '$lib/images/purple-sign.svg'
    import playerBoardLeftImg from '$lib/images/player-board-left@2x.webp'
    import playerBoardRightImg from '$lib/images/player-board-right@2x.webp'
    import type { PlayerBoardOrientation } from '$lib/definitions/boardLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const COLOR_STRIP_WIDTH = 153.35
    const COLOR_STRIP_HEIGHT = 754.02
    const LEFT_BOARD_SOURCE_WIDTH = 448
    const RIGHT_BOARD_SOURCE_WIDTH = 449
    const BOARD_SOURCE_HEIGHT = 755
    const COLOR_STRIP_ANCHOR_X = 152
    const FACTORY_OFFER_SOURCE_X = 24
    const FACTORY_OFFER_SOURCE_Y = 78.5
    const FACTORY_OFFER_SOURCE_WIDTH = 117.5
    const FACTORY_OFFER_PREVIEW_AREA_HEIGHT = 141
    const FACTORY_OFFER_PREVIEW_OFFSET_Y = 11
    const CONTAINER_ROW_REFERENCE_WIDTH = 195.05
    const CONTAINER_ROW_SOURCE_WIDTH = 252.52
    const CONTAINER_ROW_CONTAINER_HEIGHT = 60
    const CONTAINER_ROW_CONTAINER_STEP = 24
    const FACTORY_OFFER_PREVIEW_COUNT_FONT_SIZE = 18
    const FACTORY_OFFER_PREVIEW_COUNT_OFFSET_Y = 19
    const FACTORY_PREVIEW_TOP_SOURCE_Y = -37
    const FACTORY_PREVIEW_TOP_SOURCE_WIDTH = 59
    const FACTORY_PREVIEW_TOP_SOURCE_XS = [215, 150, 85, 20] as const
    const SECOND_FACTORY_OFFER_SOURCE_X = 22
    const SECOND_FACTORY_OFFER_SOURCE_Y = 241.5
    const SECOND_FACTORY_OFFER_SOURCE_WIDTH = 119.5
    const THIRD_FACTORY_OFFER_SOURCE_Y =
        SECOND_FACTORY_OFFER_SOURCE_Y +
        (SECOND_FACTORY_OFFER_SOURCE_Y - FACTORY_OFFER_SOURCE_Y) -
        0.5
    const FOURTH_FACTORY_OFFER_SOURCE_Y =
        THIRD_FACTORY_OFFER_SOURCE_Y +
        (THIRD_FACTORY_OFFER_SOURCE_Y - SECOND_FACTORY_OFFER_SOURCE_Y)
    const COST_SQUARE_SOURCE_X = 288.75
    const COST_SQUARE_SOURCE_Y = 116
    const COST_SQUARE_SOURCE_WIDTH = 42.18
    const COST_SQUARE_SOURCE_VERTICAL_STEP = 107.5
    const PLAYER_SIGN_SOURCE_X = 355
    const PLAYER_SIGN_SOURCE_Y = 12
    const PLAYER_SIGN_ASSET_WIDTH = 73.48
    const PLAYER_SIGN_ASSET_HEIGHT = 123.14
    const PLAYER_SIGN_SOURCE_HEIGHT = 124.7
    const PLAYER_SIGN_LOCAL_ROTATION = 90
    const WAREHOUSE_SOURCE_X = 390.5
    const WAREHOUSE_SOURCE_Y = 650.5
    const WAREHOUSE_SOURCE_WIDTH = 57
    const WAREHOUSE_EXTRA_HEIGHT = 1
    const WAREHOUSE_SOURCE_HORIZONTAL_STEP = -57
    const SIGN_IMAGE_BY_COLOR = {
        blue: blueSignImg,
        brown: brownSignImg,
        orange: orangeSignImg,
        pink: pinkSignImg,
        purple: purpleSignImg
    } as const
    const UI_FACTORY_COLOR_BY_CONTAINER_COLOR: Record<ContainerColor, string> = {
        [ContainerColor.Blue]: '#84accf',
        [ContainerColor.Red]: '#e14547',
        [ContainerColor.Green]: '#4f984d',
        [ContainerColor.Yellow]: '#f7dd4a',
        [ContainerColor.White]: '#ffffff'
    }

    let {
        player,
        playerState,
        orientation,
        x,
        y,
        width,
        height
    }: {
        player: Player
        playerState: HydratedContainerPlayerState
        orientation: PlayerBoardOrientation
        x: number
        y: number
        width: number
        height: number
    } = $props()

    const isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    const playerUiColor = $derived(gameSession.colors.getPlayerUiColor(player.id))
    const boardImageSrc = $derived(
        orientation === 'left' ? playerBoardLeftImg : playerBoardRightImg
    )
    const colorStripDisplayWidth = $derived.by(() => {
        const sourceWidth =
            orientation === 'left' ? LEFT_BOARD_SOURCE_WIDTH : RIGHT_BOARD_SOURCE_WIDTH
        return width * (COLOR_STRIP_WIDTH / sourceWidth)
    })
    const colorStripAnchorX = $derived.by(() => {
        const sourceWidth =
            orientation === 'left' ? LEFT_BOARD_SOURCE_WIDTH : RIGHT_BOARD_SOURCE_WIDTH
        return width * (COLOR_STRIP_ANCHOR_X / sourceWidth)
    })
    const colorStripTransform = $derived.by(() =>
        orientation === 'right'
            ? `translate(${width - colorStripAnchorX} 0) scale(-1 1)`
            : `translate(${colorStripAnchorX} 0)`
    )
    function orientX(leftX: number, itemWidth: number): number {
        return orientation === 'right' ? width - leftX - itemWidth : leftX
    }
    const factoryOfferX = $derived(width * (FACTORY_OFFER_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH))
    const factoryOfferY = $derived(height * (FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT))
    const factoryOfferWidth = $derived(
        width * (FACTORY_OFFER_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH)
    )
    const orientedFactoryOfferX = $derived(orientX(factoryOfferX, factoryOfferWidth))
    const factoryOfferPreviewContainerHeight = $derived(
        CONTAINER_ROW_REFERENCE_WIDTH *
            (CONTAINER_ROW_CONTAINER_HEIGHT / CONTAINER_ROW_SOURCE_WIDTH)
    )
    const factoryOfferPreviewContainerWidth = $derived(
        factoryOfferPreviewContainerHeight * (23.83 / 65.28)
    )
    const factoryOfferPreviewContainerStep = $derived(
        CONTAINER_ROW_REFERENCE_WIDTH * (CONTAINER_ROW_CONTAINER_STEP / CONTAINER_ROW_SOURCE_WIDTH)
    )
    const factoryPreviewWidth = $derived(
        width * (FACTORY_PREVIEW_TOP_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH)
    )
    const factoryPreviewTopY = $derived(
        height * (FACTORY_PREVIEW_TOP_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const factoryPreviewPositions = $derived(
        playerState.machines
            .slice(0, FACTORY_PREVIEW_TOP_SOURCE_XS.length)
            .map((machineColor, index) => ({
                color: UI_FACTORY_COLOR_BY_CONTAINER_COLOR[machineColor],
                x: orientX(
                    width * (FACTORY_PREVIEW_TOP_SOURCE_XS[index] / LEFT_BOARD_SOURCE_WIDTH),
                    factoryPreviewWidth
                ),
                y: factoryPreviewTopY
            }))
    )
    const secondFactoryOfferY = $derived(
        height * (SECOND_FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const secondFactoryOfferX = $derived(
        width * (SECOND_FACTORY_OFFER_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH)
    )
    const secondFactoryOfferWidth = $derived(
        width * (SECOND_FACTORY_OFFER_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH)
    )
    const orientedSecondFactoryOfferX = $derived(
        orientX(secondFactoryOfferX, secondFactoryOfferWidth)
    )
    const thirdFactoryOfferY = $derived(
        height * (THIRD_FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const fourthFactoryOfferY = $derived(
        height * (FOURTH_FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const factoryOfferPreviewRows = $derived.by(() => {
        const offerLayouts = [
            { price: 1, x: orientedFactoryOfferX, y: factoryOfferY, width: factoryOfferWidth },
            {
                price: 2,
                x: orientedSecondFactoryOfferX,
                y: secondFactoryOfferY,
                width: secondFactoryOfferWidth
            },
            { price: 3, x: orientedFactoryOfferX, y: thirdFactoryOfferY, width: factoryOfferWidth },
            {
                price: 4,
                x: orientedFactoryOfferX,
                y: fourthFactoryOfferY,
                width: factoryOfferWidth
            }
        ] as const

        return offerLayouts.flatMap((offer) => {
            const countsByColor = new Map<ContainerColor, number>()
            for (const entry of playerState.factoryStore) {
                if (entry.price !== offer.price) {
                    continue
                }
                countsByColor.set(entry.color, (countsByColor.get(entry.color) ?? 0) + 1)
            }

            const visibleEntries = playerState.machines
                .map((color) => ({
                    color: UI_FACTORY_COLOR_BY_CONTAINER_COLOR[color],
                    count: countsByColor.get(color) ?? 0
                }))
                .filter((entry) => entry.count > 0)
                .slice(0, 4)

            if (visibleEntries.length === 0) {
                return []
            }

            const rowWidth =
                factoryOfferPreviewContainerWidth +
                factoryOfferPreviewContainerStep * (visibleEntries.length - 1)
            const rowY =
                offer.y +
                (height * (FACTORY_OFFER_PREVIEW_AREA_HEIGHT / BOARD_SOURCE_HEIGHT) -
                    factoryOfferPreviewContainerHeight) /
                    2 +
                FACTORY_OFFER_PREVIEW_OFFSET_Y

            return visibleEntries.map((entry, index) => ({
                ...entry,
                price: offer.price,
                x:
                    offer.x +
                    (offer.width - rowWidth) / 2 +
                    factoryOfferPreviewContainerStep * index,
                y: rowY
            }))
        })
    })
    const costSquareWidth = $derived(width * (COST_SQUARE_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH))
    const costSquareX = $derived(width * (COST_SQUARE_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH))
    const orientedCostSquareX = $derived(orientX(costSquareX, costSquareWidth))
    const costSquarePositions = $derived(
        [0, 1, 2, 3, 4].map((index) => ({
            amount: (index + 2) as 2 | 3 | 4 | 5 | 6,
            y:
                height *
                ((COST_SQUARE_SOURCE_Y + COST_SQUARE_SOURCE_VERTICAL_STEP * index) /
                    BOARD_SOURCE_HEIGHT)
        }))
    )
    const ownedWarehouseCount = $derived(Math.max(0, Math.min(5, playerState.warehouses)))
    const warehouseWidth = $derived(width * (WAREHOUSE_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH))
    const warehouseHeight = $derived(warehouseWidth * (66.31 / 56.69) + WAREHOUSE_EXTRA_HEIGHT)
    const warehousePositions = $derived(
        Array.from({ length: ownedWarehouseCount }, (_value, index) => ({
            x: orientX(
                width *
                    ((WAREHOUSE_SOURCE_X + WAREHOUSE_SOURCE_HORIZONTAL_STEP * index) /
                        LEFT_BOARD_SOURCE_WIDTH),
                warehouseWidth
            ),
            y: height * (WAREHOUSE_SOURCE_Y / BOARD_SOURCE_HEIGHT)
        }))
    )
    const playerSignHref = $derived(
        SIGN_IMAGE_BY_COLOR[
            gameSession.colors
                .getPlayerColor(player.id)
                .toLowerCase() as keyof typeof SIGN_IMAGE_BY_COLOR
        ] ?? blueSignImg
    )
    const playerSignWidth = $derived(
        width *
            ((PLAYER_SIGN_SOURCE_HEIGHT * (PLAYER_SIGN_ASSET_WIDTH / PLAYER_SIGN_ASSET_HEIGHT)) /
                LEFT_BOARD_SOURCE_WIDTH)
    )
    const playerSignX = $derived(
        orientX(width * (PLAYER_SIGN_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH), playerSignWidth)
    )
    const playerSignTopY = $derived(height * (PLAYER_SIGN_SOURCE_Y / BOARD_SOURCE_HEIGHT))
    const playerSignHeight = $derived(height * (PLAYER_SIGN_SOURCE_HEIGHT / BOARD_SOURCE_HEIGHT))
    const playerSignY = $derived(playerSignTopY - (playerSignHeight - playerSignWidth) / 2)
    const playerSignCenterX = $derived(playerSignX + playerSignWidth / 2)
    const playerSignCenterY = $derived(playerSignY + playerSignHeight / 2)
    const playerSignTransform = $derived.by(() => {
        const rotation =
            orientation === 'right' ? -PLAYER_SIGN_LOCAL_ROTATION : PLAYER_SIGN_LOCAL_ROTATION
        return `translate(${playerSignCenterX} ${playerSignCenterY}) rotate(${rotation}) translate(${-playerSignWidth / 2} ${-playerSignHeight / 2})`
    })
</script>

<g
    class:player-board-turn={isTurn}
    class="player-board-root"
    transform={`translate(${x} ${y})`}
    aria-label={`${player.name} player board`}
>
    <image href={boardImageSrc} x="0" y="0" {width} {height} preserveAspectRatio="none"></image>
    <g transform={colorStripTransform}>
        <svg
            x="0"
            y=".5"
            width={colorStripDisplayWidth}
            height={height - 1}
            viewBox={`0 0 ${COLOR_STRIP_WIDTH} ${COLOR_STRIP_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill={playerUiColor}
                d="M10.97,754.02V90.07h142.37V0h-11.44v78.55H0l.43,675.47h10.54Z"
            ></path>
        </svg>
    </g>
    <g transform={playerSignTransform}>
        <image
            href={playerSignHref}
            x="0"
            y="0"
            width={playerSignWidth}
            height={playerSignHeight}
            preserveAspectRatio="xMidYMid meet"
        ></image>
    </g>
    {#each factoryPreviewPositions as factory, index (`factory-preview-${index}`)}
        <Factory x={factory.x} y={factory.y} width={factoryPreviewWidth} color={factory.color} />
    {/each}
    {#each factoryOfferPreviewRows as container, index (`factory-offer-container-${container.price}-${index}`)}
        <ContainerCountMarker
            x={container.x}
            y={container.y}
            height={factoryOfferPreviewContainerHeight}
            color={container.color}
            count={container.count}
            countFontSize={FACTORY_OFFER_PREVIEW_COUNT_FONT_SIZE}
            countOffsetY={FACTORY_OFFER_PREVIEW_COUNT_OFFSET_Y}
        />
    {/each}
    {#if orientation === 'right'}
        <g
            transform={`translate(${orientedFactoryOfferX + factoryOfferWidth} ${factoryOfferY}) scale(-1 1)`}
        >
            <PlayerBoardFactoryOffer4
                x={0}
                y={0}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={1}
                costSquareCounterMirror={true}
            />
        </g>
        <g
            transform={`translate(${orientedSecondFactoryOfferX + secondFactoryOfferWidth} ${secondFactoryOfferY}) scale(-1 1)`}
        >
            <PlayerBoardFactoryOffer3
                x={0}
                y={0}
                width={secondFactoryOfferWidth}
                color={playerUiColor}
                amount={2}
                costSquareCounterMirror={true}
            />
        </g>
        <g
            transform={`translate(${orientedFactoryOfferX + factoryOfferWidth} ${thirdFactoryOfferY}) scale(-1 1)`}
        >
            <PlayerBoardFactoryOffer2
                x={0}
                y={0}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={3}
                costSquareCounterMirror={true}
            />
        </g>
        <g
            transform={`translate(${orientedFactoryOfferX + factoryOfferWidth} ${fourthFactoryOfferY}) scale(-1 1)`}
        >
            <PlayerBoardFactoryOffer1
                x={0}
                y={0}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={4}
                costSquareCounterMirror={true}
            />
        </g>
    {:else}
        <PlayerBoardFactoryOffer4
            x={factoryOfferX}
            y={factoryOfferY}
            width={factoryOfferWidth}
            color={playerUiColor}
            amount={1}
        />
        <PlayerBoardFactoryOffer3
            x={secondFactoryOfferX}
            y={secondFactoryOfferY}
            width={secondFactoryOfferWidth}
            color={playerUiColor}
            amount={2}
        />
        <PlayerBoardFactoryOffer2
            x={factoryOfferX}
            y={thirdFactoryOfferY}
            width={factoryOfferWidth}
            color={playerUiColor}
            amount={3}
        />
        <PlayerBoardFactoryOffer1
            x={factoryOfferX}
            y={fourthFactoryOfferY}
            width={factoryOfferWidth}
            color={playerUiColor}
            amount={4}
        />
    {/if}
    {#each costSquarePositions as costSquare (costSquare.amount)}
        <CostSquare
            x={orientedCostSquareX}
            y={costSquare.y}
            width={costSquareWidth}
            amount={costSquare.amount}
            color={playerUiColor}
        />
    {/each}
    {#each warehousePositions as warehouse, index (`warehouse-${index}`)}
        <Warehouse
            x={warehouse.x}
            y={warehouse.y}
            width={warehouseWidth}
            heightOverride={warehouseHeight}
        />
    {/each}
</g>

<style>
    :global(:root) {
        --player-board-cardboard-shadow: drop-shadow(0 2px 0 rgba(58, 55, 43, 0.28))
            drop-shadow(0 5px 7px rgba(18, 24, 52, 0.12));
    }

    @keyframes player-board-pulse {
        0% {
            filter: var(--player-board-cardboard-shadow);
        }
        25% {
            filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0.92))
                var(--player-board-cardboard-shadow);
        }
        75% {
            filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0.92))
                var(--player-board-cardboard-shadow);
        }
        100% {
            filter: var(--player-board-cardboard-shadow);
        }
    }

    .player-board-root {
        filter: var(--player-board-cardboard-shadow);
    }

    .player-board-turn {
        animation: player-board-pulse 2.5s infinite;
    }
</style>
