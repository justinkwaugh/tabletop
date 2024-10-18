<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core'
    import { interactivity, HUD, Suspense, useViewport } from '@threlte/extras'
    import * as THREE from 'three'
    import { Group, Object3D, Box3, Vector3 } from 'three'
    import Map from './Map.svelte'
    import { ColumnOffsets, RowOffsets } from '$lib/utils/boardOffsets.js'
    import Site from './Site.svelte'
    import { getContext } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import TopHat from '$lib/3d/TopHat.svelte'
    import Offer3d from './Offer3d.svelte'
    import HudScene from './HudScene.svelte'
    import Cert3d from './Cert3d.svelte'
    import PlayerPanel3d from './PlayerPanel3d.svelte'
    import GlowingCircle from './GlowingCircle.svelte'
    import { gsap, Power1 } from 'gsap'
    import { Company, HydratedEstatesGameState, isMayor, MachineState } from '@tabletop/estates'
    import CameraControls from 'camera-controls'
    import { fade, fadeIn, fadeOut, hideInstant, scale } from '$lib/utils/animations'
    import { useDebounce } from 'runed'
    import { GameSessionMode } from '@tabletop/frontend-components'
    // import { Checkbox, Folder, FpsGraph, List, Pane, Slider } from 'svelte-tweakpane-ui'
    // import RenderIndicator from './RenderIndicator.svelte'

    CameraControls.install({ THREE: THREE })

    let gameSession = getContext('gameSession') as EstatesGameSession
    let ghostHat: number | undefined = $state()
    let showMayorHighlights = $derived(
        gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.PlacingPiece &&
            isMayor(gameSession.gameState.chosenPiece)
    )

    interactivity()

    const sizingGroup = new Group() // This group is used to measure sizing for the camera

    const { scene, renderer, camera, size, invalidate } = useThrelte()

    let cameraControls: CameraControls | undefined

    let playerPanelPos = $state({
        y: 2
    })

    let currentMayor: Object3D | undefined

    async function onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: HydratedEstatesGameState
        from?: HydratedEstatesGameState
        timeline: gsap.core.Timeline
    }) {
        const heightForBackRow = to.board.maxRowHeight(0) - 0.8
        const heightForMiddleRow = to.board.maxRowHeight(1) - 1.5
        const heightForFrontRow = to.board.maxRowHeight(2) - 3

        const maxHeight = Math.max(2, heightForBackRow, heightForMiddleRow, heightForFrontRow)

        gsap.to(playerPanelPos, {
            duration: 0.5,
            y: maxHeight + 0.5
        })

        if (
            currentMayor !== undefined &&
            !to.board.rows[0].mayor &&
            !to.board.rows[1].mayor &&
            !to.board.rows[2].mayor
        ) {
            scale({
                object: currentMayor,
                duration: 0.1,
                scale: 0.01,
                timeline
            })
            fadeOut({
                object: currentMayor,
                duration: 0.1,
                timeline
            })
        }
    }

    gameSession.addGameStateChangeListener(onGameStateChange)
    onGameStateChange({ to: gameSession.gameState, timeline: gsap.timeline() })

    let billboards: any[] = []

    useTask(
        async (delta) => {
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
        },
        { autoInvalidate: false }
    )

    const certPositions: [number, number, number][] = [
        [9, -0.5, 6.2],
        [9, -0.5, 7.5],
        [9, -0.5, 8.8],
        [11.2, -0.5, 6.2],
        [11.2, -0.5, 7.5],
        [11.2, -0.5, 8.8]
    ]

    function fadeInHat(ref: Object3D) {
        fade({ object: ref, duration: 0.2, opacity: 1 })
    }

    async function placeMayor(row: number) {
        await gameSession.placeMayor(row)
        ghostHat = undefined
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

        const sceneBox = new Box3().setFromObject(scene)
        if (sceneBox.isEmpty()) {
            return
        }
        cameraControls.stop()
        resetCameraRestrictions()

        camera.current.up = new THREE.Vector3(0, 1, 0)
        cameraControls.updateCameraUp()

        await cameraControls.setLookAt(0, 16, 20, 0, 2, 0, false)
        await cameraControls.rotateTo(0, 0, false)

        await cameraControls.fitToBox(sceneBox, false, {
            paddingTop: 0,
            paddingLeft: 0,
            paddingBottom: 0,
            paddingRight: 0
        })

        cameraControls.maxPolarAngle = 0.88
        cameraControls.minPolarAngle = 0
        cameraControls.maxAzimuthAngle = Math.PI / 4
        cameraControls.minAzimuthAngle = -(Math.PI / 4)

        await cameraControls.rotateTo(0, 0.88, false)
        await cameraControls.dollyTo(cameraControls.distance + 1, false)
        cameraControls.maxDistance = cameraControls.distance + 5
        cameraControls.minDistance = cameraControls.distance - 10
        cameraControls.mouseButtons.left = CameraControls.ACTION.ROTATE
        cameraControls.touches.one = CameraControls.ACTION.TOUCH_ROTATE

        cameraControls.saveState()
    }

    async function moveCameraToOverhead() {
        if (!cameraControls) return

        const sceneBox = new Box3().setFromObject(scene)
        if (sceneBox.isEmpty()) {
            return
        }

        cameraControls.stop()
        resetCameraRestrictions()

        camera.current.up = new THREE.Vector3(1, 0, 0)
        cameraControls.updateCameraUp()

        await cameraControls.setLookAt(0, 10, 0, 0, 0, 0, false)
        await cameraControls.rotateTo(-Math.PI / 2, 1, false)
        await cameraControls.fitToBox(sceneBox, false, {
            paddingTop: 0,
            paddingLeft: 0,
            paddingBottom: 0,
            paddingRight: 0
        })

        const currentPos = cameraControls.getPosition(new Vector3())
        await cameraControls.setLookAt(0, currentPos.y, 0, 0, 0, 0, false)
        cameraControls.polarAngle = Math.PI / 2
        cameraControls.azimuthAngle = -Math.PI / 2

        cameraControls.maxDistance = cameraControls.distance
        cameraControls.minDistance = cameraControls.distance - 10
        cameraControls.maxPolarAngle = Math.PI / 2
        cameraControls.minPolarAngle = Math.PI / 2
        cameraControls.maxAzimuthAngle = -Math.PI / 4
        cameraControls.minAzimuthAngle = -(Math.PI / 4) * 3
        cameraControls.mouseButtons.left = CameraControls.ACTION.CUSTOM
        cameraControls.touches.one = CameraControls.ACTION.CUSTOM

        cameraControls.saveState()
    }

    let lastWidth: number = 0
    let lastHeight: number = 0

    const adjustRenderSize = useDebounce(() => {
        if (!lastWidth || !lastHeight) {
            return
        }

        if (lastWidth < lastHeight) {
            gameSession.mobileView = true
            moveCameraToOverhead()
        } else {
            gameSession.mobileView = false
            moveCameraToFit()
        }
    }, 50)

    $effect(() => {
        const newWidth = $size.width
        const newHeight = $size.height
        if (newWidth === lastWidth && newHeight === lastHeight) {
            return
        }
        lastWidth = newWidth
        lastHeight = newHeight

        adjustRenderSize()
    })

    sizingGroup.addEventListener('childadded', (e) => {
        setTimeout(adjustRenderSize, 1)
    })

    let pulseOpacity = $state({ opacity: 0 })
    const pulse = gsap.timeline()
    pulse.to(pulseOpacity, {
        opacity: 1,
        duration: 0.6,
        ease: Power1.easeIn
    })
    pulse.to(pulseOpacity, {
        opacity: 0.15,
        duration: 1.2,
        ease: Power1.easeInOut,
        repeat: -1,
        yoyo: true
    })

    let showingMayorHighlights = $state(false)
    $effect(() => {
        if (showMayorHighlights) {
            showingMayorHighlights = true
            pulse.play(0)
        } else {
            pulse.pause()
            gsap.to(pulseOpacity, {
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    showingMayorHighlights = false
                }
            })
        }
    })
</script>

<!-- <Stars /> -->
<T.PerspectiveCamera
    makeDefault
    position={[0, 16, 20]}
    oncreate={(ref) => {
        ref.lookAt(0, 2, 0)
        cameraControls = new CameraControls(ref, renderer.domElement)
        cameraControls.touches.one = CameraControls.ACTION.CUSTOM
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

        cameraControls.addEventListener('update', () => {
            invalidate()
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

<Suspense final>
    <T is={sizingGroup}>
        <Map
            onrender={() => {
                adjustRenderSize()
            }}
        />
        {#if !gameSession.mobileView}
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
    </T>

    {#each gameSession.gameState.board.rows as row, i}
        {#each row.sites as site, j}
            <Site {site} coords={{ row: i, col: j }} x={ColumnOffsets[j]} z={RowOffsets[i]} />
        {/each}
        {#if row.mayor}
            <TopHat
                onloaded={(ref: Object3D) => {
                    currentMayor = ref
                    if (gameSession.mode === GameSessionMode.History) {
                        hideInstant(ref)
                        ref.scale.x = 0.1
                        ref.scale.y = 0.1
                        ref.scale.z = 0.1
                        fadeIn({ object: ref, duration: 0.1 })
                        scale({ object: ref, duration: 0.1, scale: 0.5 })
                    }
                }}
                scale={0.5}
                position.y={0}
                position.x={10.1}
                position.z={RowOffsets[i]}
            />
        {/if}
    {/each}
    {#if showMayorHighlights || showingMayorHighlights}
        <GlowingCircle
            onpointerenter={(event: any) => {
                event.stopPropagation()
                ghostHat = 0
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                ghostHat = undefined
            }}
            onclick={(event: any) => {
                event.stopPropagation()
                placeMayor(0)
            }}
            position={[10.1, -0.49, RowOffsets[0]]}
            opacity={pulseOpacity.opacity}
            rotation.x={-Math.PI / 2}
        />
        <GlowingCircle
            onpointerenter={(event: any) => {
                event.stopPropagation()
                ghostHat = 1
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                ghostHat = undefined
            }}
            onclick={(event: any) => {
                event.stopPropagation()
                placeMayor(1)
            }}
            position={[10.1, -0.49, RowOffsets[1]]}
            opacity={pulseOpacity.opacity}
            rotation.x={-Math.PI / 2}
        />
        <GlowingCircle
            onpointerenter={(event: any) => {
                event.stopPropagation()
                ghostHat = 2
            }}
            onpointerleave={(event: any) => {
                event.stopPropagation()
                ghostHat = undefined
            }}
            onclick={(event: any) => {
                event.stopPropagation()
                placeMayor(2)
            }}
            position={[10.1, -0.49, RowOffsets[2]]}
            opacity={pulseOpacity.opacity}
            rotation.x={-Math.PI / 2}
        />

        {#if ghostHat !== undefined}
            <TopHat
                onloaded={(ref: Object3D) => {
                    hideInstant(ref)
                    fadeInHat(ref)
                }}
                scale={0.5}
                position.y={0}
                position.x={10.1}
                position.z={RowOffsets[ghostHat]}
            />
        {/if}
    {/if}
</Suspense>

<!-- <Pane position="fixed" title="Tweaks">
    <Folder title="Rendering Activity">
        <RenderIndicator />
        <FpsGraph />
    </Folder>
</Pane> -->
