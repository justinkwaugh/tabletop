<script lang="ts">
    import { T } from '@threlte/core'
    import {
        ActionType,
        Barrier,
        Company,
        isBarrier,
        isCancelCube,
        isCube,
        isRoof,
        MachineState,
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
    import Barrier3d from '$lib/3d/BarrierOne.svelte'
    import type { Effects } from '$lib/model/Effects.svelte'
    import { Bloomer } from '$lib/utils/bloomer'

    let gameSession = getContext('gameSession') as EstatesGameSession
    const effects = getContext('effects') as Effects
    const bloomer = new Bloomer(effects)

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

    let canSelectBarrier = $derived.by(() => {
        if (!gameSession.isMyTurn) {
            return false
        }
        if (
            gameSession.gameState.machineState !== MachineState.PlacingPiece ||
            !isCancelCube(gameSession.gameState.chosenPiece)
        ) {
            return false
        }

        if (site.barriers.length === 0) {
            return false
        }

        return true
    })

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
        if (gameSession.gameState.machineState !== MachineState.PlacingPiece) {
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

    function enterBarrier(event: any, barrier: Barrier) {
        if (
            !canSelectBarrier ||
            !gameSession.gameState.board.canRemoveBarrierFromSite(barrier, coords)
        ) {
            return
        }

        event.stopPropagation()
        bloomer.addBloom(event.object, 'barrier')
    }

    function leavePiece(event: any) {
        bloomer.removeBloom(event.object, 'barrier')
    }

    function onBarrierClick(event: any, barrier: Barrier) {
        if (
            !canSelectBarrier ||
            !gameSession.gameState.board.canRemoveBarrierFromSite(barrier, coords)
        ) {
            return
        }

        bloomer.removeBloom(event.object, 'barrier')

        gameSession.removeBarrier(barrier, coords)
    }

    let barrierStart = $derived.by(() => {
        if (site.barriers.length === 2) {
            return -0.4
        } else if (site.barriers.length === 3) {
            return -0.4
        }

        return 0
    })

    let barrierOffset = $derived.by(() => {
        if (site.barriers.length === 2) {
            return 0.7
        } else if (site.barriers.length === 3) {
            return 0.4
        }
        return 0
    })
</script>

<T.Group position.x={x} position.y={y} position.z={z} scale={1}>
    {#if canPreview}
        <T.Mesh
            oncreate={(ref) => {
                effects.bloom?.selection.add(ref)
                return () => {
                    effects.bloom?.selection.delete(ref)
                }
            }}
            position.y={-0.49 + site.cubes.length}
            rotation.x={-Math.PI / 2}
        >
            <T.PlaneGeometry args={site.cubes.length === 0 ? [1.3, 1.3] : [1, 1]} />
            <T.MeshBasicMaterial color={'white'} transparent={true} opacity={0.5} />
        </T.Mesh>
    {/if}
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
        <Cube3d
            {cube}
            position.x={0}
            position.z={0}
            position.y={i}
            rotation.z={gameSession.mobileView ? -Math.PI / 2 : 0}
        />
    {/each}
    {#if site.roof}
        <Roof3d
            roof={site.roof}
            position.x={0}
            position.z={0}
            position.y={site.cubes.length - 0.305}
            rotation.y={gameSession.mobileView ? -Math.PI / 2 : 0}
        />
    {/if}
    {#each site.barriers as barrier, i}
        <Barrier3d
            stripes={barrier.value}
            onpointerenter={(event: any) => enterBarrier(event, barrier)}
            onpointerleave={leavePiece}
            onclick={(event: any) => onBarrierClick(event, barrier)}
            position.x={barrierStart + i * barrierOffset}
            z={0}
            position.y={0}
        />
    {/each}
    {#if hoverCube}
        <Cube3d
            cube={hoverCube}
            position.x={0}
            position.z={0}
            position.y={site.cubes.length}
            rotation.z={gameSession.mobileView ? -Math.PI / 2 : 0}
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
            rotation.y={gameSession.mobileView ? -Math.PI / 2 : 0}
            scale={$scale}
        />
    {/if}
    {#if hoverBarrier}
        <Barrier3d
            stripes={hoverBarrier.value}
            transparent={true}
            opacity={0.6}
            barrier={hoverBarrier}
            position.x={0}
            position.z={0}
            position.y={0}
            scale={$scale}
        />
    {/if}
</T.Group>
