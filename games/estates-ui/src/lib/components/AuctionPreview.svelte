<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import { useViewport } from '@threlte/extras'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cube3d from './Cube3d.svelte'
    import { isBarrier, isCancelCube, isCube, isMayor, isRoof } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import { Object3D, Mesh, MeshStandardMaterial } from 'three'
    import TopHat from '$lib/3d/TopHat.svelte'
    import CancelCube from './CancelCube.svelte'
    import Roof from './Roof3d.svelte'
    import BarrierOne from '$lib/3d/BarrierOne.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    const viewport = useViewport()
    let {
        position,
        hidden = false,
        flyDone,
        ...others
    }: { position: [number, number, number]; hidden?: boolean; flyDone?: () => void } = $props()

    let rotation = $state(0)
    useTask((delta) => {
        rotation += delta
    })

    let group = $state<Object3D>()

    function flyUp(object: Object3D, yOffset: number = 0.6) {
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

    function show(object: Object3D) {
        object.traverse((object) => {
            if ((object as Mesh).material as MeshStandardMaterial) {
                const material = (object as Mesh).material as MeshStandardMaterial
                material.transparent = false
                material.opacity = 1
                material.needsUpdate = true
            }
        })
    }

    $effect(() => {
        if (!group) {
            return
        }
        if (hidden) {
            hide(group)
        } else {
            show(group)
        }
    })
</script>

{#if gameSession.gameState.chosenPiece}
    <T.Group
        scale={gameSession.mobileView ? 0.7 : 0.8}
        oncreate={(ref: Object3D) => {
            group = ref
            hide(ref)
            ref.position.y = $viewport.height / 2 - 3
            flyUp(ref)
        }}
    >
        {#if isCube(gameSession.gameState.chosenPiece)}
            <Cube3d
                position={[0, 0, 0]}
                opacity={0}
                rotation.y={rotation}
                cube={gameSession.gameState.chosenPiece}
                {...others}
            />
        {:else if isMayor(gameSession.gameState.chosenPiece)}
            <TopHat rotation.y={rotation} position.y={0.15} scale={0.46} {...others} />
        {:else if isCancelCube(gameSession.gameState.chosenPiece)}
            <CancelCube rotation.y={rotation} {...others} />
        {:else if isBarrier(gameSession.gameState.chosenPiece)}
            <BarrierOne
                stripes={gameSession.gameState.chosenPiece.value}
                scale={1}
                rotation.y={rotation}
                {...others}
            />
        {:else if isRoof(gameSession.gameState.chosenPiece)}
            <Roof
                roof={gameSession.gameState.chosenPiece}
                rotation.x={Math.PI / 2}
                rotation.z={-rotation}
                {...others}
            />
        {/if}
    </T.Group>
{/if}
