<script lang="ts">
    import { useTask } from '@threlte/core'
    import { interactivity, useViewport } from '@threlte/extras'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cube3d from './Cube3d.svelte'
    import { Company, Cube, isCube, MachineState, PieceType } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import * as THREE from 'three'

    let gameSession = getContext('gameSession') as EstatesGameSession
    const viewport = useViewport()
    let {
        position,
        flyDone,
        ...others
    }: { position: [number, number, number]; flyDone?: () => void } = $props()

    let cubeRef: THREE.Object3D

    let rotation = $state(0)
    useTask((delta) => {
        rotation += delta
    })

    function flyUp(object: THREE.Object3D) {
        setTimeout(() => {
            gsap.to(object.position, {
                y: $viewport.height / 2 - 0.5,
                duration: 0.5,
                onComplete: flyDone
            })
        }, 1)
    }
</script>

{#if gameSession.gameState.chosenPiece && gameSession.gameState.machineState !== MachineState.PlacingPiece}
    {#if isCube(gameSession.gameState.chosenPiece)}
        <Cube3d
            position={[0, $viewport.height / 2 - 0.5, 0]}
            rotation.y={rotation}
            oncreate={(ref: THREE.Object3D) => {
                ref.position.y = -20
                cubeRef = ref
                flyUp(ref)
            }}
            cube={gameSession.gameState.chosenPiece}
            {...others}
        />
    {/if}
{/if}
