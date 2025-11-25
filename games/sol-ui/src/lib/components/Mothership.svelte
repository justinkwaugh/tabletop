<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import GreenShip from '$lib/images/greenShip.svelte'
    import GreenShipMask from '$lib/images/greenShipMask.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import SilverShipMask from '$lib/images/silverShipMask.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import BlueShipMask from '$lib/images/blueShipMask.svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import {
        CENTER_POINT,
        getCirclePoint,
        getMothershipAngle,
        MOTHERSHIP_OFFSETS,
        MOTHERSHIP_RADIUS,
        toRadians
    } from '$lib/utils/boardGeometry.js'
    import { Color } from '@tabletop/common'
    import { rotate } from '$lib/utils/animations.js'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import { HydratedLaunch, SolGameState } from '@tabletop/sol'
    import DropShadow from './DropShadow.svelte'
    import { gsap } from 'gsap'

    let { playerId }: { playerId: string } = $props()
    let gameSession = getContext('gameSession') as SolGameSession

    let numPlayers = gameSession.gameState.players.length
    let color = gameSession.gameState.getPlayerState(playerId).color
    let Ship = componentForColor(color)
    let Mask = maskForColor(color)
    let shadowId = `shipshadow-${playerId}`

    let locationIndex = $derived(gameSession.gameState.board.motherships[playerId])

    const offsets = MOTHERSHIP_OFFSETS[color]

    // This is the basic transformation for the mothership from which we rotate it around the center point
    let shapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${offsets.rotation}) translate(${offsets.x},${offsets.y}) `
    let locationTransformation = $derived(
        `rotate(${getMothershipAngle(numPlayers, color, locationIndex)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
    )

    let shipElement: SVGElement

    let hovered = $state(false)
    let selected = $derived(
        gameSession.chosenMothership === playerId && !gameSession.chosenNumDivers
    )
    let outlined = $derived(hovered || selected)

    let myMove = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Move
    )

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer || !myMove) {
            return false
        }

        const canChooseToLaunch = !gameSession.chosenMothership && !gameSession.chosenSource
        if (!canChooseToLaunch) {
            return false
        }

        return HydratedLaunch.canLaunchFromMothership(gameSession.gameState, myPlayer.id, playerId)
    })

    let disabled = $derived(myMove && !interactable)

    $effect(() => {
        if (!interactable) {
            hovered = false
        }
    })

    function componentForColor(color: Color) {
        switch (color) {
            case Color.Green:
                return GreenShip
            case Color.Purple:
                return PurpleShip
            case Color.Gray:
                return SilverShip
            case Color.Black:
                return BlackShip
            case Color.Blue:
                return BlueShip
            default:
                return GreenShip
        }
    }

    function maskForColor(color: Color) {
        switch (color) {
            case Color.Green:
                return GreenShipMask
            case Color.Gray:
                return SilverShipMask
            case Color.Blue:
                return BlueShipMask
            default:
                return undefined
        }
    }

    function onMouseEnter() {
        if (interactable) {
            hovered = true
        }
    }

    function onMouseLeave() {
        hovered = false
    }

    function onMouseClick() {
        if (interactable && !gameSession.chosenMothership) {
            gameSession.chosenMothership = playerId
            if (gameSession.numPlayerCanMoveFromSource() === 1) {
                gameSession.chosenNumDivers = 1
            }
        }
    }

    async function onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: SolGameState
        from?: SolGameState
        timeline: unknown
    }) {
        const startIndex = from ? from.board.motherships[playerId] : locationIndex
        const endIndex = to.board.motherships[playerId]
        if (startIndex !== endIndex) {
            moveShip(timeline as gsap.core.Timeline, startIndex, endIndex)
        }
    }

    function moveShip(timeline: gsap.core.Timeline, startIndex: number, endIndex: number) {
        const startDegrees = getMothershipAngle(numPlayers, color, startIndex)
        const endDegrees = getMothershipAngle(numPlayers, color, endIndex)

        let direction = ''
        let distanceDegrees = 0
        if ((endDegrees - startDegrees + 360) % 360 === 0) {
            // No movement needed
            return
        } else if ((endDegrees - startDegrees + 360) % 360 <= 180) {
            direction = '+='
            distanceDegrees = (endDegrees - startDegrees + 360) % 360
        } else {
            direction = '-='
            distanceDegrees = (startDegrees - endDegrees + 360) % 360
        }
        rotate({
            timeline,
            object: shipElement,
            degrees: `${direction}${distanceDegrees}`,
            svgOrigin: `${CENTER_POINT.x}, ${CENTER_POINT.y}`,
            duration: 0.5,
            position: 'mothership',
            onComplete: () => {
                // detach gsap so it doesn't interfere with future transforms, and set the transforms to the desired final state
                locationIndex = endIndex
                gsap.set(shipElement, { clearProps: 'transform' })
                shipElement.setAttribute('transform', shapeTransformation)
            }
        })
    }

    let shadowOffset = $derived.by(() => {
        const angleInDegrees =
            (360 - getMothershipAngle(numPlayers, color, locationIndex) + 45 + offsets.rotation) %
            360
        const angle = toRadians(angleInDegrees)
        const offset = getCirclePoint(45, angle)
        return offset
    })

    onMount(() => {
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })
</script>

<g transform={locationTransformation}>
    <g
        bind:this={shipElement}
        onclick={onMouseClick}
        onmouseenter={onMouseEnter}
        onmouseleave={onMouseLeave}
        transform={shapeTransformation}
    >
        <DropShadow id={shadowId} width="150%" height="150%" offset={shadowOffset} amount={10} />
        {#if Mask}
            <Mask fill={'black'} opacity=".5" overflow="visible" style="filter: url(#{shadowId})" />
        {/if}
        {#if outlined && Mask}
            <Mask fill={'transparent'} stroke={'white'} stroke-width={'50px'} overflow="visible" />
        {/if}
        <Ship />
        {#if disabled && Mask}
            <Mask fill={'black'} opacity={0.5} />
        {/if}
    </g>
</g>
