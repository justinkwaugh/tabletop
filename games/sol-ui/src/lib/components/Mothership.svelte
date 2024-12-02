<script lang="ts">
    import { getContext } from 'svelte'
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
        MOTHERSHIP_RADIUS
    } from '$lib/utils/boardGeometry.js'
    import { Color } from '@tabletop/common'
    import { rotate } from '$lib/utils/animations.js'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import { HydratedLaunch } from '@tabletop/sol'
    import DropShadow from './DropShadow.svelte'

    let { playerId }: { playerId: string } = $props()
    let gameSession = getContext('gameSession') as SolGameSession

    let numPlayers = gameSession.gameState.players.length
    let color = gameSession.gameState.getPlayerState(playerId).color
    let Ship = componentForColor(color)
    let Mask = maskForColor(color)
    let shadowId = `shipshadow-${playerId}`

    let locationIndex = $derived(gameSession.gameState.board.motherships[playerId])

    const offsets = MOTHERSHIP_OFFSETS[color]
    let shapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${offsets.rotation}) translate(${offsets.x},${offsets.y}) `
    let locationTransformation = $derived(
        `rotate(${getMothershipAngle(numPlayers, color, locationIndex)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
    )

    let shipElement: SVGElement

    let outlined = $state(false)

    let myMove = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Move
    )

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer) {
            return false
        }

        const canLaunch = HydratedLaunch.canLaunchFromMothership(
            gameSession.gameState,
            myPlayer.id,
            playerId
        )

        return myMove && canLaunch
    })

    let disabled = $derived(myMove && !interactable)

    $effect(() => {
        if (!interactable) {
            outlined = false
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
            outlined = true
        }
    }

    function onMouseLeave() {
        outlined = false
    }

    function onMouseClick() {
        if (interactable && !gameSession.chosenMothership) {
            gameSession.chosenMothership = playerId
        }
    }

    // function moveShip() {
    //     const endIndex = locationIndex === 0 ? 12 : locationIndex - 1
    //     const startDegrees = getMothershipAngle(color, locationIndex)
    //     const endDegrees = getMothershipAngle(color, endIndex)
    //     const distanceDegrees =
    //         startDegrees < endDegrees
    //             ? 360 - Math.abs(startDegrees - endDegrees)
    //             : startDegrees - endDegrees
    //     rotate({
    //         object: shipElement,
    //         degrees: `-=${distanceDegrees}`,
    //         svgOrigin: `${CENTER_POINT.x}, ${CENTER_POINT.y}`,
    //         duration: 1
    //     })
    //     locationIndex = endIndex
    // }

    let shadowOffset = $derived.by(() => {
        const angle = getMothershipAngle(numPlayers, color, locationIndex) + offsets.rotation / 2
        return getCirclePoint(40, angle)
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
            <Mask fill={'transparent'} stroke={'white'} stroke-width={'32px'} overflow="visible" />
        {/if}
        <Ship />
        {#if disabled && Mask}
            <Mask fill={'black'} opacity={0.5} />
        {/if}
    </g>
</g>
