<script lang="ts">
    import { T } from '@threlte/core'
    import { ActionType, Company, isCube, isRoof, Piece, Site } from '@tabletop/estates'
    import Cube3d from './Cube3d.svelte'
    import { Cube } from '@tabletop/estates'
    import Roof from './Roof.svelte'
    import { spring } from 'svelte/motion'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import type { OffsetCoordinates } from '@tabletop/common'

    let gameSession = getContext('gameSession') as EstatesGameSession

    let {
        site,
        coords,
        x = 0,
        y = 0,
        z = 0
    }: { site: Site; coords: OffsetCoordinates; x?: number; y?: number; z?: number } = $props()
    let scale = spring(0.1)

    let hoverCube: Cube | undefined = $state()
    function onPointerEnter(event: PointerEvent) {
        if (!canPreview) {
            return
        }

        if (isCube(gameSession.gameState.chosenPiece)) {
            hoverCube = gameSession.gameState.chosenPiece as Cube
        }

        event.stopPropagation()
        scale.set(1)
    }
    function onPointerLeave(event: PointerEvent) {
        hoverCube = undefined
        event.stopPropagation()
        scale.set(0.1)
    }

    async function onClick(event: MouseEvent) {
        if (!canPreview) {
            return
        }

        if (isCube(gameSession.gameState.chosenPiece)) {
            hoverCube = undefined
            await gameSession.placeCube(gameSession.gameState.chosenPiece, coords)
        } else if (isRoof(gameSession.gameState.chosenPiece)) {
            // gameSession.applyAction(gameSession.createPlaceRoofAction(site))
        }
    }
    let height = $derived(site.cubes.length + (site.roof !== undefined ? 0.5 : 0))
    let dims = $derived(site.cubes.length === 0 ? 1.6 : 1)

    let canPreview = $derived.by(() => {
        if (!gameSession.isMyTurn) {
            return false
        }
        if (
            gameSession.chosenAction !== ActionType.PlaceRoof &&
            gameSession.chosenAction !== ActionType.PlaceCube
        ) {
            return false
        }
        const chosenPiece = gameSession.gameState.chosenPiece
        if (!chosenPiece || (!isCube(chosenPiece) && !isRoof(chosenPiece))) {
            return false
        }

        if (
            isCube(chosenPiece) &&
            !gameSession.gameState.board.canPlaceCubeAtCoords(chosenPiece, coords)
        ) {
            return false
        }

        return true
    })
</script>

<T.Group position.x={x} position.y={y} position.z={z} scale={1}>
    <T.Mesh
        depthOffset={5}
        position.y={height / 2 - 0.5}
        onpointerenter={onPointerEnter}
        onpointerleave={onPointerLeave}
        onclick={onClick}
    >
        <T.BoxGeometry args={[dims, height, dims]} />
        <T.MeshBasicMaterial color={'white'} transparent={true} opacity={0} />
    </T.Mesh>
    {#each site.cubes as cube, i}
        <Cube3d {cube} position.x={0} position.z={0} position.y={i} />
    {/each}
    {#if hoverCube}
        <Cube3d
            transparent={true}
            opacity={0.6}
            cube={hoverCube}
            position.x={0}
            position.z={0}
            position.y={site.cubes.length}
            scale={$scale}
        />
    {/if}
    {#if site.roof}
        <Roof roof={site.roof} x={0} z={0} y={site.cubes.length - 0.25} />
    {/if}
</T.Group>
