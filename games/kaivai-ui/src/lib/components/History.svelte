<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import {
        ActionType,
        isCelebrate,
        isChooseScoringIsland,
        isDeliver,
        isFish,
        isMove,
        isMoveGod,
        isPass,
        isScoreHuts,
        isScoreIsland,
        PassReason
    } from '@tabletop/kaivai'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import FishingResults from './FishingResults.svelte'
    import IslandScoringResults from './IslandScoringResults.svelte'
    import HutScoringResults from './HutScoringResults.svelte'
    import CelebrateResults from './CelebrateResults.svelte'
    import MoveGodResults from './MoveGodResults.svelte'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let reversedActions = $derived.by(() => {
        let actions = gameSession.actions

        if (gameSession.mode === GameSessionMode.History) {
            actions = actions.filter(
                (action) => (action.index ?? 0) <= gameSession.currentHistoryIndex
            )
        }

        const reversed = actions
            .filter(
                (action) =>
                    action.type !== ActionType.PlaceScoringBid &&
                    (!isPass(action) || action.metadata?.reason === PassReason.DoneActions) &&
                    (!isChooseScoringIsland(action) || action.playerId)
            )
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    function highlight(action: GameAction) {}

    function unhighlight() {
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {}, 150)
    }

    const dieCircleSize = [
        'w-[24px] h-[24px]',
        'w-[21px] h-[21px]',
        'w-[18px] h-[18px]',
        'w-[15px] h-[15px]'
    ]
</script>

<div
    class="rounded-lg border-2 border-[#634a11] text-center p-2 h-full flex flex-col justify-start items-left overflow-hidden bg-[#302408]"
>
    <div class="overflow-auto h-full">
        <Timeline class="ms-1 dark:border-[#cabb7a]">
            {#if gameSession.game.finishedAt && gameSession.mode !== GameSessionMode.History}
                <TimelineItem
                    classTime="dark:text-[#8d794d]"
                    classLi="mb-5 text-left"
                    classDiv="dark:bg-[#cabb7a] border-[#cabb7a]"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each reversedActions as action, i (action.id)}
                <div
                    role="button"
                    tabindex={-1}
                    onfocus={() => {}}
                    onkeypress={() => {}}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                    onmouseover={() => highlight(action)}
                    onmouseleave={() => unhighlight()}
                >
                    <TimelineItem
                        classTime="dark:text-[#8d794d]"
                        classLi="mb-5 text-left"
                        classDiv="dark:bg-[#cabb7a] border-[#cabb7a]"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {/if}
                            {getHistoryDescriptionForAction(
                                action,
                                action.playerId === gameSession.myPlayer?.id
                            )}{#if isMove(action) && action.metadata?.playerSunk}
                                sunk <PlayerName
                                    playerId={action.metadata.playerSunk}
                                    possessive={true}
                                /> boat for a loss of {action.metadata.gloryLost} glory
                            {/if}{#if isDeliver(action) && (action.metadata?.numSold ?? 0) > 0},
                                selling {action.metadata?.numSold} fish for {action.metadata
                                    ?.earnings}
                            {/if}
                            {#if isFish(action)}
                                <FishingResults {action} justify={'left'} />
                            {/if}
                            {#if isScoreIsland(action)}
                                <IslandScoringResults {action} history={true} />
                            {/if}
                            {#if isScoreHuts(action)}
                                <HutScoringResults {action} justify={'left'} />
                            {/if}
                            {#if isCelebrate(action)}
                                <CelebrateResults {action} justify={'left'} />
                            {/if}
                            {#if isMoveGod(action)}
                                <MoveGodResults {action} justify={'left'} />
                            {/if}
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <TimelineItem
                classTime="dark:text-[#8d794d]"
                classLi="mb-5 text-left"
                classDiv="dark:bg-[#cabb7a] border-[#cabb7a]"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>
