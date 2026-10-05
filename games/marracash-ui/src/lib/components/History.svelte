<script lang="ts">
    import { onDestroy } from 'svelte'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { createTimeAgo } from '@tabletop/frontend-components'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import ActionDescription from './ActionDescription.svelte'
    import { isEndTurn } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()
    onDestroy(() => gameSession.highlightHistory(undefined))

    let reversedActions = $derived.by(() => {
        const reversed = gameSession.actions
            .filter((action) => !isEndTurn(action))
            .toReversed()
            .toSorted(
                (a, b) =>
                    (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())
            )
        return reversed
    })
</script>

<div
    class="rounded-lg border border-[#d9c7a3] text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-[#f4ead6] text-[#3d2f1f]"
>
    <div class="history overflow-auto h-full w-full">
        <Timeline class="ms-2 border-[#d9c7a3] dark:border-[#d9c7a3]">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-[#8a6a46] rounded-full mt-1.5 -start-1.5 border border-[#8a6a46] dark:border-[#8a6a46] dark:bg-[#8a6a46]"
                ></div>
                <TimelineItem
                    timeClass="text-[#7a6650] dark:text-[#7a6650]"
                    title=""
                    class="timeline-item text-left mb-5"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-[#7a6650]">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each reversedActions as action, i (action.id)}
                <div
                    role="button"
                    tabindex="0"
                    aria-pressed={gameSession.highlightedHistoryActionId === action.id}
                    in:fade={{ duration: 200, easing: quartIn }}
                    out:fade={{ duration: 50 }}
                    animate:flip={{ duration: 100 }}
                    use:hoverOrTap={{
                        hover: (active) =>
                            gameSession.highlightHistory(active ? action : undefined),
                        tap: () => gameSession.toggleHistoryHighlight(action)
                    }}
                >
                    <div
                        class="absolute w-3 h-3 bg-[#8a6a46] rounded-full mt-1.5 -start-1.5 border border-[#8a6a46] dark:border-[#8a6a46] dark:bg-[#8a6a46]"
                    ></div>
                    <TimelineItem
                        timeClass="text-[#7a6650] dark:text-[#7a6650]"
                        title=""
                        class="timeline-item text-left mb-5"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-[#3d2f1f]">
                            {#if action.playerId}
                                <PlayerTag playerId={action.playerId} />
                            {/if}
                            <ActionDescription {action} />
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <div
                class="absolute w-3 h-3 bg-[#8a6a46] rounded-full mt-1.5 -start-1.5 border border-[#8a6a46] dark:border-[#8a6a46] dark:bg-[#8a6a46]"
            ></div>
            <TimelineItem
                timeClass="text-[#7a6650] dark:text-[#7a6650]"
                title=""
                class="timeline-item text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-[#3d2f1f]">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>

<!-- Flowbite's TimelineItem draws its own dot and connector, which cannot take this table's tan;
     each entry draws its own dot instead. -->
<style>
    .history :global(.timeline-item > div) {
        display: none;
    }
</style>
