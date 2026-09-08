<script lang="ts">
    import { useThrelte, T } from '@threlte/core'
    import {
        Barrier,
        EstatesGameConfig,
        HydratedEstatesGameState,
        isBarrier,
        isCancelCube,
        isCube,
        isRoof,
        MachineState,
        Site
    } from '@tabletop/estates'
    import Cube3d from './Cube3d.svelte'
    import { Cube, Roof } from '@tabletop/estates'
    import Roof3d from './Roof3d.svelte'
    import { spring } from 'svelte/motion'
    import { getContext, onDestroy } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { GameAction, remove, type OffsetCoordinates } from '@tabletop/common'
    import Barrier3d from '$lib/3d/BarrierOne.svelte'
    import type { Effects } from '$lib/model/Effects.svelte'
    import { EffectHighlighter } from '$lib/utils/effectHighlighter'
    import { gsap, Power2 } from 'gsap'
    import { PulsingMaterial } from '$lib/utils/pulsingMaterial.js'
    import { placementPieceKey, withPlacementPreview } from '$lib/utils/placementPreview.js'
    import { fadeOut, scaleIn, scaleOut } from '$lib/utils/animations'
    import type { Object3D } from 'three'
    import { ColumnOffsets } from '$lib/utils/boardOffsets'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const { invalidate } = useThrelte()

    let gameSession = getGameSession() as EstatesGameSession
    const effects = getContext('effects') as Effects
    const bloomer = new EffectHighlighter(() => effects.bloom?.selection, invalidate)

    let {
        site,
        coords,
        x = 0,
        y = 0,
        z = 0
    }: { site: Site; coords: OffsetCoordinates; x?: number; y?: number; z?: number } = $props()
    let scale = spring(0.1)

    let hoverCube: Cube | undefined = $state()
    let placedCubes = $derived(site.cubes)
    const visibleCubes = $derived(withPlacementPreview(placedCubes, hoverCube))
    let hoverRoof: Roof | undefined = $state()
    let placedRoof = $derived(site.roof)
    const visibleRoof = $derived(placedRoof ?? hoverRoof)
    let hoverBarrier: Barrier | undefined = $state()

    let placedBarriers = $derived(site.barriers)
    const visibleBarriers = $derived(withPlacementPreview(placedBarriers, hoverBarrier))
    let committingPlacement = $state(false)
    let barrierObjects: Map<number, Object3D> = new Map()
    let cubeObjects: Object3D[] = []
    let roofObject: Object3D | undefined

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

    async function onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedEstatesGameState
        from?: HydratedEstatesGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        const upcomingSite = to.board.getSiteAtCoords(coords)
        if (!upcomingSite) {
            return
        }

        if (upcomingSite.cubes.length > site.cubes.length) {
            placedCubes = upcomingSite.cubes
        }
        if (upcomingSite.roof) {
            placedRoof = upcomingSite.roof
        }

        for (const barrier of site.barriers) {
            if (upcomingSite.barriers.find((b) => b.value === barrier.value)) {
                continue
            }
            const barrierCoords = to.board.findBarrierSite(barrier)
            if (!barrierCoords) {
                const barrierObject = barrierObjects.get(barrier.value)
                if (barrierObject) {
                    fadeOut({
                        onUpdate: invalidate,
                        object: barrierObject,
                        duration: 0.2,
                        timeline: animationContext.actionTimeline,
                        startAt: 0
                    })
                }
            } else {
                const barrierSite = to.board.getSiteAtCoords(barrierCoords)
                const barrierObject = barrierObjects.get(barrier.value)
                if (barrierObject && barrierSite) {
                    const index = barrierSite.barriers.findIndex((b) => b.value === barrier.value)
                    const offsetInSite =
                        calculateBarrierStart(barrierSite.barriers) +
                        index * calculateBarrierOffset(barrierSite.barriers)

                    animationContext.actionTimeline.to(
                        barrierObject.position,
                        {
                            x: ColumnOffsets[barrierCoords.col] - x + offsetInSite,
                            duration: 0.2,
                            ease: Power2.easeInOut,
                            onUpdate: invalidate
                        },
                        0
                    )
                }
            }
        }
        const hoverBarrierObject = hoverBarrier && barrierObjects.get(hoverBarrier.value)
        if (hoverBarrier && hoverBarrierObject) {
            const index = upcomingSite.barriers.findIndex((b) => b.value === hoverBarrier!.value)
            if (index >= 0) {
                placedBarriers = [...site.barriers, upcomingSite.barriers[index]]
            }
            const offsetInSite =
                calculateBarrierStart(upcomingSite.barriers) +
                index * calculateBarrierOffset(upcomingSite.barriers)
            animationContext.actionTimeline.to(
                hoverBarrierObject.position,
                {
                    x: offsetInSite,
                    duration: 0.2,
                    ease: Power2.easeInOut,
                    onUpdate: invalidate
                },
                0
            )
        }

        for (const [i, cube] of site.cubes.entries()) {
            if (i < upcomingSite.cubes.length) {
                continue
            }
            const cubeObject = cubeObjects[i]
            if (cubeObject) {
                scaleOut({
                    onUpdate: invalidate,
                    object: cubeObject,
                    duration: 0.1,
                    timeline: animationContext.actionTimeline,
                    startAt: 0
                })
                fadeOut({
                    onUpdate: invalidate,
                    object: cubeObject,
                    duration: 0.1,
                    timeline: animationContext.actionTimeline,
                    startAt: 0
                })
            }
        }

        if (site.roof && !upcomingSite.roof && roofObject) {
            scaleOut({
                onUpdate: invalidate,
                object: roofObject,
                duration: 0.1,
                timeline: animationContext.actionTimeline,
                startAt: 0
            })
            fadeOut({
                onUpdate: invalidate,
                object: roofObject,
                duration: 0.1,
                timeline: animationContext.actionTimeline,
                startAt: 0
            })
        }
    }

    gameSession.addGameStateChangeListener(onGameStateChange)

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
        if (!committingPlacement) {
            hoverCube = undefined
            hoverRoof = undefined
            hoverBarrier = undefined
            scale.set(0.1)
        }
        event.stopPropagation()
    }

    async function onClick(event: MouseEvent) {
        if (!canPreview) {
            return
        }

        committingPlacement = true
        try {
            if (isCube(gameSession.gameState.chosenPiece)) {
                canPreview = false
                await gameSession.placeCube(gameSession.gameState.chosenPiece, coords)
            } else if (isRoof(gameSession.gameState.chosenPiece)) {
                await gameSession.placeRoof(gameSession.gameState.chosenPiece, coords)
            } else if (isBarrier(gameSession.gameState.chosenPiece)) {
                await gameSession.placeBarrier(gameSession.gameState.chosenPiece, coords)
            }
        } finally {
            committingPlacement = false
            hoverCube = undefined
            hoverRoof = undefined
            hoverBarrier = undefined
            scale.set(0.1)
        }
    }
    let height = $derived(site.cubes.length + (site.roof !== undefined ? 0.5 : 0))
    let dims = $derived(site.cubes.length === 0 ? 1.6 : 1)

    let canPreview = $derived.by(() => {
        if (!gameSession.isMyTurn || !gameSession.isPlayable) {
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
        bloomer.highlight(event.object, 'barrier')
    }

    function leavePiece(event: any) {
        bloomer.remove(event.object, 'barrier')
    }

    function onBarrierClick(event: any, barrier: Barrier) {
        event.stopPropagation()
        if (
            !canSelectBarrier ||
            !gameSession.gameState.board.canRemoveBarrierFromSite(barrier, coords)
        ) {
            return
        }

        bloomer.remove(event.object, 'barrier')

        gameSession.removeBarrier(barrier, coords)
    }

    function calculateBarrierStart(barriers: Barrier[]) {
        if (barriers.length === 2 || barriers.length === 3) {
            return -0.4
        }
        return 0
    }

    function calculateBarrierOffset(barriers: Barrier[]) {
        if (barriers.length === 2) {
            return 0.7
        } else if (barriers.length === 3) {
            return 0.4
        }
        return 0
    }

    let barrierStart = $derived.by(() => {
        return calculateBarrierStart(site.barriers)
    })

    let barrierOffset = $derived.by(() => {
        return calculateBarrierOffset(site.barriers)
    })

    const sneakyBuildings: boolean = $derived.by(() => {
        const config = gameSession.game.config
        if (!config) {
            return false
        }
        return (config as EstatesGameConfig).sneakyBuildings ?? false
    })
    onDestroy(() => {
        gameSession.removeGameStateChangeListener(onGameStateChange)
        bloomer.dispose()
    })
</script>

<T.Group position.x={x} position.y={y} position.z={z} scale={1}>
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
        <T.PlaneGeometry args={[1, 1]} />
        <T is={PulsingMaterial} args={[invalidate, 0.4]} active={canPreview} />
    </T.Mesh>
    <!-- This mesh is used to make pointer enter/leave more simple -->
    {#if canPreview}
        <T.Mesh
            depthOffset={5}
            position.y={height / 2 - 0.5}
            onpointerenter={onPointerEnter}
            onpointerleave={onPointerLeave}
            onclick={onClick}
        >
            <T.BoxGeometry args={[dims, height, dims]} />
            <T.MeshBasicMaterial color="white" transparent={true} opacity={0} />
        </T.Mesh>
    {/if}
    {#each visibleCubes as cube, i (placementPieceKey(cube))}
        <Cube3d
            {cube}
            scale={i < placedCubes.length ? 1 : $scale}
            oncreate={(ref: Object3D) => {
                cubeObjects.push(ref)

                if (gameSession.isViewingHistory) {
                    ref.scale.x = 0.1
                    ref.scale.y = 0.1
                    ref.scale.z = 0.1
                    scaleIn({ onUpdate: invalidate, object: ref, duration: 0.1, startAt: 0 })
                }
                return () => {
                    remove(cubeObjects, ref)
                }
            }}
            singleNumber={sneakyBuildings}
            position.x={0}
            position.z={0}
            position.y={i}
            rotation.y={sneakyBuildings && gameSession.mobileView ? -Math.PI / 2 : 0}
            rotation.z={!sneakyBuildings && gameSession.mobileView ? -Math.PI / 2 : 0}
        />
    {/each}
    {#if visibleRoof}
        <Roof3d
            roof={visibleRoof}
            scale={placedRoof ? 1 : $scale}
            transparent={!placedRoof}
            opacity={placedRoof ? 1 : 0.6}
            oncreate={(ref: Object3D) => {
                roofObject = ref

                if (gameSession.isViewingHistory) {
                    ref.scale.x = 0.1
                    ref.scale.y = 0.1
                    ref.scale.z = 0.1
                    scaleIn({ onUpdate: invalidate, object: ref, duration: 0.1, startAt: 0 })
                }
                return () => {
                    roofObject = undefined
                }
            }}
            position.x={0}
            position.z={0}
            position.y={site.cubes.length - 0.305}
            rotation.y={gameSession.mobileView ? -Math.PI / 2 : 0}
        />
    {/if}
    {#each visibleBarriers as barrier, i (placementPieceKey(barrier))}
        <Barrier3d
            oncreate={(ref: Object3D) => {
                barrierObjects.set(barrier.value, ref)
                return () => {
                    barrierObjects.delete(barrier.value)
                }
            }}
            stripes={barrier.value}
            scale={i < placedBarriers.length ? 1 : $scale}
            transparent={i >= placedBarriers.length}
            opacity={i < placedBarriers.length ? 1 : 0.6}
            onpointerenter={i < site.barriers.length
                ? (event: any) => enterBarrier(event, barrier)
                : undefined}
            onpointerleave={i < site.barriers.length ? leavePiece : undefined}
            onclick={i < site.barriers.length
                ? (event: any) => onBarrierClick(event, barrier)
                : undefined}
            position.x={i < site.barriers.length ? barrierStart + i * barrierOffset : 0}
            z={0}
            position.y={0}
        />
    {/each}
</T.Group>
