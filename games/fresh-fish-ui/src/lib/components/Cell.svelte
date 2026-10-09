<script lang="ts">
    import {
        ActionType,
        Cell,
        CellType,
        HydratedPlaceStall,
        HydratedPlaceDisk,
        HydratedPlaceMarket,
        isDiskCell
    } from '@tabletop/fresh-fish'
    import { GRASS_DARK, GRASS_LIGHT } from '$lib/utils/pieceColors.js'
    import roadImg from '$lib/images/tile-road.png'
    import Disk from '$lib/components/Disk.svelte'
    import WoodMarket from '$lib/components/WoodMarket.svelte'
    import WoodStall from '$lib/components/WoodStall.svelte'
    import WoodTruck from '$lib/components/WoodTruck.svelte'
    import { fadeScale, GameSessionMode } from '@tabletop/frontend-components'
    import type { GameAction, OffsetTupleCoordinates } from '@tabletop/common'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()

    let { cell, coords }: { cell: Cell; coords: OffsetTupleCoordinates } = $props()

    const CORNER_RADIUS = 12
    let cornerClip = $derived.by(() => {
        if (cell.type === CellType.OffBoard) return undefined
        const cells = gameSession.gameState.board.cells
        const [x, y] = coords
        const isOffBoard = (cx: number, cy: number) => {
            const neighbour = cells[cy]?.[cx]
            return !neighbour || neighbour.type === CellType.OffBoard
        }
        const radiusToward = (dx: number, dy: number) =>
            isOffBoard(x + dx, y) && isOffBoard(x, y + dy) ? CORNER_RADIUS : 0
        const [tl, tr, br, bl] = [
            radiusToward(-1, -1),
            radiusToward(1, -1),
            radiusToward(1, 1),
            radiusToward(-1, 1)
        ]
        if (!tl && !tr && !br && !bl) return undefined
        // A negative inset keeps the half-pixel bleed that hides seams between squares.
        return `inset(-1px round ${tl}px ${tr}px ${br}px ${bl}px)`
    })

    // A mown-lawn checker of two close greens marks out the lots without drawing lines,
    // under a fine grain so the grass reads as matte rather than flat colour.
    const GRASS_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`
    let grass = $derived.by(() => {
        const [x, y] = coords
        const green = (x + y) % 2 ? GRASS_DARK : GRASS_LIGHT
        return `${GRASS_GRAIN}, linear-gradient(${green}, ${green})`
    })

    let backgroundImage = $derived.by(() => {
        switch (cell.type) {
            case CellType.Disk:
            case CellType.Empty:
                return grass
            // Under a piece the lot still shows grass, so nothing dark shows through while a
            // placed piece replaces the disc that reserved its lot.
            case CellType.Stall:
            case CellType.Truck:
            case CellType.Market:
                return grass
            case CellType.Road:
                return `url(${roadImg})`
            case CellType.OffBoard:
            default:
                return 'none'
        }
    })

    let interacting = $derived(
        gameSession.isMyTurn &&
            gameSession.isPlayable &&
            !gameSession.isViewingHistory &&
            (gameSession.chosenAction === ActionType.PlaceDisk ||
                gameSession.chosenAction === ActionType.PlaceStall ||
                gameSession.chosenAction === ActionType.PlaceMarket)
    )
    let interactable = $derived(
        interacting &&
            ((gameSession.chosenAction === ActionType.PlaceDisk &&
                HydratedPlaceDisk.isValidCellForPlacement(
                    gameSession.gameState,
                    coords,
                    gameSession.myPlayer?.id ?? ''
                )) ||
                (gameSession.chosenAction === ActionType.PlaceStall &&
                    HydratedPlaceStall.isValidCellForPlacement(
                        gameSession.gameState,
                        coords,
                        gameSession.myPlayer?.id ?? ''
                    )) ||
                (gameSession.chosenAction === ActionType.PlaceMarket &&
                    HydratedPlaceMarket.isValidCellForPlacement(
                        gameSession.gameState,
                        coords,
                        gameSession.myPlayer?.id ?? ''
                    )))
    )
    let disabled = $derived.by(() => {
        let isInteractable = interactable // need this to be evaluated... this feels like svelte bug

        if (cell.type === CellType.OffBoard) {
            return false
        }
        return interacting && !isInteractable && !gameSession.isExpropriationPreviewed(coords)
    })

    let highlighted = $derived(
        gameSession.highlightedCoords !== undefined &&
            gameSession.highlightedCoords[0] === coords[0] &&
            gameSession.highlightedCoords[1] === coords[1]
    )
    let showBorder = $state(false)

    let mayExpropriate = $derived(
        (isDiskCell(cell) &&
            (!gameSession.isMyTurn ||
                (gameSession.chosenAction !== ActionType.PlaceMarket &&
                    gameSession.chosenAction !== ActionType.PlaceStall) ||
                interactable)) ||
            (interactable && gameSession.chosenAction === ActionType.PlaceDisk)
    )

    function handleMouseOver() {
        showBorder = interactable
        if (mayExpropriate) {
            gameSession.previewExpropriation(coords)
        }
    }

    function handleMouseLeave() {
        showBorder = false
        if (mayExpropriate) {
            gameSession.clearExpropriationPreview()
        }
    }

    async function handleClick() {
        if (!interactable) {
            return
        }

        let action: GameAction | undefined = undefined

        if (gameSession.chosenAction === ActionType.PlaceDisk) {
            action = gameSession.createPlaceDiskAction(coords)
        } else if (gameSession.chosenAction === ActionType.PlaceStall) {
            const goodsType = gameSession.gameState.getChosenStallType()
            if (!goodsType) {
                return
            }
            action = gameSession.createPlaceStallAction(coords, goodsType)
        } else if (gameSession.chosenAction === ActionType.PlaceMarket) {
            action = gameSession.createPlaceMarketAction(coords)
        }

        if (!action) {
            return
        }

        showBorder = false
        await gameSession.applyAction(action)
    }

    let myColor = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id))
    let available = $derived(interacting && interactable && !showBorder)

    // Note that tabindex has to be used or interactable is not evaluated... why?
</script>

{#snippet disk(color: string, ghost = false)}
    <Disk {color} size={84} class="z-10 {ghost ? 'ff-ghost-disc' : ''}" />
{/snippet}

<div
    role="button"
    tabindex="-1"
    onfocus={() => {}}
    onclick={async () => handleClick()}
    onkeypress={async () => handleClick()}
    onmouseover={() => handleMouseOver()}
    onmouseleave={() => handleMouseLeave()}
    class="cell relative isolate w-[100px] h-[100px] min-w-[100px] min-h-[100px] flex justify-center items-center
        {interactable && interacting ? 'cursor-pointer' : ''}
        {disabled ? 'dimmed' : ''}"
    style="--cell-bg: {backgroundImage}"
    style:clip-path={cornerClip}
>
    {#if gameSession.isExpropriationPreviewed(coords)}
        <img src={roadImg} alt="road" class="absolute x-0 y-0 w-full h-full z-0 opacity-50" />
    {/if}

    {#if cell.type === CellType.Disk}
        <!-- Absolute, so a disc fading out never shares the row with the piece replacing it. -->
        <div
            class="absolute inset-0 flex justify-center items-center"
            in:fadeScale={{ baseScale: 0.1, duration: 100 }}
            out:fadeScale={{ baseScale: 0.1, duration: 50 }}
        >
            {@render disk(gameSession.colors.getPlayerUiColor(cell.playerId))}
        </div>
    {:else if cell.type === CellType.Truck}
        <WoodTruck goodsType={cell.goodsType} />
    {:else if cell.type === CellType.Stall}
        <WoodStall
            color={gameSession.colors.getPlayerUiColor(cell.playerId)}
            goodsType={cell.goodsType}
        />
    {:else if cell.type === CellType.Market}
        <WoodMarket />
    {/if}

    {#if showBorder}
        <div class="absolute inset-0 z-10 flex justify-center items-center pointer-events-none">
            {#if gameSession.chosenAction === ActionType.PlaceDisk}
                {@render disk(myColor, true)}
            {:else if gameSession.chosenAction === ActionType.PlaceStall}
                <div class="ff-ghost">
                    <WoodStall
                        color={myColor}
                        goodsType={gameSession.gameState.getChosenStallType()}
                    />
                </div>
            {:else if gameSession.chosenAction === ActionType.PlaceMarket}
                <div class="ff-ghost">
                    <WoodMarket />
                </div>
            {/if}
        </div>
        {#if gameSession.chosenAction === ActionType.PlaceDisk}
            <div class="target hover z-20"></div>
        {/if}
    {:else if available}
        <div class="target available z-20"></div>
    {:else if highlighted}
        <div class="target hover z-20"></div>
    {/if}
</div>

<style>
    /* The ground bleeds half a pixel past the square, so scaled boards show no seams between
       neighbouring squares. */
    .cell::before {
        content: '';
        position: absolute;
        inset: -0.5px;
        z-index: -1;
        background-image: var(--cell-bg);
        background-size: 100% 100%;
        pointer-events: none;
    }
    :global(.ff-ghost-disc) {
        transform: translateY(-5px);
        filter: drop-shadow(0 7px 4px rgba(0, 0, 0, 0.35));
    }
    :global(.ff-ghost) {
        width: 100%;
        height: 100%;
    }
    .target {
        position: absolute;
        inset: 3px;
        border-radius: 8px;
        pointer-events: none;
    }
    .target.available {
        box-shadow: inset 0 0 0 2px rgba(255, 236, 170, 0.85);
        opacity: 0.75;
    }
    .target.hover {
        box-shadow:
            inset 0 0 0 3px #ffd36b,
            inset 0 0 24px rgba(255, 211, 107, 0.5);
    }
    /* Dimming darkens the square itself rather than laying a translucent sheet over it;
       neighbouring sheets leave a lighter seam where they meet on a scaled board. */
    .cell.dimmed {
        filter: brightness(0.62);
    }
</style>
