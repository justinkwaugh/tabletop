<script lang="ts">
    import { getContext } from 'svelte'
    import GreenShip from '$lib/images/greenShip.svelte'
    import GreenShipMask from '$lib/images/greenShipMask.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import SilverShipMask from '$lib/images/silverShipMask.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import {
        CENTER_POINT,
        getMothershipAngle,
        MOTHERSHIP_OFFSETS,
        MOTHERSHIP_RADIUS
    } from '$lib/utils/boardGeometry.js'
    import { Color } from '@tabletop/common'
    import { rotate } from '$lib/utils/animations.js'

    let { playerId }: { playerId: string } = $props()
    let gameSession = getContext('gameSession') as SolGameSession
    let color = gameSession.gameState.getPlayerState(playerId).color
    let locationIndex = gameSession.gameState.board.motherships[playerId]
    let Ship = componentForColor(color)
    let Mask = maskForColor(color)
    const offsets = MOTHERSHIP_OFFSETS[color]
    let shapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.4) translate(${offsets.x},${offsets.y})`
    let locationTransformation = $derived(
        `rotate(${getMothershipAngle(color, locationIndex)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
    )

    let shipElement: SVGElement
    let disabled = $state(false)
    let outlined = $state(false)

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
            default:
                return undefined
        }
    }

    function moveShip() {
        const endIndex = locationIndex === 0 ? 12 : locationIndex - 1
        const startDegrees = getMothershipAngle(color, locationIndex)
        const endDegrees = getMothershipAngle(color, endIndex)
        const distanceDegrees =
            startDegrees < endDegrees
                ? 360 - Math.abs(startDegrees - endDegrees)
                : startDegrees - endDegrees
        rotate({
            object: shipElement,
            degrees: `-=${distanceDegrees}`,
            svgOrigin: `${CENTER_POINT.x}, ${CENTER_POINT.y}`,
            duration: 1
        })
        locationIndex = endIndex
    }
</script>

<g transform={locationTransformation}>
    <g bind:this={shipElement} onclick={moveShip} transform={shapeTransformation}>
        {#if outlined && Mask}
            <Mask fill={'transparent'} stroke={'white'} stroke-width={'32px'} overflow="visible" />
        {/if}
        <Ship />
        {#if disabled && Mask}
            <Mask fill={'black'} opacity={0.5} />
        {/if}
    </g>
</g>
