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
    type ReplayUiState = {
        activeActionId: string
        frozenActions: GameAction[]
        frozenScrollTop: number
        showFinishedMarker: boolean
    }
    let replayUiState = $state<ReplayUiState | null>(null)

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
    let displayedActions = $derived(replayUiState ? replayUiState.frozenActions : reversedActions)
    let showFinishedMarker = $derived(
        replayUiState
            ? replayUiState.showFinishedMarker
            : !!(gameSession.game.finishedAt && !gameSession.isViewingHistory)
    )

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
        if (!canJumpToHistoryAction(action) || replayUiState) {
            return
        }
        await gameSession.history.goToActionIndex(action.index as number)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }

    async function replayHistoryAction(action: GameAction) {
        if (replayUiState) {
            return
        }

        const replayRange = replayRangeForAction(action)
        if (!replayRange) {
            return
        }

        const nextReplayUiState: ReplayUiState = {
            activeActionId: action.id,
            frozenActions: displayedActions.slice(),
            frozenScrollTop: scrollContainer?.scrollTop ?? 0,
            showFinishedMarker
        }
        replayUiState = nextReplayUiState
        await tick()
        scrollContainer?.scrollTo({ top: nextReplayUiState.frozenScrollTop, behavior: 'auto' })

        try {
            await gameSession.history.replayRange(replayRange.startIndex, replayRange.endIndex)
        } finally {
            replayUiState = null
            await tick()
            scrollContainer?.scrollTo({ top: nextReplayUiState.frozenScrollTop, behavior: 'auto' })
        }
    }
</script>

<div
    class="relative rounded-lg border border-gray-500 text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-black"
>
    <div class={`${replayUiState ? 'overflow-hidden' : 'overflow-auto'} h-full w-full`} bind:this={scrollContainer}>
        <Timeline class="ms-2 dark:border-gray-500">
            {#if showFinishedMarker}
                <div
                    class="absolute w-3 h-3 bg-gray-800 rounded-full mt-1.5 -start-1.5 border dark:border-gray-500 dark:bg-black"
                ></div>
                <TimelineItem
                    timeClass="dark:text-gray-400"
                    title=""
                    class="timeline-item text-left mb-5"
                    date={timeAgo.format(gameSession.game.finishedAt!)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each displayedActions as action, i (action.id)}
                <div
                    role="button"
                    tabindex={canJumpToHistoryAction(action) && !replayUiState ? 0 : -1}
                    aria-disabled={replayUiState ? 'true' : undefined}
                    class={`relative rounded-md pb-2 transition-colors ${
                        replayUiState?.activeActionId === action.id
                            ? 'bg-gray-800/70 ring-1 ring-gray-500/80'
                            : replayUiState
                              ? 'opacity-60'
                              : ''
                    }`}
                    onclick={async () => await replayHistoryAction(action)}
                    onkeydown={async (event) => {
                        if (replayUiState) {
                            return
                        }
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
                    {#if replayUiState?.activeActionId === action.id}
                        <div
                            class="pointer-events-none absolute right-2 top-1 z-10 rounded border border-gray-600 bg-gray-950/90 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gray-300"
                        >
                            Replaying
                        </div>
                    {/if}
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
                                    class="inline-flex items-center gap-0 rounded px-0 py-0 text-gray-400 opacity-100 transition-colors hover:bg-gray-700/20 hover:text-gray-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/70 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                    aria-label="Jump to this action in history"
                                    title="Jump to this action in history"
                                    disabled={!!replayUiState}
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
