<script lang="ts">
    import { type Player } from '@tabletop/common'
    import type { HydratedContainerPlayerState } from '@tabletop/container'
    import CostSquare from '$lib/components/CostSquare.svelte'
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
    const factoryOfferX = $derived(width * (FACTORY_OFFER_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH))
    const factoryOfferY = $derived(height * (FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT))
    const factoryOfferWidth = $derived(
        width * (FACTORY_OFFER_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH)
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
    const thirdFactoryOfferY = $derived(
        height * (THIRD_FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const fourthFactoryOfferY = $derived(
        height * (FOURTH_FACTORY_OFFER_SOURCE_Y / BOARD_SOURCE_HEIGHT)
    )
    const costSquareX = $derived(width * (COST_SQUARE_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH))
    const costSquareWidth = $derived(width * (COST_SQUARE_SOURCE_WIDTH / LEFT_BOARD_SOURCE_WIDTH))
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
            x:
                width *
                ((WAREHOUSE_SOURCE_X + WAREHOUSE_SOURCE_HORIZONTAL_STEP * index) /
                    LEFT_BOARD_SOURCE_WIDTH),
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
    const playerSignX = $derived(width * (PLAYER_SIGN_SOURCE_X / LEFT_BOARD_SOURCE_WIDTH))
    const playerSignTopY = $derived(height * (PLAYER_SIGN_SOURCE_Y / BOARD_SOURCE_HEIGHT))
    const playerSignHeight = $derived(height * (PLAYER_SIGN_SOURCE_HEIGHT / BOARD_SOURCE_HEIGHT))
    const playerSignY = $derived(playerSignTopY - (playerSignHeight - playerSignWidth) / 2)
    const playerSignCenterX = $derived(playerSignX + playerSignWidth / 2)
    const playerSignCenterY = $derived(playerSignY + playerSignHeight / 2)
    const playerSignTransform = $derived.by(() => {
        const counterMirror = orientation === 'right' ? ' scale(-1 1)' : ''
        return `translate(${playerSignCenterX} ${playerSignCenterY}) rotate(${PLAYER_SIGN_LOCAL_ROTATION})${counterMirror} translate(${-playerSignWidth / 2} ${-playerSignHeight / 2})`
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
    {#if orientation === 'right'}
        <g transform={`translate(${width} 0) scale(-1 1)`}>
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
            <PlayerBoardFactoryOffer4
                x={factoryOfferX}
                y={factoryOfferY}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={1}
                costSquareCounterMirror={true}
            />
            <PlayerBoardFactoryOffer3
                x={secondFactoryOfferX}
                y={secondFactoryOfferY}
                width={secondFactoryOfferWidth}
                color={playerUiColor}
                amount={2}
                costSquareCounterMirror={true}
            />
            <PlayerBoardFactoryOffer2
                x={factoryOfferX}
                y={thirdFactoryOfferY}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={3}
                costSquareCounterMirror={true}
            />
            <PlayerBoardFactoryOffer1
                x={factoryOfferX}
                y={fourthFactoryOfferY}
                width={factoryOfferWidth}
                color={playerUiColor}
                amount={4}
                costSquareCounterMirror={true}
            />
            {#each costSquarePositions as costSquare (costSquare.amount)}
                <CostSquare
                    x={costSquareX}
                    y={costSquare.y}
                    width={costSquareWidth}
                    amount={costSquare.amount}
                    color={playerUiColor}
                    counterMirrorX={true}
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
    {:else}
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
        {#each costSquarePositions as costSquare (costSquare.amount)}
            <CostSquare
                x={costSquareX}
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
    {/if}
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
