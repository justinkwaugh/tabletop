<script lang="ts">
    import { T, type Props } from '@threlte/core'
    import {
        BarrierDirection,
        Cube,
        EstatesGameState,
        isRoof,
        MachineState,
        PieceType
    } from '@tabletop/estates'
    import { Object3D, Group } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Cube3d from './Cube3d.svelte'
    import { OffsetCoordinates, sameCoordinates } from '@tabletop/common'
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

    const wood = useTexture(woodImg)

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ...others }: Props<typeof Group> = $props()

    const effects = getContext('effects') as Effects
    const outliner = new Outliner(effects)
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
            fadeUp(obj, 2, () => {
                gameSession.startAuction(cube)
                chosenCube = undefined
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

        setTimeout(() => {
            fadeUp(obj, 2, () => {
                gameSession.startAuction({ pieceType: PieceType.Mayor })
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
        setTimeout(() => {
            fadeUp(obj, 2, () => {
                gameSession.startAuction({
                    pieceType: PieceType.CancelCube
                })
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

        setTimeout(() => {
            fadeUp(obj, 2, () => {
                gameSession.startAuction({
                    pieceType: PieceType.Barrier,
                    value,
                    direction: BarrierDirection.Unplaced
                })
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

        // Make a listener for the game state update
        const listener = async (to: EstatesGameState) => {
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

    function fadeUp(object: Object3D, height: number, onComplete: () => void) {
        const timeline = gsap.timeline({
            onComplete
        })
        timeline.to(object.position, {
            duration: 0.2,
            y: height
        })

        fadeOut({ object, duration: 0.2, startAt: 0, timeline })
        timeline.play()
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
        outliner.findAndOutline(event.object, parentName)
    }

    function leavePiece(event: any, parentName?: string) {
        outliner.removeOutline(event.object, parentName)
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
            event.stopPropagation()
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
                color={'#cccccc'}
                clearcoat={1}
                clearcoatRoughness={0.33}
            />
        </T.Mesh>
        {#each gameSession.gameState.roofs.items as _, i}
            {#if gameSession.gameState.visibleRoofs[i]}
                <Roof
                    roof={{ pieceType: PieceType.Roof, value: -1 }}
                    onloaded={(ref: Object3D) => {
                        hideInstant(ref)
                        fadeIn({ object: ref, duration: 0.1 })
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

        {#each gameSession.gameState.cubes as cubeRow, row}
            <div class="flex items-center gap-x-1">
                {#each cubeRow as cube, col}
                    {#if cube}
                        <Cube3d
                            {cube}
                            oncreate={(ref: Object3D) => {
                                hideInstant(ref)
                                fadeIn({ object: ref, duration: 0.1 })
                            }}
                            onpointerenter={(event: any) => {
                                onEnterCube(event, { row, col })
                            }}
                            onpointerleave={(event: any) => {
                                onLeaveCube(event, { row, col })
                            }}
                            onclick={(event: any) => onCubeClick(event, cube, { row, col })}
                            rotation.x={-Math.PI / 2}
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
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
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
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
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
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
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
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
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
                    hideInstant(ref)
                    fadeIn({ object: ref, duration: 0.1 })
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
