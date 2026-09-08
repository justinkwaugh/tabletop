<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core'
    import { onMount, tick } from 'svelte'
    import Cube3d from './Cube3d.svelte'
    import {
        HydratedEstatesGameState,
        isBarrier,
        isCancelCube,
        isCube,
        isMayor,
        isRoof
    } from '@tabletop/estates'
    import { Object3D } from 'three'
    import TopHat from '$lib/3d/TopHat.svelte'
    import CancelCube from './CancelCube.svelte'
    import Roof from './Roof3d.svelte'
    import BarrierOne from '$lib/3d/BarrierOne.svelte'
    import { AuctionPreviewGroup } from '$lib/utils/auctionPreviewGroup.js'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()
    let { invalidate } = useThrelte()
    let { position, hidden = false }: { position: [number, number, number]; hidden?: boolean } =
        $props()

    let auctionPiece = $derived(gameSession.gameState.chosenPiece)
    let group = $state<AuctionPreviewGroup>()
    useTask(
        (delta) => {
            if (group) group.rotation.y += delta
        },
        { running: () => !!auctionPiece && !hidden }
    )

    async function revealPiece(ref: Object3D) {
        await tick()
        group?.reveal(ref)
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
            object.leave(animationContext.actionTimeline)
        }
    }

    onMount(() => {
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })
</script>

{#if auctionPiece}
    <T.Group {position}>
        <T
            is={AuctionPreviewGroup}
            args={[invalidate]}
            concealed={hidden}
            scale={gameSession.mobileView ? 0.7 : 0.8}
            oncreate={(ref: AuctionPreviewGroup) => {
                group = ref
                return () => {
                    ref.dispose()
                    group = undefined
                }
            }}
        >
            {#if isCube(auctionPiece)}
                <Cube3d
                    oncreate={(ref: Object3D) => {
                        void revealPiece(ref)
                    }}
                    position={[0, 0, 0]}
                    cube={auctionPiece}
                />
            {:else if isMayor(auctionPiece)}
                <TopHat
                    onloaded={(ref: Object3D) => {
                        void revealPiece(ref)
                    }}
                    position.y={0.15}
                    scale={0.46}
                />
            {:else if isCancelCube(auctionPiece)}
                <CancelCube
                    oncreate={(ref: Object3D) => {
                        void revealPiece(ref)
                    }}
                />
            {:else if isBarrier(auctionPiece)}
                <BarrierOne
                    onloaded={(ref: Object3D) => {
                        void revealPiece(ref)
                    }}
                    stripes={auctionPiece.value}
                    scale={1}
                />
            {:else if isRoof(auctionPiece)}
                <Roof
                    onloaded={(ref: Object3D) => {
                        void revealPiece(ref)
                    }}
                    roof={auctionPiece}
                    rotation.x={Math.PI / 2}
                />
            {/if}
        </T>
    </T.Group>
{/if}
