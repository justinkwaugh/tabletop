<script lang="ts">
    import { T } from '@threlte/core'
    import { Text, RoundedBoxGeometry } from '@threlte/extras'
    import { Cube, isCube, MachineState, PieceType } from '@tabletop/estates'
    import * as THREE from 'three'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Barrier from '$lib/3d/Barrier.svelte'
    import Cube3d from './Cube3d.svelte'
    import { OffsetCoordinates, sameCoordinates } from '@tabletop/common'
    import { spring } from 'svelte/motion'
    import CancelCube from './CancelCube.svelte'
    import { gsap } from 'gsap'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let { ...others }: {} = $props()

    let canPlace = $derived(
        gameSession.isMyTurn && gameSession.gameState.machineState === MachineState.StartOfTurn
    )

    let placeableCubes = $derived(gameSession.gameState.placeableCubes())
    let yPos = spring(-0.7)
    let opacity = spring(0)

    let hoverMayor: boolean = $state(false)
    let hoverBarrierOne: boolean = $state(false)
    let hoverBarrierTwo: boolean = $state(false)
    let hoverBarrierThree: boolean = $state(false)
    let hoverCancelCube: boolean = $state(false)

    function onPointerEnter(event: PointerEvent) {
        if (!canPlace) {
            return
        }

        event.stopPropagation()
        yPos.set(-0.3)
    }

    function onPointerLeave(event: PointerEvent) {
        event.stopPropagation()
        yPos.set(-0.7)
    }

    function onCubeClick(event: any, cube: Cube, coords: OffsetCoordinates) {
        event.stopPropagation()
        chooseCube(event.object, cube, coords)
    }

    function chooseCube(
        obj: THREE.Object3D,
        cube: Cube | null | undefined,
        coords: OffsetCoordinates
    ) {
        if (!cube || !canPlace || !placeableCubes.find((c) => sameCoordinates(c, coords))) {
            return
        }
        yPos.set(-0.7)
        fadeUp(obj.parent, () => {
            const action = gameSession.createStartAuctionAction(cube)
            gameSession.applyAction(action)
            gameSession.resetAction()
        })
    }

    function onMayorClick(event: any) {
        event.stopPropagation()
        chooseMayor(event.object.parent)
    }

    function chooseMayor(obj: THREE.Object3D) {
        if (!canPlace) {
            return
        }
        hoverMayor = false
        setTimeout(() => {
            fadeUp(obj, () => {
                const action = gameSession.createStartAuctionAction({ pieceType: PieceType.Mayor })
                gameSession.applyAction(action)
                gameSession.resetAction()
            })
        }, 1)
    }

    function onCancelCubeClick(event: any) {
        event.stopPropagation()
        chooseCancelCube(event.object.parent)
    }

    function chooseCancelCube(obj: THREE.Object3D) {
        if (!canPlace) {
            return
        }
        hoverCancelCube = false
        setTimeout(() => {
            fadeUp(obj, () => {
                const action = gameSession.createStartAuctionAction({
                    pieceType: PieceType.CancelCube
                })
                gameSession.applyAction(action)
                gameSession.resetAction()
            })
        }, 1)
    }

    function onBarrierClick(event: any, value: number) {
        event.stopPropagation()
        chooseBarrier(event.object, value)
    }

    function chooseBarrier(obj: THREE.Object3D, value: number) {
        if (!canPlace) {
            return
        }

        switch (value) {
            case 1:
                hoverBarrierOne = false
                break
            case 2:
                hoverBarrierTwo = false
                break
            case 3:
                hoverBarrierThree = false
                break
        }

        setTimeout(() => {
            fadeUp(obj, () => {
                const action = gameSession.createStartAuctionAction({
                    pieceType: PieceType.Barrier,
                    value
                })
                gameSession.applyAction(action)
                gameSession.resetAction()
            })
        }, 1)
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

    function fadeUp(object: THREE.Object3D, onComplete: () => void) {
        const timeline = gsap.timeline({
            onComplete
        })
        timeline.to(object.position, {
            duration: 0.2,
            y: 0.7
        })

        object.traverse((object) => {
            if ((object as THREE.Mesh).material as THREE.MeshStandardMaterial) {
                const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial
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
</script>

<T.Group {...others}>
    <T.Mesh
        onpointerenter={onPointerEnter}
        onpointerleave={onPointerLeave}
        position.x={6.1}
        position.y={-0.6}
        position.z={1.5}
        rotation.x={-Math.PI / 2}
        rotation.z={Math.PI}
        receiveShadow
    >
        <T.BoxGeometry args={[14.7, 4.3, 0.2]} />
        <T.MeshStandardMaterial color="#444444" />
    </T.Mesh>

    {#each gameSession.gameState.cubes as cubeRow, row}
        <div class="flex items-center gap-x-1">
            {#each cubeRow as cube, col}
                {#if cube}
                    <Cube3d
                        {cube}
                        castShadow={false}
                        onclick={(event: any) => onCubeClick(event, cube, { row, col })}
                        rotation.x={-Math.PI / 2}
                        position.x={col * 1}
                        position.y={!canPlace ||
                        !placeableCubes.find((c) => sameCoordinates(c, { row, col }))
                            ? -0.7
                            : $yPos}
                        position.z={0.5 + row * 1}
                    />
                {/if}
            {/each}
        </div>
    {/each}
    {#if gameSession.gameState.mayor}
        <TopHat
            onpointerenter={(event: any) => {
                event.stopPropagation()
                hoverMayor = true
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                hoverMayor = false
            }}
            outline={hoverMayor}
            onclick={onMayorClick}
            scale={0.5}
            position.y={0.35}
            position.x={12.15}
            position.z={0.6}
            transparent={true}
            opacity={$opacity}
        />
    {/if}
    {#if gameSession.gameState.barrierOne}
        <Barrier
            onpointerenter={(event: any) => {
                event.stopPropagation()
                hoverBarrierOne = true
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                hoverBarrierOne = false
            }}
            onclick={(event: any) => {
                onBarrierClick(event, 1)
            }}
            outline={hoverBarrierOne}
            position.x={9.5}
            position.y={-0.3}
            position.z={0.25}
        />
    {/if}
    {#if gameSession.gameState.barrierTwo}
        <Barrier
            onpointerenter={(event: any) => {
                event.stopPropagation()
                hoverBarrierTwo = true
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                hoverBarrierTwo = false
            }}
            onclick={(event: any) => {
                onBarrierClick(event, 2)
            }}
            outline={hoverBarrierTwo}
            position.x={9.5}
            position.y={-0.3}
            position.z={1.45}
        />
    {/if}
    {#if gameSession.gameState.barrierThree}
        <Barrier
            onpointerenter={(event: any) => {
                event.stopPropagation()
                hoverBarrierThree = true
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                hoverBarrierThree = false
            }}
            onclick={(event: any) => {
                onBarrierClick(event, 3)
            }}
            outline={hoverBarrierThree}
            position.x={9.5}
            position.y={-0.3}
            position.z={2.65}
        />
    {/if}
    {#if gameSession.gameState.cancelCube}
        <CancelCube
            onpointerenter={(event: any) => {
                event.stopPropagation()
                hoverCancelCube = true
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                hoverCancelCube = false
            }}
            outline={hoverCancelCube}
            onclick={onCancelCubeClick}
            position.x={12.0}
            position.y={-0.25}
            position.z={2.4}
            rotation.x={-Math.PI / 2}
        />
    {/if}
</T.Group>
