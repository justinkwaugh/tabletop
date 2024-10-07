<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import { interactivity, useViewport } from '@threlte/extras'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cube3d from './Cube3d.svelte'
    import {
        Company,
        Cube,
        isBarrier,
        isCancelCube,
        isCube,
        isMayor,
        isRoof,
        MachineState,
        PieceType
    } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import { Object3D, Mesh, MeshStandardMaterial } from 'three'
    import TopHat from '$lib/3d/TopHat.svelte'
    import CancelCube from './CancelCube.svelte'
    import Barrier from '$lib/3d/Barrier.svelte'
    import Roof from './Roof.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    const viewport = useViewport()
    let {
        position,
        flyDone,
        ...others
    }: { position: [number, number, number]; flyDone?: () => void } = $props()

    let rotation = $state(0)
    useTask((delta) => {
        rotation += delta
    })

    function flyUp(object: Object3D, yOffset: number = 0.5) {
        setTimeout(() => {
            const timeline = gsap.timeline({
                onComplete: flyDone
            })
            timeline.to(object.position, {
                y: $viewport.height / 2 - yOffset,
                duration: 0.3
            })

            object.traverse((object) => {
                if ((object as Mesh).material as MeshStandardMaterial) {
                    const material = (object as Mesh).material as MeshStandardMaterial
                    material.transparent = true
                    material.needsUpdate = true
                    timeline.to(
                        material,
                        {
                            ease: 'power2.in',
                            duration: 0.5,
                            opacity: 1
                        },
                        0
                    )
                }
            })
            timeline.play()
        }, 1)
    }

    function hide(object: Object3D) {
        object.traverse((object) => {
            if ((object as Mesh).material as MeshStandardMaterial) {
                const material = (object as Mesh).material as MeshStandardMaterial
                material.transparent = true
                material.opacity = 0
                material.needsUpdate = true
            }
        })
    }
</script>

{#if gameSession.gameState.chosenPiece && gameSession.gameState.machineState !== MachineState.PlacingPiece}
    {#if isCube(gameSession.gameState.chosenPiece)}
        <Cube3d
            position={[0, $viewport.height / 2 - 0.5, 0]}
            opacity={0}
            rotation.y={rotation}
            oncreate={(ref: Object3D) => {
                hide(ref)
                ref.position.y = $viewport.height / 2 - 3
                flyUp(ref)
            }}
            cube={gameSession.gameState.chosenPiece}
            {...others}
        />
    {:else if isMayor(gameSession.gameState.chosenPiece)}
        <TopHat
            oncreate={(ref: Object3D) => {
                hide(ref)
                ref.position.y = $viewport.height / 2 - 3
                flyUp(ref, 0.25)
            }}
            rotation.y={rotation}
            scale={0.46}
            position={[0, $viewport.height / 2 - 0.25, 0]}
            {...others}
        />
    {:else if isCancelCube(gameSession.gameState.chosenPiece)}
        <CancelCube
            oncreate={(ref: Object3D) => {
                hide(ref)
                ref.position.y = $viewport.height / 2 - 3
                flyUp(ref)
            }}
            rotation.y={rotation}
            position={[0, $viewport.height / 2, 0]}
            {...others}
        />
    {:else if isBarrier(gameSession.gameState.chosenPiece)}
        <Barrier
            oncreate={(ref: Object3D) => {
                hide(ref)
                ref.position.y = $viewport.height / 2 - 3
                flyUp(ref, 0.95)
            }}
            scale={1.1}
            rotation.y={rotation}
            position={[0, $viewport.height / 2, 0]}
            {...others}
        />
    {:else if isRoof(gameSession.gameState.chosenPiece)}
        <Roof
            roof={gameSession.gameState.chosenPiece}
            oncreate={(ref: Object3D) => {
                hide(ref)
                ref.position.y = $viewport.height / 2 - 3
                flyUp(ref)
            }}
            rotation.x={Math.PI / 2}
            rotation.z={-rotation}
            position={[0, $viewport.height / 2, 0]}
            {...others}
        />
    {/if}
{/if}
