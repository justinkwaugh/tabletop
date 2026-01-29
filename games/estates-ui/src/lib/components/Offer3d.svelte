<script lang="ts">
    /* eslint-disable svelte/prefer-svelte-reactivity */
    import { T, type Props } from '@threlte/core'
    import {
        BarrierDirection,
        Cube,
        EstatesGameState,
        HydratedEstatesGameState,
        isMayor,
        isRoof,
        MachineState,
        PieceType
    } from '@tabletop/estates'
    import { Object3D, Group } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Cube3d from './Cube3d.svelte'
    import {
        coordinatesToNumber,
        GameAction,
        OffsetCoordinates,
        sameCoordinates
    } from '@tabletop/common'
    import { spring } from 'svelte/motion'
    import CancelCube from './CancelCube.svelte'
    import { gsap } from 'gsap'
    import Roof from './Roof3d.svelte'
    import type { Effects } from '$lib/model/Effects.svelte'
    import woodImg from '$lib/images/wood.jpg'
    import { useTexture } from '@threlte/extras'
    import BarrierOne from '$lib/3d/BarrierOne.svelte'
    import { Outliner } from '$lib/utils/outliner'
    import { fadeIn, fadeOut, hideInstant } from '$lib/utils/animations'
    import { Bloomer } from '$lib/utils/bloomer'
    import { AnimationContext, GameSessionMode } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const wood = useTexture(woodImg)

    let gameSession = getGameSession() as EstatesGameSession

    let { ...others }: Props<typeof Group> = $props()

    const effects = getContext('effects') as Effects
    const outliner = new Outliner(effects)
    const bloomer = new Bloomer(effects)
    let enterCounter = 0
    let unHoverCubeTimer: ReturnType<typeof setTimeout> | undefined

    let canChoose = $derived(
        gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.StartOfTurn
    )

    let placeableCubes = $derived(gameSession.gameState.placeableCubes())
    let yPos = spring(0)

    let canChooseRoof: boolean = $derived(
        canChoose && gameSession.gameState.board.validRoofLocations().length > 0
    )
    let chosenCube: OffsetCoordinates | undefined = $state()
    let canChooseCube: boolean = $derived(canChoose && !chosenCube)

    let allowRoofInteraction = $state(true)
    let canHoverRoof: boolean = $derived(canChooseRoof && allowRoofInteraction)

    let mayorObject: Object3D | undefined
    let barrierOneObject: Object3D | undefined
    let barrierTwoObject: Object3D | undefined
    let barrierThreeObject: Object3D | undefined
    let cancelCubeObject: Object3D | undefined

    let cubeObjects: Map<number, Object3D> = new Map()
    let roofObjects: (Object3D | undefined)[] = new Array(12)

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
        if (!gameSession.isViewingHistory) {
            return
        }

        for (const [rowIndex, row] of gameSession.gameState.cubes.entries()) {
            for (const [colIndex, cube] of row.entries()) {
                if (cube && !to.cubes[rowIndex][colIndex]) {
                    const id = coordinatesToNumber({ row: rowIndex, col: colIndex })
                    const cubeObject = cubeObjects.get(id)
                    if (cubeObject) {
                        fadeUp({
                            object: cubeObject,
                            height: 2,
                            timeline: animationContext.actionTimeline
                        })
                    }
                }
            }
        }

        for (const [index, roof] of gameSession.gameState.visibleRoofs.entries()) {
            if (roof && !to.visibleRoofs[index]) {
                const roofObject = roofObjects[index]
                if (roofObject) {
                    fadeUp({
                        object: roofObject,
                        height: 2,
                        timeline: animationContext.actionTimeline
                    })
                }
            }
        }

        if (gameSession.gameState.mayor && !to.mayor && mayorObject) {
            fadeUp({ object: mayorObject, height: 2, timeline: animationContext.actionTimeline })
        }

        if (gameSession.gameState.barrierOne && !to.barrierOne && barrierOneObject) {
            fadeUp({
                object: barrierOneObject,
                height: 2,
                timeline: animationContext.actionTimeline
            })
        }

        if (gameSession.gameState.barrierTwo && !to.barrierTwo && barrierTwoObject) {
            fadeUp({
                object: barrierTwoObject,
                height: 2,
                timeline: animationContext.actionTimeline
            })
        }

        if (gameSession.gameState.barrierThree && !to.barrierThree && barrierThreeObject) {
            fadeUp({
                object: barrierThreeObject,
                height: 2,
                timeline: animationContext.actionTimeline
            })
        }

        if (gameSession.gameState.cancelCube && !to.cancelCube && cancelCubeObject) {
            fadeUp({
                object: cancelCubeObject,
                height: 2,
                timeline: animationContext.actionTimeline
            })
        }
    }

    gameSession.addGameStateChangeListener(onGameStateChange)

    function onCubeClick(event: any, cube: Cube, coords: OffsetCoordinates) {
        if (!canChoose || !placeableCubes.find((c) => sameCoordinates(c, coords))) {
            return
        }
        event.stopPropagation()
        const cubeModel = findParentByName(event.object, 'cube')
        if (cubeModel) {
            onLeaveCube(event, coords)
            chooseCube(cubeModel, cube, coords)
        }
    }

    function chooseCube(obj: Object3D, cube: Cube, coords: OffsetCoordinates) {
        chosenCube = coords
        yPos.set(0)

        setTimeout(() => {
            fadeUp({
                object: obj,
                height: 2,
                onComplete: () => {
                    gameSession.startAuction(cube)
                    chosenCube = undefined
                }
            })
        }, 1)
    }

    function onMayorClick(event: any) {
        if (!canChoose) {
            return
        }
        event.stopPropagation()
        chooseMayor(event.object.parent)
    }

    function chooseMayor(obj: Object3D) {
        outliner.removeOutline(obj)
        bloomer.removeBloom(obj)

        setTimeout(() => {
            fadeUp({
                object: obj,
                height: 2,
                onComplete: () => {
                    gameSession.startAuction({ pieceType: PieceType.Mayor })
                }
            })
        }, 1)
    }

    function onCancelCubeClick(event: any) {
        if (!canChoose) {
            return
        }
        event.stopPropagation()
        chooseCancelCube(event.object.parent)
    }

    function chooseCancelCube(obj: Object3D) {
        outliner.removeOutline(obj)
        bloomer.removeBloom(obj)
        setTimeout(() => {
            fadeUp({
                object: obj,
                height: 2,
                onComplete: () => {
                    gameSession.startAuction({
                        pieceType: PieceType.CancelCube
                    })
                }
            })
        }, 1)
    }

    function onBarrierClick(event: any, value: number) {
        if (!canChoose) {
            return
        }
        event.stopPropagation()
        const barrier = findParentByName(event.object, 'barrier')
        if (barrier) {
            chooseBarrier(barrier, value)
        }
    }

    function chooseBarrier(obj: Object3D, value: number) {
        outliner.removeOutline(obj)
        bloomer.removeBloom(obj)
        setTimeout(() => {
            fadeUp({
                object: obj,
                height: 2,
                onComplete: () => {
                    gameSession.startAuction({
                        pieceType: PieceType.Barrier,
                        value,
                        direction: BarrierDirection.Unplaced
                    })
                }
            })
        }, 1)
    }

    function onRoofClick(event: any, index: number) {
        event.stopPropagation()
        if (!canChooseRoof || !allowRoofInteraction) {
            return
        }
        const roof = findParentByName(event.object, 'roof')
        if (roof) {
            chooseRoof(roof, index)
        }
    }

    // This method is the most complicated of the bunch because it deals with hidden info.
    // The actual roof value is not determined until the server has been called, so we need to
    // wait for the server response, and the state to be ready for update before we trigger the animation
    // which will reveal the roof value.  We also need to wait until the animation is done before we
    // allow the state to be updated so that we don't overlap animations.
    async function chooseRoof(obj: Object3D, index: number) {
        allowRoofInteraction = false
        outliner.removeOutline(obj)
        bloomer.removeBloom(obj)
        // Make a listener for the game state update
        const listener = async ({
            to,
            from,
            action,
            animationContext
        }: {
            to: EstatesGameState
            from?: EstatesGameState
            action?: GameAction
            animationContext: AnimationContext
        }) => {
            gameSession.removeGameStateChangeListener(listener)

            if (to.machineState === MachineState.Auctioning && isRoof(to.chosenPiece)) {
                // set the roof text to the chosen value
                const textObj = obj.getObjectByName('roofText') as any
                if (textObj) {
                    textObj.text = to.chosenPiece.value
                }

                // Wait for the animation to finish before allowing the state to update
                await new Promise<void>((resolve) => {
                    setTimeout(() => {
                        flipAndFadeUp(obj, () => {
                            allowRoofInteraction = true
                            resolve()
                        })
                    })
                })
            }
        }
        gameSession.addGameStateChangeListener(listener)

        // Kick off the action
        await gameSession.drawRoof(index)
    }

    function fadeUp({
        object,
        height,
        onComplete,
        timeline
    }: {
        object: Object3D
        height: number
        onComplete?: () => void
        timeline?: gsap.core.Timeline
    }) {
        const myTimeline =
            timeline ??
            gsap.timeline({
                onComplete
            })
        myTimeline.to(
            object.position,
            {
                duration: 0.2,
                y: height
            },
            0
        )

        fadeOut({ object, duration: 0.2, startAt: 0, timeline: myTimeline })
        if (!timeline) {
            myTimeline.play()
        }
    }

    function flipAndFadeUp(object: Object3D, onComplete: () => void) {
        const timeline = gsap.timeline({
            onComplete
        })
        timeline.to(object.rotation, {
            duration: 0.2,
            z: 0
        })
        timeline.to(
            object.position,
            {
                duration: 0.5,
                y: 2
            },
            0
        )

        fadeOut({ object, duration: 0.2, startAt: 0.3, timeline })
        timeline.play()
    }

    function findParentByName(obj: Object3D, name: string) {
        if (obj.name === name) {
            return obj
        }
        while (obj.parent) {
            if (obj.parent.name === name) {
                return obj.parent
            }
            obj = obj.parent
        }
        return undefined
    }

    function enterPiece(event: any, parentName?: string) {
        if (!canChoose) {
            return
        }

        event.stopPropagation()
        if (parentName === 'topHat') {
            outliner.findAndOutline(event.object, parentName)
        }
        bloomer.addBloom(event.object, parentName)
    }

    function leavePiece(event: any, parentName?: string) {
        outliner.removeOutline(event.object, parentName)
        bloomer.removeBloom(event.object, parentName)
    }

    function enterRoof(event: any) {
        if (!canHoverRoof) {
            return
        }

        enterPiece(event, 'roof')
    }

    function onEnterCube(event: any, coords: OffsetCoordinates) {
        event.stopPropagation()
        if (canChooseCube && placeableCubes.find((c) => sameCoordinates(c, coords))) {
            enterPiece(event, 'cube')
        }

        enterCounter++
        clearTimeout(unHoverCubeTimer)
        unHoverCubeTimer = undefined
        yPos.set(0.5)
    }

    function onLeaveCube(event: any, coords: OffsetCoordinates) {
        event.stopPropagation()
        if (placeableCubes.find((c) => sameCoordinates(c, coords))) {
            leavePiece(event, 'cube')
        }

        enterCounter--
        if (enterCounter > 0) {
            return
        }
        unHoverCubeTimer = setTimeout(() => {
            yPos.set(0)
        }, 100)
    }
</script>

{#await wood then woodValue}
    <T.Group {...others}>
        <T.Mesh
            oncreate={(ref) => {
                ref.geometry.center()
            }}
            receiveShadow
        >
            <T.BoxGeometry args={[19.5, 0.2, 4.5]} />
            <T.MeshPhysicalMaterial
                map={woodValue}
                roughness={0.3}
                color="#cccccc"
                clearcoat={1}
                clearcoatRoughness={0.33}
            />
        </T.Mesh>
        {#each gameSession.gameState.roofs.items as _, i (i)}
            {#if gameSession.gameState.visibleRoofs[i]}
                <Roof
                    roof={{ pieceType: PieceType.Roof, value: -1 }}
                    onloaded={(ref: Object3D) => {
                        roofObjects[i] = ref
                        hideInstant(ref)
                        fadeIn({ object: ref, duration: 0.1 })
                        return () => {
                            roofObjects[i] = undefined
                        }
                    }}
                    onpointerenter={(event: any) => enterRoof(event)}
                    onpointerleave={(event: any) => leavePiece(event, 'roof')}
                    onclick={(event: any) => {
                        onRoofClick(event, i)
                    }}
                    rotation.z={Math.PI}
                    position={[-8.25 + (i % 4) * 1.2, 0.31, -1.2 + Math.floor(i / 4) * 1.2]}
                />
            {/if}
        {/each}

        {#each gameSession.gameState.cubes as cubeRow, row (row)}
            <div class="flex items-center gap-x-1">
                {#each cubeRow as cube, col (col)}
                    {#if cube}
                        <Cube3d
                            {cube}
                            oncreate={(ref: Object3D) => {
                                const id = coordinatesToNumber({ row, col })
                                cubeObjects.set(id, ref)
                                hideInstant(ref)
                                fadeIn({ object: ref, duration: 0.1 })
                                return () => {
                                    cubeObjects.delete(id)
                                }
                            }}
                            onpointerenter={(event: any) => {
                                onEnterCube(event, { row, col })
                            }}
                            onpointerleave={(event: any) => {
                                onLeaveCube(event, { row, col })
                            }}
                            singleNumber={true}
                            onclick={(event: any) => onCubeClick(event, cube, { row, col })}
                            position.x={-2.75 + col}
                            position.y={sameCoordinates(chosenCube, { row, col })
                                ? 0.5
                                : !canChoose ||
                                    !placeableCubes.find((c) => sameCoordinates(c, { row, col }))
                                  ? 0
                                  : $yPos}
                            position.z={-1 + row}
                        />
                    {/if}
                {/each}
            </div>
        {/each}

        {#if gameSession.gameState.barrierOne}
            <BarrierOne
                onloaded={(ref: Object3D) => {
                    barrierOneObject = ref
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
                    return () => {
                        barrierOneObject = undefined
                    }
                }}
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 1)
                }}
                stripes={1}
                position.x={6.25}
                position.y={0.7}
                position.z={1}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.barrierTwo}
            <BarrierOne
                onloaded={(ref: Object3D) => {
                    barrierTwoObject = ref
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
                    return () => {
                        barrierTwoObject = undefined
                    }
                }}
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 2)
                }}
                stripes={2}
                position.x={6.25}
                position.y={0.7}
                position.z={0}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.barrierThree}
            <BarrierOne
                onloaded={(ref: Object3D) => {
                    barrierThreeObject = ref
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
                    return () => {
                        barrierThreeObject = undefined
                    }
                }}
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 3)
                }}
                stripes={3}
                position.x={6.25}
                position.y={0.7}
                position.z={-1}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.mayor}
            <TopHat
                onloaded={(ref: Object3D) => {
                    mayorObject = ref
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
                    return () => {
                        mayorObject = undefined
                    }
                }}
                onpointerenter={(event: any) => enterPiece(event, 'topHat')}
                onpointerleave={(event: any) => leavePiece(event, 'topHat')}
                onclick={onMayorClick}
                scale={0.5}
                position.x={8.25}
                position.y={1}
                position.z={-0.8}
            />
        {/if}
        {#if gameSession.gameState.cancelCube}
            <CancelCube
                oncreate={(ref: Object3D) => {
                    cancelCubeObject = ref
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
                    return () => {
                        cancelCubeObject = undefined
                    }
                }}
                onpointerenter={(event: any) => enterPiece(event, 'cancelCube')}
                onpointerleave={(event: any) => leavePiece(event, 'cancelCube')}
                onclick={onCancelCubeClick}
                position.x={8.05}
                position.y={0.3}
                position.z={1}
                rotation.x={-Math.PI / 2}
            />
        {/if}
    </T.Group>
{/await}
