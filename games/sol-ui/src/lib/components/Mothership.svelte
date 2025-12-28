<script lang="ts">
    import { getContext } from 'svelte'
    import GreenShip from '$lib/images/greenShip.svelte'
    import GreenShipMask from '$lib/images/greenShipMask.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import PurpleShipMask from '$lib/images/purpleShipMask.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import SilverShipMask from '$lib/images/silverShipMask.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlackShipMask from '$lib/images/blackShipMask.svelte'
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
    import { HydratedLaunch } from '@tabletop/sol'
    import DropShadow from './DropShadow.svelte'
    import {
        animateMothership,
        MothershipAnimator
    } from '$lib/animators/mothershipAnimator.svelte.js'

    let { playerId }: { playerId: string } = $props()
    let gameSession = getContext('gameSession') as SolGameSession

    let numPlayers = gameSession.gameState.players.length
    let color = gameSession.gameState.getPlayerState(playerId).color
    let Ship = componentForColor(color)
    let Mask = maskForColor(color)
    let shadowId = `shipshadow-${playerId}`
    let highlightId = `highlight-${shadowId}`

    let locationIndex = $derived(gameSession.mothershipLocations.get(playerId) ?? 0)

    const offsets = MOTHERSHIP_OFFSETS[color]

    // This is the basic transformation for the mothership from which we rotate it around the center point
    let shapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${offsets.rotation}) translate(${offsets.x},${offsets.y}) `

    let shipElement: SVGElement

    let hovered = $state(false)
    let selected = $derived(
        gameSession.chosenMothership === playerId && !gameSession.chosenNumDivers
    )
    let outlined = $derived(hovered || selected)

    let myMove = $derived(gameSession.isMyTurn && gameSession.isMoving)

    let interactable = $derived.by(() => {
        if (gameSession.updatingVisibleState) {
            return false
        }
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

    let disabled = $derived(myMove && !interactable && !gameSession.updatingVisibleState)

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
            case Color.Purple:
                return PurpleShipMask
            case Color.Black:
                return BlackShipMask
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

    let shadowOffset = $derived.by(() => {
        const angleInDegrees =
            (360 - getMothershipAngle(numPlayers, color, locationIndex) + 45 + offsets.rotation) %
            360
        const angle = toRadians(angleInDegrees)
        const offset = getCirclePoint(45, angle)
        return offset
    })

    const animator = new MothershipAnimator(gameSession, playerId)
</script>

<g
    use:animateMothership={{ animator, index: locationIndex }}
    class={interactable ? '' : 'pointer-events-none'}
    style="will-change: transform"
>
    <g
        bind:this={shipElement}
        onclick={onMouseClick}
        onmouseenter={onMouseEnter}
        onmouseleave={onMouseLeave}
        transform={shapeTransformation}
    >
        <DropShadow id={shadowId} width="150%" height="150%" offset={shadowOffset} amount={10} />
        {#if interactable && color === Color.Black}
            <DropShadow
                id={highlightId}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
                offset={{ x: 0, y: 0 }}
                amount={30}
                source="graphic"
            />
            <g transform="scale(1.1)" style="transform-box:fill-box; transform-origin: center;">
                <Mask
                    fill={'white'}
                    opacity="1"
                    overflow="visible"
                    style="filter: url(#{highlightId})"
                />
            </g>
            <Mask
                fill={'transparent'}
                stroke={'black'}
                stroke-width={'10px'}
                opacity=".8"
                overflow="visible"
            />
        {:else if !animator.animating}
            <Mask fill={'black'} opacity=".5" overflow="visible" style="filter: url(#{shadowId})" />
        {/if}
        {#if outlined}
            <Mask fill={'transparent'} stroke={'white'} stroke-width={'50px'} overflow="visible" />
        {/if}
        <Ship />
        {#if disabled}
            <Mask fill={'black'} opacity={0.5} />
        {/if}
    </g>
</g>
