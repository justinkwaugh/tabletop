<script lang="ts">
    import { T, useTask } from '@threlte/core'
    import {
        interactivity,
        OrbitControls,
        HUD,
        Text3DGeometry,
        Float,
        Text,
        HTML
    } from '@threlte/extras'
    import * as THREE from 'three'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import HudScene from './HudScene.svelte'
    import PlaceCard from './PlaceCard.svelte'
    import PokerChip from '$lib/3d/PokerChip.svelte'
    import { Vector3 } from 'three'
    import PlayerInfo from './PlayerInfo.svelte'
    import Cert3d from './Cert3d.svelte'
    import { Company } from '@tabletop/estates'
    import GlassPanel from './GlassPanel.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

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
</script>

<T.PerspectiveCamera
    makeDefault
    position={[0, 13, 23]}
    oncreate={(ref) => {
        camera = ref
        ref.lookAt(0, 2, 0)
    }}
>
    <OrbitControls
        target={[0, 2, 0]}
        maxPolarAngle={1.15}
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

<!-- <PlaceCard position.x={-8} position.z={-9.2} />
<PlaceCard position.x={-4} position.z={-9.2} /> -->
<!-- <PokerChip rotation.x={Math.PI / 10} position.x={0} position.y={-0.5} position.z={-7} />

<Text
    oncreate={(ref) => {
        billboards.push(ref)
    }}
    position.x={0}
    position.y={1}
    position.z={-8}
    depthOffset={-1}
    fontSize={0.8}
    anchorX="50%"
    anchorY="50%"
    text={'justintheonly'}
>
    <T.MeshStandardMaterial color="#EEEEEE" toneMapped={false} />
</Text>

<Text
    oncreate={(ref) => {
        billboards.push(ref)
    }}
    position.x={5}
    position.y={1}
    position.z={-8}
    depthOffset={-1}
    fontSize={0.8}
    anchorX="50%"
    anchorY="50%"
    text={'hrafnkelredbe'}
>
    <T.MeshStandardMaterial color="#EEEEEE" toneMapped={false} />
</Text> -->

{#each gameSession.game.players as player, i}
    <HTML
        oncreate={(ref) => {
            billboards.push(ref)
        }}
        position.x={-10 + i * 6}
        position.y={5}
        position.z={-6}
        distanceFactor={15}
        transform
    >
        <PlayerInfo playerId={player.id} />
    </HTML>
    <GlassPanel
        oncreate={(ref) => {
            billboards.push(ref)
        }}
        width={5}
        height={2.5}
        position.x={-10 + i * 6}
        position.z={-6.2}
        position.y={5}
    />
{/each}
