<script lang="ts">
    import { getContext } from 'svelte'
    import '$lib/styles/focusable-control.css'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { OffsetCoordinates } from '@tabletop/common'
    import {
        getCirclePoint,
        toRadians,
        translateFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import { ActionCategory } from '$lib/definition/actionCategory.js'
    import { ConvertType } from '$lib/definition/convertType.js'

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

    let myConvert = $derived(
        gameSession.isMyTurn && gameSession.chosenActionCategory === ActionCategory.Convert
    )

    let interactable = $derived.by(() => {
        const myPlayer = gameSession.myPlayer
        if (!myPlayer || !myConvert) {
            return false
        }

        if (gameSession.chosenConvertType === ConvertType.SolarGate) {
            return gameSession.validGateDestinations.includes(key)
        }

        return false
    })

    function onClick() {
        if (!interactable) {
            return
        }

        // Do the convert
        gameSession.chosenSource = coords
        gameSession.chosenDestination = neighborCoords
        gameSession.convert()
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }
</script>

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
    {#if interactable}
        <circle cx="0" cy="0" r="20" stroke="yellow" fill="white" opacity="0.8"></circle>
    {/if}
</g>
