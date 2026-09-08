<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core'
    import { onMount } from 'svelte'
    import Cube3d from './Cube3d.svelte'
    import {
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
    import { fade, fadeOut, hideInstant } from '$lib/utils/animations'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()
    let { invalidate } = useThrelte()
    let { position, hidden = false }: { position: [number, number, number]; hidden?: boolean } =
        $props()

    let auctionPiece = $derived(gameSession.gameState.chosenPiece)
    let rotation = $state(0)
    useTask(
        (delta) => {
            rotation += delta
        },
        { running: () => !!auctionPiece && !hidden }
    )

    let group = $state<Object3D>()
    let piece = $state<Object3D>()

    let visibilityTimeline: gsap.core.Timeline | undefined

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
            visibilityTimeline?.kill()
            fadeOut({
                onUpdate: invalidate,
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
        const timeline = fade({
            object: group,
            opacity: hidden ? 0 : 1,
            duration: 0.2,
            onUpdate: invalidate
        })
        visibilityTimeline = timeline
        return () => timeline.kill()
    })

    $effect(() => {
        if (!group || !piece) {
            return
        }
        const tween = gsap.fromTo(
            group.position,
            { y: -2.4 },
            { y: 0, duration: 0.2, onUpdate: invalidate }
        )
        return () => tween.kill()
    })

    onMount(() => {
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })
</script>

{#if auctionPiece}
    <T.Group {position}>
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
                />
            {:else if isCancelCube(auctionPiece)}
                <CancelCube
                    oncreate={(ref: Object3D) => {
                        hideInstant(ref)
                        piece = ref
                    }}
                    rotation.y={rotation}
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
                />
            {/if}
        </T.Group>
    </T.Group>
{/if}
