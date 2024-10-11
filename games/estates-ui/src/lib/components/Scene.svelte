<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core'
    import { interactivity, HUD } from '@threlte/extras'
    import * as THREE from 'three'
    import { Group, Object3D, Mesh, MeshStandardMaterial, Box3, Vector3 } from 'three'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext, onMount } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import HudScene from './HudScene.svelte'
    import Cert3d from './Cert3d.svelte'
    import PlayerPanel3d from './PlayerPanel3d.svelte'
    import GlowingCircle from './GlowingCircle.svelte'
    import { gsap } from 'gsap'
    import {
        Company,
        EstatesGameState,
        HydratedEstatesGameState,
        isMayor,
        MachineState
    } from '@tabletop/estates'
    import CameraControls from 'camera-controls'
    import { MediaQuery } from 'runed'

    CameraControls.install({ THREE: THREE })

    let gameSession = getContext('gameSession') as EstatesGameSession
    let ghostHat: number | undefined = $state()
    let showMayorHighlights = $derived(
        gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.PlacingPiece &&
            isMayor(gameSession.gameState.chosenPiece)
    )

    const screen = new MediaQuery('(min-width: 640px)')

    interactivity()

    const { scene, renderer, camera, size } = useThrelte()

    let cameraControls: CameraControls | undefined

    let playerPanelPos = $state({
        y: 2
    })

    async function onGameStateChange(to: EstatesGameState, from?: EstatesGameState) {
        const state = new HydratedEstatesGameState(to)
        const heightForBackRow = state.board.maxRowHeight(0) - 0.8
        const heightForMiddleRow = state.board.maxRowHeight(1) - 1.5
        const heightForFrontRow = state.board.maxRowHeight(2) - 3

        const maxHeight = Math.max(2, heightForBackRow, heightForMiddleRow, heightForFrontRow)

        gsap.to(playerPanelPos, {
            duration: 0.5,
            y: maxHeight + 0.5
        })
    }

    gameSession.addGameStateChangeListener(onGameStateChange)
    onGameStateChange(gameSession.gameState)

    let billboards: any[] = []

    useTask(async (delta) => {
        if (camera.current) {
            for (const obj of billboards) {
                const vector = new Vector3(
                    obj.position.x,
                    camera.current.position.y,
                    camera.current.position.z
                )
                obj.lookAt(vector)
            }
        }

        if (cameraControls) {
            cameraControls.update(delta)
        }
    })

    const certPositions: [number, number, number][] = [
        [9, -0.5, 6.2],
        [9, -0.5, 7.5],
        [9, -0.5, 8.8],
        [11.2, -0.5, 6.2],
        [11.2, -0.5, 7.5],
        [11.2, -0.5, 8.8]
    ]

    function fadeIn(ref: Object3D) {
        ref.traverse((ref) => {
            if ((ref as Mesh).material as MeshStandardMaterial) {
                const material = (ref as Mesh).material as MeshStandardMaterial
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

    async function resetCameraRestrictions() {
        if (!cameraControls) return
        cameraControls.maxPolarAngle = Math.PI
        cameraControls.minPolarAngle = 0
        cameraControls.maxAzimuthAngle = Infinity
        cameraControls.minAzimuthAngle = -Infinity
        cameraControls.maxDistance = Infinity
        cameraControls.minDistance = 0
    }

    async function moveCameraToFit() {
        if (!cameraControls) return
        cameraControls.stop()

        resetCameraRestrictions()

        camera.current.up = new THREE.Vector3(0, 1, 0)
        cameraControls.updateCameraUp()

        await cameraControls.setLookAt(0, 16, 20, 0, 2, 0, false)
        await cameraControls.rotateTo(0, 0, false)

        await cameraControls.fitToBox(new Box3().setFromObject(scene), false, {
            paddingTop: 0,
            paddingLeft: 0,
            paddingBottom: 0,
            paddingRight: 0
        })

        cameraControls.maxDistance = cameraControls.distance
        cameraControls.minDistance = cameraControls.distance - 10
        cameraControls.maxPolarAngle = 1
        cameraControls.minPolarAngle = 0
        cameraControls.maxAzimuthAngle = Math.PI / 3
        cameraControls.minAzimuthAngle = -(Math.PI / 3)

        await cameraControls.rotateTo(0, 1, false)
        cameraControls.saveState()
    }

    async function moveCameraToOverhead() {
        if (!cameraControls) return
        cameraControls.stop()
        resetCameraRestrictions()

        camera.current.up = new THREE.Vector3(1, 0, 0)
        cameraControls.updateCameraUp()

        await cameraControls.setLookAt(0, 10, 0, 0, 0, 0, false)
        await cameraControls.rotateTo(-Math.PI / 2, 1, false)

        await cameraControls.fitToBox(new Box3().setFromObject(scene), false, {
            paddingTop: 0,
            paddingLeft: 0,
            paddingBottom: 0,
            paddingRight: 0
        })

        cameraControls.maxDistance = cameraControls.distance
        cameraControls.minDistance = cameraControls.distance - 10
        cameraControls.maxPolarAngle = Math.PI / 2
        cameraControls.minPolarAngle = Math.PI / 2
        cameraControls.maxAzimuthAngle = -Math.PI / 4
        cameraControls.minAzimuthAngle = -(Math.PI / 4) * 3
        cameraControls.saveState()
    }

    let lastWidth = $state(window.innerWidth)

    function onWindowResize() {
        if (window.innerWidth < 640) {
            if (lastWidth > 640 || gameSession.mobileView === undefined) {
                gameSession.mobileView = true
            }
            moveCameraToOverhead()
        } else if (window.innerWidth >= 640) {
            if (lastWidth <= 640 || gameSession.mobileView === undefined) {
                gameSession.mobileView = false
            }
            moveCameraToFit()
        }
        lastWidth = window.innerWidth
    }

    onMount(() => {
        console.log(window.innerWidth)
        onWindowResize()
    })
</script>

<svelte:window onresize={onWindowResize} />

<!-- <Stars /> -->
<T.PerspectiveCamera
    makeDefault
    position={[0, 16, 20]}
    oncreate={(ref) => {
        ref.lookAt(0, 2, 0)
        cameraControls = new CameraControls(ref, renderer.domElement)
        cameraControls.touches.one = CameraControls.ACTION.TOUCH_CUSTOM
        cameraControls.maxPolarAngle = 1
        cameraControls.maxAzimuthAngle = Math.PI / 3
        cameraControls.minAzimuthAngle = -(Math.PI / 3)
        cameraControls.smoothTime = 0.2
        cameraControls.addEventListener('controlstart', () => {
            gameSession.touching = true
        })
        cameraControls.addEventListener('controlend', () => {
            gameSession.touching = false
        })

        return () => {
            cameraControls?.dispose()
        }
    }}
></T.PerspectiveCamera>
<T.AmbientLight intensity={1.5} />
<T.DirectionalLight
    oncreate={(ref) => {
        ref.shadow.camera.top = 20
        ref.shadow.camera.bottom = -20
        ref.shadow.camera.left = -20
        ref.shadow.camera.right = 20
        ref.shadow.camera.near = 0
        ref.shadow.camera.far = 20
    }}
    intensity={0.5}
    position={[5, 5, 10]}
    castShadow
/>
<T.DirectionalLight intensity={0.05} position={[0, 20, -5]} />
<T.DirectionalLight intensity={0.5} position={[-5, 5, 10]} />

<HUD>
    <HudScene />
</HUD>

<T.Group
    oncreate={() => {
        setTimeout(onWindowResize, 500)
    }}
>
    <Map />
    {#each gameSession.gameState.board.rows as row, i}
        {#each row.sites as site, j}
            <Site {site} coords={{ row: i, col: j }} x={ColumnOffsets[j]} z={RowOffsets[i]} />
        {/each}
        {#if row.mayor}
            <TopHat scale={0.5} position.y={0.35} position.x={10.2} position.z={RowOffsets[i]} />
        {/if}
    {/each}

    {#if screen.matches}
        <Offer3d position={[-2, -0.6, 7.5]} />

        {#each Object.values(Company) as company, i (company)}
            {#if gameSession.gameState.certificates.includes(company)}
                <Cert3d {company} scale={1.2} position={certPositions[i]} />
            {/if}
        {/each}

        <PlayerPanel3d
            position.x={0}
            position.y={playerPanelPos.y}
            position.z={-6}
            oncreate={(ref: Group) => {
                let size = new Box3().setFromObject(ref).getSize(new Vector3())
                ref.position.x = -(size.x / 2) + 2.5
                billboards.push(ref)
            }}
        />
    {/if}
</T.Group>

{#if showMayorHighlights}
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
