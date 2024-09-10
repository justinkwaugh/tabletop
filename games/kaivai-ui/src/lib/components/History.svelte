<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { ActionType, isFish, isScoreIsland } from '@tabletop/kaivai'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode } from '@tabletop/frontend-components'
    import { getHistoryDescriptionForAction } from '$lib/utils/historyDescriptions'
    import PlayerName from './PlayerName.svelte'
    import FishingResults from './FishingResults.svelte'
    import ScoringResults from './ScoringResults.svelte'

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
            .filter((action) => action.type !== ActionType.PlaceScoringBid)
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
    <div class="overflow-scroll h-full">
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
                            {getHistoryDescriptionForAction(action)}
                            {#if isFish(action)}
                                <FishingResults {action} />
                            {/if}
                            {#if isScoreIsland(action)}
                                <ScoringResults {action} />
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
