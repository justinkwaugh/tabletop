<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import { interactivity, OrbitControls, HUD, Outlines } from '@threlte/extras'
    import * as THREE from 'three'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import HudScene from './HudScene.svelte'
    import { Vector3 } from 'three'
    import Cert3d from './Cert3d.svelte'
    import PlayerPanel3d from './PlayerPanel3d.svelte'
    import type { Effects } from '$lib/model/Effects.svelte'
    import GlowingCircle from './GlowingCircle.svelte'
    import { gsap } from 'gsap'
    import { ActionType } from '@tabletop/estates'
    import Roof from './Roof.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let effects = getContext('effects') as Effects
    let ghostHat: number | undefined = $state()

    interactivity()

    let camera: any

    let billboards: any[] = []
    useTask(async () => {
        if (camera) {
            for (const obj of billboards) {
                const vector = new Vector3(obj.position.x, camera.position.y, camera.position.z)
                obj.lookAt(vector)
            }
        }
    })

    const certPositions = [
        [7.8, -0.5, 6.2],
        [7.8, -0.5, 7.5],
        [7.8, -0.5, 8.8],
        [10, -0.5, 6.2],
        [10, -0.5, 7.5],
        [10, -0.5, 8.8]
    ]

    function fadeIn(ref: THREE.Object3D) {
        ref.traverse((ref) => {
            if ((ref as THREE.Mesh).material as THREE.MeshStandardMaterial) {
                const material = (ref as THREE.Mesh).material as THREE.MeshStandardMaterial
                material.transparent = true
                material.opacity = 0
                material.needsUpdate = true
                gsap.to(material, {
                    duration: 0.5,
                    opacity: 0.5
                })
            }
        })
    }

    async function placeMayor(row: number) {
        ghostHat = undefined
        await gameSession.placeMayor(row)
    }
</script>

<!-- <Stars /> -->
<T.PerspectiveCamera
    makeDefault
    position={[0, 16, 20]}
    oncreate={(ref) => {
        camera = ref
        ref.lookAt(0, 2, 0)
    }}
>
    <OrbitControls
        target={[0, 2, 0]}
        maxPolarAngle={1}
        maxAzimuthAngle={Math.PI / 3}
        minAzimuthAngle={-(Math.PI / 3)}
        enablePan={true}
        zoomToCursor={false}
    />
</T.PerspectiveCamera>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight position={[5, 5, 10]} castShadow />

<HUD>
    <HudScene />
</HUD>

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

{#each gameSession.gameState.certificates as company, i}
    {#if company}
        <Cert3d {company} scale={1.2} position={certPositions[i]} />
    {/if}
{/each}

<PlayerPanel3d
    position={[0, 5, -6]}
    oncreate={(ref) => {
        let size = new THREE.Box3().setFromObject(ref).getSize(new THREE.Vector3())
        console.log(size)
        ref.position.x = -(size.x / 2) + 2.5
        billboards.push(ref)
    }}
/>

{#if gameSession.isMyTurn && gameSession.chosenAction === ActionType.PlaceMayor}
    <GlowingCircle
        onpointerenter={() => {
            ghostHat = 0
        }}
        onpointerleave={() => {
            ghostHat = undefined
        }}
        onclick={() => {
            placeMayor(0)
        }}
        position={[10.1, -0.49, RowOffsets[0]]}
        rotation.x={-Math.PI / 2}
    />
    <GlowingCircle
        onpointerenter={() => {
            ghostHat = 1
        }}
        onpointerleave={() => {
            ghostHat = undefined
        }}
        onclick={() => {
            placeMayor(1)
        }}
        position={[10.1, -0.49, RowOffsets[1]]}
        rotation.x={-Math.PI / 2}
    />
    <GlowingCircle
        onpointerenter={() => {
            ghostHat = 2
        }}
        onpointerleave={() => {
            ghostHat = undefined
        }}
        onclick={() => {
            placeMayor(2)
        }}
        position={[10.1, -0.49, RowOffsets[2]]}
        rotation.x={-Math.PI / 2}
    />

    {#if ghostHat !== undefined}
        <TopHat
            oncreate={fadeIn}
            scale={0.45}
            position.y={0.35}
            position.x={10.2}
            position.z={RowOffsets[ghostHat]}
        />
    {/if}
{/if}

<Roof position={[0, 0, 0]} rotation.y={Math.PI / 2} />
