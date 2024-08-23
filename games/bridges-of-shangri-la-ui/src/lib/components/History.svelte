<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { BridgesGameSession } from '$lib/model/BridgesGameSession.svelte'
    import {
        isPass,
        isPlaceMaster,
        isRecruitStudents,
        isBeginJourney
    } from '@tabletop/bridges-of-shangri-la'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode, HistoryControls } from '@tabletop/frontend-components'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as BridgesGameSession
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let reversedActions = $derived.by(() => {
        let actions = gameSession.actions

        if (gameSession.mode === GameSessionMode.History) {
            actions = actions.filter(
                (action) => (action.index ?? 0) <= gameSession.currentHistoryIndex
            )
        }

        const reversed = actions
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    function getDescriptionForAction(action: GameAction) {
        switch (true) {
            case isPlaceMaster(action):
                return `placed ${gameSession.nameForMasterType(action.placement.masterType, true)} master`
            case isRecruitStudents(action):
                const skipInfo = action.metadata?.forceSkip
                    ? ' but was unable to recruit another'
                    : ''
                return `placed ${gameSession.nameForMasterType(action.placement.masterType, true)} student${skipInfo}`
            case isBeginJourney(action):
                return 'journied from one village to another'
            case isPass(action):
                if (action.metadata?.recruiting) {
                    return 'declined to recruit a second student'
                }
                return 'passed'
            default:
                return action.type
        }
    }

    function highlight(action: GameAction) {
        if (isPlaceMaster(action) || isRecruitStudents(action)) {
            if (unhighlightTimeout) {
                clearTimeout(unhighlightTimeout)
            }

            gameSession.highlightVillages([action.placement.village])
        } else if (isBeginJourney(action)) {
            if (unhighlightTimeout) {
                clearTimeout(unhighlightTimeout)
            }

            gameSession.highlightVillages([action.from, action.to])
        }
    }

    function unhighlight() {
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {
            gameSession.clearHighlightedVillages()
        }, 150)
    }
</script>

<div
    class="rounded-lg border border-gray-700 text-center p-2 h-full flex flex-col justify-center items-left overflow-hidden min-h-[300px]"
>
    <h1 class="text-xl font-light text-white pb-1">History</h1>
    <HistoryControls />
    <div class="overflow-scroll h-full">
        <Timeline class="ms-1">
            {#if gameSession.game.finishedAt && gameSession.mode !== GameSessionMode.History}
                <TimelineItem
                    classTime=""
                    classLi="mb-5 text-left"
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
                        classTime=""
                        classLi="mb-5 text-left"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            {#if action.playerId}
                                <span
                                    class="rounded px-2 {gameSession.getPlayerBgColor(
                                        action.playerId
                                    )} font-medium {gameSession.getPlayerTextColor(
                                        action.playerId
                                    )}">{gameSession.getPlayerName(action.playerId)}</span
                                >
                            {/if}
                            {getDescriptionForAction(action)}
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <TimelineItem
                classTime=""
                classLi="mb-5 text-left"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>
