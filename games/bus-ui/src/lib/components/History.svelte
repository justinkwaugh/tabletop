<script lang="ts">
    import { tick } from 'svelte'
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { ClockSolid } from 'flowbite-svelte-icons'
    import { PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from './ActionDescription.svelte'
    import { isAggregatedBusAction } from '$lib/aggregates/aggregatedBusAction.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { aggregateActions } from '$lib/utils/actionAggregator.js'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getGameSession()
    let scrollContainer: HTMLDivElement | undefined = $state()

    let reversedActions = $derived.by(() => {
        const aggregated = Array.from(aggregateActions(gameSession.actions))
        const reversed = aggregated
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })

    function actionTimeLabel(action: GameAction): string {
        return action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'
    }

    function canJumpToHistoryAction(action: GameAction): boolean {
        return action.source !== ActionSource.System && typeof action.index === 'number'
    }

    function replayRangeForAction(action: GameAction): { startIndex: number; endIndex: number } | null {
        if (!canJumpToHistoryAction(action)) {
            return null
        }

        if (isAggregatedBusAction(action)) {
            return {
                startIndex: action.index as number,
                endIndex: action.lastActionIndex ?? (action.index as number)
            }
        }

        return {
            startIndex: action.index as number,
            endIndex: action.index as number
        }
    }

    async function jumpToHistoryAction(action: GameAction) {
        if (!canJumpToHistoryAction(action)) {
            return
        }
        await gameSession.history.goToActionIndex(action.index as number)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }

    async function replayHistoryAction(action: GameAction) {
        const replayRange = replayRangeForAction(action)
        if (!replayRange) {
            return
        }

        await gameSession.history.replayRange(replayRange.startIndex, replayRange.endIndex)
    }
</script>

<div
    class="rounded-lg border border-gray-500 text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-black"
>
    <div class="overflow-auto h-full w-full" bind:this={scrollContainer}>
        <Timeline class="ms-2 dark:border-gray-500">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-gray-800 rounded-full mt-1.5 -start-1.5 border dark:border-gray-500 dark:bg-black"
                ></div>
                <TimelineItem
                    timeClass="dark:text-gray-400"
                    title=""
                    class="timeline-item text-left mb-5"
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
                    tabindex={canJumpToHistoryAction(action) ? 0 : -1}
                    onclick={async () => await replayHistoryAction(action)}
                    onkeydown={async (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                            return
                        }
                        event.preventDefault()
                        await replayHistoryAction(action)
                    }}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                >
                    <div
                        class="absolute w-3 h-3 bg-gray-800 rounded-full mt-1.5 -start-1.5 border dark:border-gray-500 dark:bg-black"
                    ></div>
                    <TimelineItem
                        timeClass="dark:text-gray-500"
                        title=""
                        class="timeline-item text-left mb-5"
                        date=""
                    >
                        <span class="group mb-1 inline-flex items-center gap-1 text-xs text-gray-400">
                            <span>{actionTimeLabel(action)}</span>
                            {#if canJumpToHistoryAction(action)}
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-0 rounded px-0 py-0 text-gray-400 opacity-100 transition-colors hover:bg-gray-700/20 hover:text-gray-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70"
                                    aria-label="Jump to this action in history"
                                    title="Jump to this action in history"
                                    onclick={async (event) => {
                                        event.stopPropagation()
                                        await jumpToHistoryAction(action)
                                    }}
                                >
                                    <svg
                                        class="w-[8px] h-[8px] self-center"
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke="currentColor"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="m9 5 7 7-7 7"
                                        ></path>
                                    </svg>
                                    <ClockSolid class="w-[12px] h-[12px] -ml-[2px] text-current" />
                                </button>
                            {/if}
                        </span>
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {/if}
                            <ActionDescription {action} justify="start" />
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <div
                class="absolute w-3 h-3 bg-gray-800 rounded-full mt-1.5 -start-1.5 border dark:border-gray-500 dark:bg-black"
            ></div>
            <TimelineItem
                timeClass="dark:text-gray-500"
                title=""
                class="timeline-item text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>

<!--  fixes a styling issue with timeline-item -->
<style>
    :global(.timeline-item > div) {
        display: none;
    }
</style>
