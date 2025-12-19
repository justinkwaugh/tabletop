<script lang="ts">
    import { getContext } from 'svelte'
    import '$lib/styles/focusable-control.css'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { Color, OffsetCoordinates, sameCoordinates } from '@tabletop/common'
    import {
        getCirclePoint,
        toRadians,
        translateFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import { ConvertType } from '$lib/definition/convertType.js'
    import { CENTER_COORDS } from '@tabletop/sol'

    let {
        key,
        position,
        coords,
        neighborCoords
    }: {
        key: number
        position: GatePosition
        coords: OffsetCoordinates
        neighborCoords: OffsetCoordinates
    } = $props()

    const gameSession = getContext('gameSession') as SolGameSession
    let location = $derived(getCirclePoint(position.radius, toRadians(position.angle)))

    let myConvert = $derived(gameSession.isMyTurn && gameSession.isConverting)

    let myMove = $derived(gameSession.isMyTurn && gameSession.isMoving)

    let playerId = $derived(gameSession.gameState.board.gates[key]?.playerId)

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer || (!myConvert && !myMove)) {
            return false
        }

        if (myConvert && gameSession.chosenConvertType === ConvertType.SolarGate) {
            return gameSession.validGateDestinations.includes(key)
        }

        if (myMove) {
            return gameSession.gateChoices?.includes(key)
        }

        return false
    })

    function onClick() {
        if (!interactable) {
            return
        }

        // Do the convert
        if (myConvert) {
            gameSession.chosenSource = coords
            gameSession.chosenDestination = neighborCoords
            gameSession.convertGate()
        } else if (myMove) {
            if (!gameSession.chosenGates) {
                gameSession.chosenGates = []
            }
            gameSession.chosenGates?.push(key)
            if (sameCoordinates(gameSession.chosenDestination, CENTER_COORDS)) {
                gameSession.hurl()
            } else {
                gameSession.fly()
            }
        }
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }
</script>

{#if interactable && !gameSession.animating}
    <g
        class="focusable-control"
        role="button"
        tabindex={interactable ? 0 : -1}
        aria-disabled={interactable}
        onclick={onClick}
        onkeydown={onKeyDown}
        transform={translateFromCenter(location.x, location.y)}
        stroke="none"
    >
        <circle
            class="hover:stroke-white"
            cx="0"
            cy="0"
            r="24"
            stroke="black"
            stroke-width="4"
            fill={playerId ? gameSession.colors.getPlayerUiColor(playerId) : Color.White}
            opacity="1"
        ></circle>
    </g>
{/if}
