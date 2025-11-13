<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { GameAction } from '@tabletop/common'
    import TimeAgo from 'javascript-time-ago'
    import { fade } from 'svelte/transition'
    import { flip } from 'svelte/animate'
    import { quartIn } from 'svelte/easing'
    import { GameSessionMode, PlayerName } from '@tabletop/frontend-components'
    import { getDescriptionForAction } from '$lib/utils/actionDescriptions.js'

    const timeAgo = new TimeAgo('en-US')

    let gameSession = getContext('gameSession') as SolGameSession
    let unhighlightTimeout: ReturnType<typeof setTimeout>

    let reversedActions = $derived.by(() => {
        let actions = gameSession.actions

        if (gameSession.isViewingHistory) {
            actions = actions.filter(
                (action) => (action.index ?? 0) <= gameSession.history.actionIndex
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

    function highlight(action: GameAction) {}

    function unhighlight() {
        if (unhighlightTimeout) {
            clearTimeout(unhighlightTimeout)
        }
        unhighlightTimeout = setTimeout(() => {}, 150)
    }
</script>

<div
    class="rounded-lg border border-gray-700 text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px]"
>
    <div class="overflow-auto h-full">
        <Timeline class="ms-1">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -start-1.5 border border-white dark:border-gray-900 dark:bg-gray-700"
                ></div>
                <TimelineItem
                    title=""
                    class="mb-5"
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
                    <div
                        class="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -start-1.5 border border-white dark:border-gray-900 dark:bg-gray-700"
                    ></div>
                    <TimelineItem
                        title=""
                        class="mb-5"
                        date={action.createdAt ? timeAgo.format(action.createdAt) : 'sometime'}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {/if}
                            {getDescriptionForAction(action)}
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <div
                class="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -start-1.5 border border-white dark:border-gray-900 dark:bg-gray-700"
            ></div>
            <TimelineItem title="" class="mb-5" date={timeAgo.format(gameSession.game.createdAt)}>
                <p class="mt-1 text-left text-sm text-base font-normal text-gray-200">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>
