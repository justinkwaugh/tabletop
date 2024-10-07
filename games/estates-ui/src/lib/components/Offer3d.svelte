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

    let gameSession = getContext('gameSession') as EstatesGameSession

    let { ...others }: Props<typeof Group> = $props()

    const effects = getContext('effects') as Effects

    let canPlace = $derived(
        gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.StartOfTurn
    )

    let placeableCubes = $derived(gameSession.gameState.placeableCubes())
    let yPos = spring(0)
    let opacity = spring(0)

    let hoverMayor: boolean = $state(false)
    let hoverCancelCube: boolean = $state(false)

    let allowRoofInteraction = $state(true)
    let canHoverRoof: boolean = $derived(canPlace && allowRoofInteraction)

    function onPointerEnter(event: PointerEvent) {
        if (!canPlace) {
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
        event.stopPropagation()
        chooseCube(event.object, cube, coords)
    }

    function chooseCube(obj: Object3D, cube: Cube | null | undefined, coords: OffsetCoordinates) {
        if (!cube || !canPlace || !placeableCubes.find((c) => sameCoordinates(c, coords))) {
            return
        }
        yPos.set(0)

        if (!obj.parent) {
            return
        }

        fadeUp(obj.parent, () => {
            gameSession.startAuction(cube)
        })
    }

    function onMayorClick(event: any) {
        event.stopPropagation()
        chooseMayor(event.object.parent)
    }

    function chooseMayor(obj: Object3D) {
        if (!canPlace) {
            return
        }
        hoverMayor = false
        setTimeout(() => {
            fadeUp(obj, () => {
                gameSession.startAuction({ pieceType: PieceType.Mayor })
            })
        }, 1)
    }

    function onCancelCubeClick(event: any) {
        if (!canPlace) {
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
            fadeUp(obj, () => {
                gameSession.startAuction({
                    pieceType: PieceType.CancelCube
                })
            })
        }, 1)
    }

    function onBarrierClick(event: any, value: number) {
        if (!canPlace) {
            return
        }
        event.stopPropagation()
        chooseBarrier(event.object, value)
    }

    function chooseBarrier(obj: Object3D, value: number) {
        const mesh = obj.getObjectByName('outlinerMesh')
        if (mesh) {
            effects.outline?.selection.delete(mesh)
        }

        setTimeout(() => {
            fadeUp(obj, () => {
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
        if (!canPlace || !allowRoofInteraction) {
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
        const mesh = obj.getObjectByName('roofMesh')
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

    function fadeUp(object: Object3D, onComplete: () => void) {
        const timeline = gsap.timeline({
            onComplete
        })
        timeline.to(object.position, {
            duration: 0.2,
            y: 0.7
        })

        object.traverse((object) => {
            if ((object as Mesh).material as MeshStandardMaterial) {
                const material = (object as Mesh).material as MeshStandardMaterial
                material.transparent = true
                material.needsUpdate = true
                timeline.to(
                    material,
                    {
                        duration: 0.2,
                        opacity: 0
                    },
                    0
                )
            }
        })
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

        object.traverse((object) => {
            if ((object as Mesh).material as MeshStandardMaterial) {
                const material = (object as Mesh).material as MeshStandardMaterial
                material.transparent = true
                material.needsUpdate = true
                timeline.to(
                    material,
                    {
                        duration: 0.2,
                        opacity: 0
                    },
                    0.3
                )
            }
        })
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

    function enterRoof(event: any) {
        if (!canHoverRoof) {
            return
        }
        const roof = findParentByName(event.object, 'roof')
        const mesh = roof?.getObjectByName('roofMesh')
        if (mesh) {
            event.stopPropagation()
            effects.outline?.selection.add(mesh)
        }
    }

    function leaveRoof(event: any) {
        const roof = findParentByName(event.object, 'roof')
        const mesh = roof?.getObjectByName('roofMesh')
        if (mesh) {
            event.stopPropagation()
            effects.outline?.selection.delete(mesh)
        }
    }

    function enterPiece(event: any) {
        if (!canPlace) {
            return
        }

        event.stopPropagation()
        const mesh = event.object?.getObjectByName('outlineMesh')
        if (mesh) {
            event.stopPropagation()
            effects.outline?.selection.add(mesh)
        }
    }

    function leavePiece(event: any) {
        const mesh = event.object?.getObjectByName('outlineMesh')
        if (mesh) {
            event.stopPropagation()
            effects.outline?.selection.delete(mesh)
        }
    }
</script>

<T.Group {...others}>
    <T.Mesh
        oncreate={(ref) => {
            ref.geometry.center()
        }}
        onpointerenter={onPointerEnter}
        onpointerleave={onPointerLeave}
        receiveShadow
    >
        <T.BoxGeometry args={[19, 0.2, 4.5]} />
        <T.MeshStandardMaterial color="#444444" />
    </T.Mesh>

    {#each gameSession.gameState.roofs.items as _, i}
        {#if gameSession.gameState.visibleRoofs[i]}
            <Roof
                roof={{ pieceType: PieceType.Roof, value: -1 }}
                onpointerenter={enterRoof}
                onpointerleave={leaveRoof}
                onclick={(event: any) => {
                    onRoofClick(event, i)
                }}
                rotation.z={Math.PI}
                position={[-8.5 + (i % 4) * 1.2, 0.31, -1.2 + Math.floor(i / 4) * 1.2]}
            />
        {/if}
    {/each}

    {#each gameSession.gameState.cubes as cubeRow, row}
        <div class="flex items-center gap-x-1">
            {#each cubeRow as cube, col}
                {#if cube}
                    <Cube3d
                        {cube}
                        castShadow={true}
                        onclick={(event: any) => onCubeClick(event, cube, { row, col })}
                        rotation.x={-Math.PI / 2}
                        position.x={-3.5 + col}
                        position.y={!canPlace ||
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
        <Barrier
            onpointerenter={enterPiece}
            onpointerleave={leavePiece}
            onclick={(event: any) => {
                onBarrierClick(event, 1)
            }}
            position.x={5.5}
            position.y={0.3}
            position.z={-1}
        />
    {/if}
    {#if gameSession.gameState.barrierTwo}
        <Barrier
            onpointerenter={enterPiece}
            onpointerleave={leavePiece}
            onclick={(event: any) => {
                onBarrierClick(event, 2)
            }}
            position.x={5.5}
            position.y={0.3}
            position.z={0}
        />
    {/if}
    {#if gameSession.gameState.barrierThree}
        <Barrier
            onpointerenter={enterPiece}
            onpointerleave={leavePiece}
            onclick={(event: any) => {
                onBarrierClick(event, 3)
            }}
            position.x={5.5}
            position.y={0.3}
            position.z={1}
        />
    {/if}
    {#if gameSession.gameState.mayor}
        <TopHat
            onpointerenter={enterPiece}
            onpointerleave={leavePiece}
            onclick={onMayorClick}
            scale={0.5}
            position.x={8}
            position.y={1}
            position.z={-1}
            transparent={true}
            opacity={$opacity}
        />
    {/if}
    {#if gameSession.gameState.cancelCube}
        <CancelCube
            onpointerenter={enterPiece}
            onpointerleave={leavePiece}
            onclick={onCancelCubeClick}
            position.x={8}
            position.y={0.3}
            position.z={1}
            rotation.x={-Math.PI / 2}
        />
    {/if}
</T.Group>
