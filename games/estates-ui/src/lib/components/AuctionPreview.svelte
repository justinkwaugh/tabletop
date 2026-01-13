<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core'
    import { useViewport } from '@threlte/extras'
    import { onMount } from 'svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import Cube3d from './Cube3d.svelte'
    import {
        EstatesGameState,
        HydratedEstatesGameState,
        isBarrier,
        isCancelCube,
        isCube,
        isMayor,
        isRoof
    } from '@tabletop/estates'
    import { gsap } from 'gsap'
    import { Object3D } from 'three'
    import TopHat from '$lib/3d/TopHat.svelte'
    import CancelCube from './CancelCube.svelte'
    import Roof from './Roof3d.svelte'
    import BarrierOne from '$lib/3d/BarrierOne.svelte'
    import { fadeIn, fadeOut, hideInstant } from '$lib/utils/animations'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as EstatesGameSession
    let { invalidate } = useThrelte()
    const viewport = useViewport()
    let {
        position,
        hidden = false,
        flyDone,
        ...others
    }: { position: [number, number, number]; hidden?: boolean; flyDone?: () => void } = $props()

    let rotation = $state(0)
    useTask(
        (delta) => {
            rotation += delta
            if (auctionPiece) {
                invalidate()
            }
        },
        { autoInvalidate: false }
    )

    let group = $state<Object3D>()
    let piece = $state<Object3D>()

    let currentTimeline: gsap.core.Timeline | undefined
    let didHide: boolean = true

    function flyUp(object: Object3D, yOffset: number = 0.6) {
        setTimeout(() => {
            if (currentTimeline) {
                currentTimeline.kill()
            }
            const timeline = gsap.timeline({
                onComplete: flyDone
            })
            currentTimeline = timeline
            timeline.to(object.position, {
                y: $viewport.height / 2 - yOffset,
                duration: 0.3
            })
            fadeIn({ object, duration: 0.5, timeline, startAt: 0 })
            timeline.play()
        }, 200)
    }

    function hide(object: Object3D) {
        if (!didHide) {
            return
        }
        if (currentTimeline) {
            currentTimeline.kill()
        }
        currentTimeline = fadeOut({ object, duration: 0.2 })
        didHide = false
    }

    function show(object: Object3D) {
        if (didHide) {
            return
        }
        if (currentTimeline) {
            currentTimeline.kill()
        }
        currentTimeline = fadeIn({ object, duration: 0.2 })
        didHide = true
    }

    async function onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedEstatesGameState
        from?: HydratedEstatesGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        const object = group
        if (object && from?.chosenPiece && !to.chosenPiece) {
            fadeOut({
                object,
                duration: 0.2,
                timeline: animationContext.actionTimeline,
                startAt: 0
            })
        }
    }

    $effect(() => {
        if (!group || !piece) {
            return
        }
        if (hidden) {
            hide(group)
        } else {
            show(group)
        }
    })

    $effect(() => {
        if (!group || !piece) {
            return
        }
        group.position.y = $viewport.height / 2 - 3
        flyUp(group)
    })

    onMount(() => {
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })
    let auctionPiece = $derived(gameSession.gameState.chosenPiece)
</script>

{#if auctionPiece}
    <T.Group
        scale={gameSession.mobileView ? 0.7 : 0.8}
        oncreate={(ref: Object3D) => {
            group = ref
            return () => {
                group = undefined
                piece = undefined
            }
        }}
    >
        {#if isCube(auctionPiece)}
            <Cube3d
                oncreate={(ref: Object3D) => {
                    hideInstant(ref)
                    piece = ref
                }}
                position={[0, 0, 0]}
                rotation.y={rotation}
                cube={auctionPiece}
                {...others}
            />
        {:else if isMayor(auctionPiece)}
            <TopHat
                onloaded={(ref: Object3D) => {
                    hideInstant(ref)
                    piece = ref
                }}
                rotation.y={rotation}
                position.y={0.15}
                scale={0.46}
                {...others}
            />
        {:else if isCancelCube(auctionPiece)}
            <CancelCube
                oncreate={(ref: Object3D) => {
                    hideInstant(ref)
                    piece = ref
                }}
                rotation.y={rotation}
                {...others}
            />
        {:else if isBarrier(auctionPiece)}
            <BarrierOne
                onloaded={(ref: Object3D) => {
                    hideInstant(ref)
                    piece = ref
                }}
                stripes={auctionPiece.value}
                scale={1}
                rotation.y={rotation}
                {...others}
            />
        {:else if isRoof(auctionPiece)}
            <Roof
                onloaded={(ref: Object3D) => {
                    hideInstant(ref)
                    piece = ref
                }}
                roof={auctionPiece}
                rotation.x={Math.PI / 2}
                rotation.z={-rotation}
                {...others}
            />
        {/if}
    </T.Group>
{/if}
