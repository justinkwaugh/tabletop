<script lang="ts">
    import {
        ActionType,
        Cell,
        CellType,
        Coordinates,
        HydratedPlaceStall,
        HydratedPlaceDisk,
        HydratedPlaceMarket,
        isDiskCell,
        isStallCell
    } from '@tabletop/fresh-fish'
    import emptyTileImg from '$lib/images/tile-empty.png'
    import roadImg from '$lib/images/tile-road.png'
    import { getContext } from 'svelte'
    import { uiColorForPlayer } from '$lib/utils/playerColors'
    import type { FreshFishGameSession } from '$lib/stores/FreshFishGameSession.svelte'
    import StallTile from '$lib/components/StallTile.svelte'
    import MarketTile from '$lib/components/MarketTile.svelte'
    import TruckTile from '$lib/components/TruckTile.svelte'
    import { fadeScale, GameSessionMode } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as FreshFishGameSession
    let { cell, coords }: { cell: Cell; coords: Coordinates } = $props()

    let cellBgColor = $derived.by(() => {
        switch (cell.type) {
            case CellType.OffBoard:
                return 'bg-transparent'
            case CellType.Road:
                return 'bg-brown-500'
            default:
                return 'bg-gray-500'
        }
    })

    let backgroundImage = $derived.by(() => {
        // if (gameSession.isExpropriationPreviewed(coords)) {
        //     return `url(${roadImg})`
        // }

        switch (cell.type) {
            case CellType.Disk:
            case CellType.Empty:
                return `url(${emptyTileImg})`
            case CellType.Road:
                return `url(${roadImg})`
            case CellType.Market:
            case CellType.Stall:
            case CellType.OffBoard:
            case CellType.Truck:
            default:
                return 'none'
        }
    })

    let playerColor = $derived(
        isStallCell(cell)
            ? gameSession.hydratedState.getPlayerState(cell.playerId)?.color
            : 'transparent'
    )

    let uiPlayerColor = $derived(
        isDiskCell(cell)
            ? uiColorForPlayer(gameSession.hydratedState.getPlayerState(cell.playerId)?.color)
            : 'transparent'
    )

    let interacting = $derived(
        gameSession.mode === GameSessionMode.Play &&
            (gameSession.chosenAction === ActionType.PlaceDisk ||
                gameSession.chosenAction === ActionType.PlaceStall ||
                gameSession.chosenAction === ActionType.PlaceMarket)
    )
    let interactable = $derived(
        (interacting &&
            gameSession.chosenAction === ActionType.PlaceDisk &&
            HydratedPlaceDisk.isValidCellForPlacement(
                gameSession.hydratedState,
                coords,
                gameSession.myPlayer?.id ?? ''
            )) ||
            (gameSession.chosenAction === ActionType.PlaceStall &&
                HydratedPlaceStall.isValidCellForPlacement(
                    gameSession.hydratedState,
                    coords,
                    gameSession.myPlayer?.id ?? ''
                )) ||
            (gameSession.chosenAction === ActionType.PlaceMarket &&
                HydratedPlaceMarket.isValidCellForPlacement(
                    gameSession.hydratedState,
                    coords,
                    gameSession.myPlayer?.id ?? ''
                ))
    )
    let disabled = $derived.by(() => {
        if (cell.type === CellType.OffBoard) {
            return false
        }
        if (gameSession.highlightedCoords !== undefined) {
            if (
                gameSession.highlightedCoords[0] !== coords[0] ||
                gameSession.highlightedCoords[1] !== coords[1]
            ) {
                return true
            } else {
                return false
            }
        }
        return interacting && !interactable
    })
    let tabIndex = $derived(interactable ? 0 : -1)
    let showBorder = $state(false)

    let mayExpropriate = $derived(
        isDiskCell(cell) &&
            (!gameSession.isMyTurn ||
                (gameSession.chosenAction !== ActionType.PlaceMarket &&
                    gameSession.chosenAction !== ActionType.PlaceStall &&
                    gameSession.chosenAction !== ActionType.PlaceDisk) ||
                (interactable &&
                    (gameSession.chosenAction === ActionType.PlaceMarket ||
                        gameSession.chosenAction === ActionType.PlaceStall)))
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

    function handleClick() {
        if (!interactable) {
            return
        }
        if (gameSession.chosenAction === ActionType.PlaceDisk) {
            const placeDiskAction = gameSession.createPlaceDiskAction(coords)
            gameSession.applyAction(placeDiskAction)
            gameSession.chosenAction = undefined
            showBorder = false
        } else if (gameSession.chosenAction === ActionType.PlaceStall) {
            const goodsType = gameSession.hydratedState.getChosenStallType()
            if (!goodsType) {
                return
            }
            const placeStallAction = gameSession.createPlaceStallAction(coords, goodsType)
            gameSession.applyAction(placeStallAction)
            gameSession.chosenAction = undefined
            gameSession.clearExpropriationPreview()
            showBorder = false
        } else if (gameSession.chosenAction === ActionType.PlaceMarket) {
            const placeMarketAction = gameSession.createPlaceMarketAction(coords)
            gameSession.applyAction(placeMarketAction)
            gameSession.chosenAction = undefined
            gameSession.clearExpropriationPreview()
            showBorder = false
        }
    }
</script>

<div
    role="button"
    tabindex={tabIndex}
    onfocus={() => {}}
    onclick={() => handleClick()}
    onkeypress={() => handleClick()}
    onmouseover={() => handleMouseOver()}
    onmouseleave={() => handleMouseLeave()}
    class="relative w-[100px] h-[100px] min-w-[100px] min-h-[100px] flex justify-center align-center bg-contain bg-origin-border dark:{cellBgColor} {showBorder
        ? 'border-4'
        : ''} border-orange-400"
    style="background-image: {backgroundImage}"
>
    {#if gameSession.isExpropriationPreviewed(coords)}
        <img src={roadImg} alt="road" class="absolute x-0 y-0 w-full h-full z-0 opacity-50" />
    {/if}

    {#if cell.type === CellType.Disk}
        <svg
            in:fadeScale={{ baseScale: 0.1, duration: 100 }}
            out:fadeScale={{ baseScale: 0.1, duration: 50 }}
            class="pointer-events-none z-10"
            viewBox="0 0 30 30"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle fill={uiPlayerColor} stroke="#333333" stroke-width=".5" cx="15" cy="15" r="6"
            ></circle>
        </svg>
    {:else if cell.type === CellType.Truck}
        <TruckTile goodsType={cell.goodsType} />
    {:else if cell.type === CellType.Stall}
        <StallTile {playerColor} goodsType={cell.goodsType} />
    {:else if cell.type === CellType.Market}
        <MarketTile />
    {/if}
    <div
        class="z-20 absolute top left w-[100px] h-[100px] bg-black opacity-50 {disabled
            ? ''
            : 'hidden'}"
    ></div>
</div>
