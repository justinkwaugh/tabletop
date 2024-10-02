<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import { interactivity, OrbitControls } from '@threlte/extras'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import Cube3d from './Cube3d.svelte'
    import { Company, Cube, PieceType } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import * as THREE from 'three'

    let gameSession = getContext('gameSession') as EstatesGameSession

    interactivity()

    let rotation = $state(0)
    useTask((delta) => {
        rotation -= delta
    })

    let auctionPiece = $state()

    function flyUp(object: THREE.Object3D) {
        console.log('fly up?')
        gsap.to(object.position, { y: 1.3, duration: 0.5 })
    }
</script>

<T.PerspectiveCamera
    makeDefault
    position={[0, 10, 15]}
    oncreate={(ref) => {
        ref.lookAt(0, 0, 0)
    }}
    ><OrbitControls
        maxPolarAngle={1.25}
        maxAzimuthAngle={Math.PI / 3}
        minAzimuthAngle={-(Math.PI / 3)}
        enablePan={true}
        zoomToCursor={false}
    />
    {#if gameSession.gameState.chosenPiece}
        <Cube3d
            bind:this={auctionPiece}
            rotation.y={rotation}
            rotation.x={0.2}
            oncreate={(ref) => {
                flyUp(ref)
            }}
            cube={{ pieceType: PieceType.Cube, value: 1, company: Company.Emerald }}
            position={[0, -20, -7]}
        />
    {/if}
</T.PerspectiveCamera>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight position={[5, 5, 10]} castShadow />

<Map />
{#each gameSession.gameState.board.rows as row, i}
    {#each row.sites as site, j}
        <Site {site} coords={{ row: i, col: j }} x={ColumnOffsets[j]} z={RowOffsets[i]} />
    {/each}
    {#if row.mayor}
        <TopHat scale={0.5} position.y={0.35} position.x={10.2} position.z={RowOffsets[i]} />
    {/if}
{/each}
<Offer3d position.x={-8} position.z={6} />
