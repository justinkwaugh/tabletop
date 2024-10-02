<script lang="ts">
    import { useTask } from '@threlte/core'
    import { interactivity } from '@threlte/extras'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cube3d from './Cube3d.svelte'
    import { Company, Cube, isCube, MachineState, PieceType } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import * as THREE from 'three'

    let gameSession = getContext('gameSession') as EstatesGameSession

    interactivity()

    let rotation = $state(0)
    useTask((delta) => {
        rotation += delta
    })

    function flyUp(object: THREE.Object3D) {
        gsap.to(object.position, { y: 2.5, duration: 0.5 })
    }
</script>

{#if gameSession.gameState.chosenPiece && gameSession.gameState.machineState !== MachineState.PlacingPiece}
    {#if isCube(gameSession.gameState.chosenPiece)}
        <Cube3d
            scale={0.6}
            rotation.y={rotation}
            rotation.x={0.4}
            oncreate={(ref: THREE.Object3D) => {
                flyUp(ref)
            }}
            cube={gameSession.gameState.chosenPiece}
            position={[0, -20, -7]}
        />
    {/if}
{/if}
