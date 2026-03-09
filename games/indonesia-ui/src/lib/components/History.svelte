<script lang="ts">
    import { tick } from 'svelte'
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { ActionSource, type GameAction } from '@tabletop/common'
    import { INDONESIA_REGION_BY_AREA_ID, isGrowCity, isIndonesiaNodeId } from '@tabletop/indonesia'
    import { ClockSolid } from 'flowbite-svelte-icons'
    import { getRegionName } from '$lib/definitions/regions.js'
    import { aggregateActions } from '$lib/utils/actionAggregator.js'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getGameSession()
    let scrollContainer: HTMLDivElement | undefined = $state()

    type PhaseHistoryMarker = {
        type: 'phase-marker'
        id: string
        phaseName: string
        start: number
    }

    type HistoryItem = GameAction | PhaseHistoryMarker

    const phaseLabels: Record<string, string> = {
        NewEra: 'New Era',
        BidForTurnOrder: 'Bid For Turn Order',
        Mergers: 'Mergers',
        Acquisitions: 'Acquisitions',
        ResearchAndDevelopment: 'Research and Development',
        Operations: 'Operations',
        CityGrowth: 'City Growth'
    }

    function isPhaseHistoryMarker(item: HistoryItem): item is PhaseHistoryMarker {
        return item.type === 'phase-marker'
    }

    let historyItems = $derived.by(() => {
        const aggregatedActions = Array.from(aggregateActions(gameSession.actions))
        const phaseSeries = [...gameSession.gameState.phaseManager.series].sort(
            (left, right) => left.start - right.start
        )

        const items: HistoryItem[] = []
        let nextPhaseIndex = 0

        for (const action of aggregatedActions) {
            const actionIndex = action.index ?? Number.MAX_SAFE_INTEGER
            while (
                nextPhaseIndex < phaseSeries.length &&
                phaseSeries[nextPhaseIndex] &&
                phaseSeries[nextPhaseIndex].start <= actionIndex
            ) {
                const phase = phaseSeries[nextPhaseIndex]
                items.push({
                    type: 'phase-marker',
                    id: `phase-${phase.name}-${phase.start}`,
                    phaseName: phaseLabels[phase.name] ?? phase.name,
                    start: phase.start
                })
                nextPhaseIndex += 1
            }
            items.push(action)
        }

        while (nextPhaseIndex < phaseSeries.length) {
            const phase = phaseSeries[nextPhaseIndex]
            items.push({
                type: 'phase-marker',
                id: `phase-${phase.name}-${phase.start}`,
                phaseName: phaseLabels[phase.name] ?? phase.name,
                start: phase.start
            })
            nextPhaseIndex += 1
        }

        return items.toReversed()
    })

    function cityRegionNameForAction(action: GameAction): string | undefined {
        if (!isGrowCity(action)) {
            return undefined
        }

        const city = gameSession.gameState.board.cities.find((entry) => entry.id === action.cityId)
        if (!city) {
            return undefined
        }

        if (!isIndonesiaNodeId(city.area)) {
            return undefined
        }

        const regionId = INDONESIA_REGION_BY_AREA_ID[city.area]
        if (!regionId) {
            return undefined
        }

        return getRegionName(regionId)
    }

    function actionTimeLabel(action: GameAction): string {
        return action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'
    }

    function canJumpToHistoryAction(action: GameAction): boolean {
        return action.source !== ActionSource.System && typeof action.index === 'number'
    }

    async function jumpToHistoryAction(action: GameAction) {
        if (!canJumpToHistoryAction(action)) {
            return
        }
        await gameSession.history.goToActionIndex(action.index as number)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }
</script>

<div
    class="border-y-2 border-[#7a5d3f] bg-[#f7f3ef] text-center py-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px]"
>
    <div class="overflow-auto h-full w-full" bind:this={scrollContainer}>
        <Timeline class="history-timeline ms-2 border-[#ad9c80]">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
                ></div>
                <TimelineItem
                    timeClass="text-[#7a5d3f]"
                    title=""
                    class="timeline-item px-2 text-left mb-5"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-[#442c19]">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each historyItems as item (item.id)}
                {#if isPhaseHistoryMarker(item)}
                    <div
                        in:fade={{ duration: 200, easing: quartIn }}
                        out:fade={{ duration: 50 }}
                        class="relative left-[calc(-0.5rem-1px)] mb-4 flex w-[calc(100%+0.5rem+1px)] items-center justify-center border-y-2 border-[#7a5d3f] bg-[#ede2dc] py-2"
                    >
                        <div class="w-full text-center text-sm font-medium uppercase tracking-[0.08em] text-[#7a5d3f]">
                            ↑ {item.phaseName} ↑
                        </div>
                    </div>
                {:else}
                <div
                    role="button"
                    tabindex={-1}
                    onfocus={() => {}}
                    onkeypress={() => {}}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    class="px-2"
                >
                    <div
                        class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
                    ></div>
                    <TimelineItem
                        timeClass="text-[#7a5d3f]"
                        title=""
                        class="timeline-item text-left mb-5"
                        date=""
                    >
                        <span class="group mb-1 inline-flex items-center gap-2 text-xs text-[#7a5d3f]">
                            <span>{actionTimeLabel(item)}</span>
                            {#if canJumpToHistoryAction(item)}
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-0 rounded px-0 py-0 text-[#7a5d3f] opacity-100 transition-colors hover:bg-[#ad9c80]/12 hover:text-[#5e3f27] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ad9c80]/70"
                                    aria-label="Jump to this action in history"
                                    title="Jump to this action in history"
                                    onclick={async () => await jumpToHistoryAction(item)}
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
                        <p class="mt-1 text-left text-sm text-base font-normal text-[#442c19]">
                            <ActionDescription
                                action={item}
                                justify="start"
                                fullWidth={false}
                                showActor={true}
                                cityRegionName={cityRegionNameForAction(item)}
                            />
                        </p>
                    </TimelineItem>
                </div>
                {/if}
            {/each}
            <div
                class="absolute w-3 h-3 bg-[#ad9c80] rounded-full mt-1.5 -start-1.5 border dark:border-[#ad9c80] dark:bg-[#ad9c80]"
            ></div>
            <TimelineItem
                timeClass="text-[#7a5d3f]"
                title=""
                class="timeline-item px-2 text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-[#442c19]">
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

    :global(.history-timeline > ol) {
        border-color: #ad9c80;
    }
</style>
