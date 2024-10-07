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
    import { Mesh, Object3D, MeshStandardMaterial, Group } from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Barrier from '$lib/3d/Barrier.svelte'
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

    const wood = useTexture(woodImg)

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ...others }: Props<typeof Group> = $props()

    const effects = getContext('effects') as Effects

    let canChoose = $derived(
        gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.StartOfTurn
    )

    let placeableCubes = $derived(gameSession.gameState.placeableCubes())
    let yPos = spring(0)
    let opacity = spring(0)

    let allowRoofInteraction = $state(true)
    let canChooseRoof: boolean = $derived(
        canChoose && gameSession.gameState.board.validRoofLocations().length > 0
    )
    let canHoverRoof: boolean = $derived(canChooseRoof && allowRoofInteraction)

    function onPointerEnter(event: PointerEvent) {
        if (!canChoose) {
            return
        }

        event.stopPropagation()
        yPos.set(0.5)
    }

    function onPointerLeave(event: PointerEvent) {
        event.stopPropagation()
        yPos.set(0)
    }

    function onCubeClick(event: any, cube: Cube, coords: OffsetCoordinates) {
        if (!canChoose || !placeableCubes.find((c) => sameCoordinates(c, coords))) {
            return
        }
        event.stopPropagation()
        const cubeModel = findParentByName(event.object, 'cube')
        if (cubeModel) {
            chooseCube(cubeModel, cube, coords)
        }
    }

    function chooseCube(obj: Object3D, cube: Cube, coords: OffsetCoordinates) {
        yPos.set(0)
        setTimeout(() => {
            fadeUp(obj, 0.7, () => {
                gameSession.startAuction(cube)
            })
        }, 1)
    }

    function onMayorClick(event: any) {
        event.stopPropagation()
        chooseMayor(event.object.parent)
    }

    function chooseMayor(obj: Object3D) {
        if (!canChoose) {
            return
        }

        const mesh = obj.getObjectByName('outlineMesh')
        if (mesh) {
            effects.outline?.selection.delete(mesh)
        }

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
        const mesh = obj.getObjectByName('outlineMesh')
        if (mesh) {
            effects.outline?.selection.delete(mesh)
        }
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
        const mesh = obj.getObjectByName('outlineMesh')
        if (mesh) {
            effects.outline?.selection.delete(mesh)
        }

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
        if (!canChoose || !allowRoofInteraction) {
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
        const mesh = obj.getObjectByName('outlineMesh')
        if (mesh) {
            effects.outline?.selection.delete(mesh)
        }

        // Make a listener for the game state update
        const listener = async (from: EstatesGameState, to: EstatesGameState) => {
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

    $effect(() => {
        if (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.StartOfTurn
        ) {
            console.log('Changing opacity to full')
            opacity.set(1)
        } else {
            console.log('Changing opacity to none')
            opacity.set(0)
        }
    })

    function fadeUp(object: Object3D, height: number, onComplete: () => void) {
        const timeline = gsap.timeline({
            onComplete
        })
        timeline.to(object.position, {
            duration: 0.2,
            y: height
        })

        fade(object, 0.2, 0, 0, timeline)
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

        fade(object, 0.2, 0, 0.3, timeline)
        timeline.play()
    }

    function fade(
        object: Object3D,
        duration: number,
        opacity: number,
        start: number,
        timeline: gsap.core.Timeline
    ) {
        object.traverse((object) => {
            if ((object as Mesh).material as MeshStandardMaterial) {
                const material = (object as Mesh).material as MeshStandardMaterial
                material.transparent = true
                material.needsUpdate = true
                timeline.to(
                    material,
                    {
                        duration,
                        opacity
                    },
                    start
                )
            }
        })
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

    function findParent(obj: Object3D, parent: Object3D) {
        if (obj === parent) {
            return obj
        }
        while (obj.parent) {
            if (obj.parent === parent) {
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

        let obj = parentName ? findParentByName(event.object, parentName) : event.object
        const mesh = obj?.getObjectByName('outlineMesh')
        if (mesh) {
            event.stopPropagation()
            effects.outline?.selection.add(mesh)
        }
    }

    function leavePiece(event: any, parentName?: string) {
        let obj = parentName ? findParentByName(event.object, parentName) : event.object
        const mesh = obj.getObjectByName('outlineMesh')
        if (mesh && !event.intersections.find((i: any) => findParent(i.object, obj))) {
            event.stopPropagation()
            effects.outline?.selection.delete(mesh)
        }
    }

    function enterRoof(event: any, parentName?: string) {
        if (!canHoverRoof) {
            return
        }
        enterPiece(event, parentName)
    }
</script>

{#await wood then woodValue}
    <T.Group {...others}>
        <T.Mesh
            oncreate={(ref) => {
                ref.geometry.center()
            }}
            onpointerenter={onPointerEnter}
            onpointerleave={onPointerLeave}
            receiveShadow
        >
            <T.BoxGeometry args={[19.5, 0.2, 4.5]} />
            <T.MeshPhysicalMaterial
                map={woodValue}
                roughness={0.3}
                color={'#cccccc'}
                transparent={true}
                opacity={1}
                clearcoat={1}
                clearcoatRoughness={0.33}
            />
        </T.Mesh>
        <!-- <T.Mesh position.y={-0.1} rotation.x={-Math.PI / 2}>
            <T.PlaneGeometry args={[19, 4.5]} />
            <T.MeshStandardMaterial map={woodValue} />
        </T.Mesh> -->
        {#each gameSession.gameState.roofs.items as _, i}
            {#if gameSession.gameState.visibleRoofs[i]}
                <Roof
                    roof={{ pieceType: PieceType.Roof, value: -1 }}
                    onpointerenter={(event: any) => enterRoof(event, 'roof')}
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
                            onclick={(event: any) => onCubeClick(event, cube, { row, col })}
                            rotation.x={-Math.PI / 2}
                            position.x={-2.75 + col}
                            position.y={!canChoose ||
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
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 1)
                }}
                stripes={1}
                position.x={6.25}
                position.y={0.5}
                position.z={1}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.barrierTwo}
            <BarrierOne
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 2)
                }}
                stripes={2}
                position.x={6.25}
                position.y={0.5}
                position.z={0}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.barrierThree}
            <BarrierOne
                onpointerenter={(event: any) => enterPiece(event, 'barrier')}
                onpointerleave={(event: any) => leavePiece(event, 'barrier')}
                onclick={(event: any) => {
                    onBarrierClick(event, 3)
                }}
                stripes={3}
                position.x={6.25}
                position.y={0.5}
                position.z={-1}
                rotation.y={Math.PI / 2}
            />
        {/if}
        {#if gameSession.gameState.mayor}
            <TopHat
                onpointerenter={(event: any) => enterPiece(event, 'topHat')}
                onpointerleave={(event: any) => leavePiece(event, 'topHat')}
                onclick={onMayorClick}
                scale={0.5}
                position.x={8.25}
                position.y={1}
                position.z={-0.8}
                transparent={true}
                opacity={$opacity}
            />
        {/if}
        {#if gameSession.gameState.cancelCube}
            <CancelCube
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
