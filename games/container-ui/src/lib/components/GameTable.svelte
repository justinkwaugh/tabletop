<script lang="ts">
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import { buildBoardLayout } from '$lib/definitions/boardLayout.js'

    import type { ContainerGameSession } from '$lib/model/session.svelte'
    import type { HydratedContainerGameState, ContainerGameState } from '@tabletop/container'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<ContainerGameState, HydratedContainerGameState> } = $props()
    setGameSession(gameSession as ContainerGameSession)

    let scalingWrapper: any = $state(null)

    const boardLayout = $derived.by(() =>
        buildBoardLayout(gameSession.gameState.turnManager.turnOrder, {
            hasOffshore: !!gameSession.gameState.investmentBank
        })
    )

    const centerIslandRect = $derived(boardLayout.islandRect)
    const playerBoardFocusTargets = $derived.by(() => {
        const playerById = new Map(gameSession.game.players.map((player) => [player.id, player]))

        return boardLayout.playerBoardSeats
            .map((seat) => {
                const player = playerById.get(seat.playerId)
                if (!player) {
                    return null
                }

                return {
                    playerId: player.id,
                    label: player.name,
                    color: gameSession.colors.getPlayerUiColor(player.id),
                    rect: {
                        x: seat.x,
                        y: seat.y,
                        width: seat.width,
                        height: seat.height
                    }
                }
            })
            .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    })
</script>

<!-- Full Height and Width with 8px padding-->
<div class="bg-[#444a78]" style="--chat-height-offset: 0px;">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                   <History />
                {/snippet}
            </DefaultSideContent>
        {/snippet}
        {#snippet gameContent()}
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                {#if gameSession.gameState.result}
                    <!-- <GameEndPanel /> -->
                {:else}
                    <div class="flex flex-row flex-wrap gap-2 px-2 pb-2">
                        <button
                            class="rounded-md border border-[#252a4a] bg-black/20 px-3 py-1 text-[0.78rem] uppercase tracking-[0.08em] text-[#d7def7]"
                            onclick={() => scalingWrapper?.fitToContent({ animate: true })}
                        >
                            Full
                        </button>
                        <button
                            class="rounded-md border border-[#252a4a] bg-black/30 px-3 py-1 text-[0.78rem] uppercase tracking-[0.08em] text-[#d7def7]"
                            onclick={() =>
                                scalingWrapper?.focusRect(centerIslandRect, {
                                    padding: 24,
                                    maxScale: 1,
                                    animate: true
                                })}
                        >
                            Island
                        </button>
                        {#each playerBoardFocusTargets as target (target.playerId)}
                            <button
                                class="h-9 w-9 rounded-md border border-[#252a4a]"
                                style={`background:${target.color};`}
                                aria-label={target.label}
                                title={target.label}
                                onclick={() =>
                                    scalingWrapper?.focusRect(target.rect, {
                                        padding: 24,
                                        maxScale: 1,
                                        animate: true
                                    })}
                            ></button>
                        {/each}
                    </div>
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper bind:this={scalingWrapper} justify="center" controls="bottom-left">
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
