<script lang="ts">
    import { T } from '@threlte/core'
    import {
        ActionType,
        Barrier,
        Company,
        isBarrier,
        isCube,
        isRoof,
        Piece,
        Site
    } from '@tabletop/estates'
    import Cube3d from './Cube3d.svelte'
    import { Cube, Roof } from '@tabletop/estates'
    import Roof3d from './Roof3d.svelte'
    import { spring } from 'svelte/motion'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import type { OffsetCoordinates } from '@tabletop/common'
    import Barrier3d from '$lib/3d/Barrier.svelte'

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
    let hoverRoof: Roof | undefined = $state()
    let hoverBarrier: Barrier | undefined = $state()

    function onPointerEnter(event: PointerEvent) {
        if (!canPreview) {
            return
        }

        if (isCube(gameSession.gameState.chosenPiece)) {
            hoverCube = gameSession.gameState.chosenPiece as Cube
        }

        if (isRoof(gameSession.gameState.chosenPiece)) {
            hoverRoof = gameSession.gameState.chosenPiece as Roof
        }

        if (isBarrier(gameSession.gameState.chosenPiece)) {
            hoverBarrier = gameSession.gameState.chosenPiece as Barrier
        }

        event.stopPropagation()
        scale.set(1)
    }
    function onPointerLeave(event: PointerEvent) {
        hoverCube = undefined
        hoverRoof = undefined
        hoverBarrier = undefined
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
            hoverRoof = undefined
            await gameSession.placeRoof(gameSession.gameState.chosenPiece, coords)
        } else if (isBarrier(gameSession.gameState.chosenPiece)) {
            hoverBarrier = undefined
            await gameSession.placeBarrier(gameSession.gameState.chosenPiece, coords)
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
            gameSession.chosenAction !== ActionType.PlaceCube &&
            gameSession.chosenAction !== ActionType.PlaceBarrier
        ) {
            return false
        }
        const chosenPiece = gameSession.gameState.chosenPiece
        if (
            !chosenPiece ||
            (!isCube(chosenPiece) && !isRoof(chosenPiece) && !isBarrier(chosenPiece))
        ) {
            return false
        }

        if (
            isCube(chosenPiece) &&
            !gameSession.gameState.board.canPlaceCubeAtCoords(chosenPiece, coords)
        ) {
            return false
        }

        if (isRoof(chosenPiece) && !gameSession.gameState.board.canPlaceRoofAtSite(coords)) {
            return false
        }

        if (
            isBarrier(chosenPiece) &&
            !gameSession.gameState.board.canPlaceBarrierAtSite(chosenPiece, coords)
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
    {#if site.roof}
        <Roof3d roof={site.roof} x={0} z={0} position.y={site.cubes.length - 0.305} />
    {/if}
    {#if site.barrier}
        <Barrier3d barrier={site.barrier} x={0} z={0} position.y={0} rotation.y={Math.PI / 2} />
    {/if}
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
    {#if hoverRoof}
        <Roof3d
            transparent={true}
            opacity={0.6}
            roof={hoverRoof}
            position.x={0}
            position.z={0}
            position.y={site.cubes.length - 0.305}
            scale={$scale}
        />
    {/if}
    {#if hoverBarrier}
        <Barrier3d
            transparent={true}
            opacity={0.6}
            barrier={hoverBarrier}
            position.x={0}
            position.z={0}
            position.y={0}
            rotation.y={Math.PI / 2}
            scale={$scale}
        />
    {/if}
</T.Group>
