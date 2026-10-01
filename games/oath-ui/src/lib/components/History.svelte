<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { assertExists, type GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()

    let reversedActions = $derived(gameSession.actions.toReversed())

    // The engine stamps every action it applies.
    function whenOf(action: GameAction): string {
        assertExists(action.createdAt, `Action ${action.id} was never applied`)
        return timeAgo.format(action.createdAt)
    }
</script>

<div
    class="history rounded-lg border border-oath-frame text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-oath-surface"
>
    <div class="overflow-auto h-full w-full">
        <Timeline class="ms-2 border-oath-divider dark:border-oath-divider">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div
                    class="absolute w-3 h-3 bg-oath-heading rounded-full mt-1.5 -start-1.5 border border-oath-heading dark:border-oath-heading dark:bg-oath-heading"
                ></div>
                <TimelineItem
                    timeClass="text-oath-text-muted dark:text-oath-text-muted"
                    title=""
                    class="timeline-item text-left mb-5"
                    date={timeAgo.format(gameSession.game.finishedAt)}
                >
                    <p class="mt-1 text-left text-sm text-base font-normal text-oath-heading">
                        The game has ended.
                    </p>
                </TimelineItem>
            {/if}
            {#each reversedActions as action (action.id)}
                <div>
                    <div
                        class="absolute w-3 h-3 bg-oath-heading rounded-full mt-1.5 -start-1.5 border border-oath-heading dark:border-oath-heading dark:bg-oath-heading"
                    ></div>
                    <TimelineItem
                        timeClass="text-oath-text-muted dark:text-oath-text-muted"
                        title=""
                        class="timeline-item text-left mb-5"
                        date={whenOf(action)}
                    >
                        <p class="mt-1 text-left text-sm text-base font-normal text-oath-text">
                            {#if action.playerId}
                                <PlayerName playerId={action.playerId} />
                            {/if}
                            <ActionDescription {action} />
                        </p>
                    </TimelineItem>
                </div>
            {/each}
            <div
                class="absolute w-3 h-3 bg-oath-heading rounded-full mt-1.5 -start-1.5 border border-oath-heading dark:border-oath-heading dark:bg-oath-heading"
            ></div>
            <TimelineItem
                timeClass="text-oath-text-muted dark:text-oath-text-muted"
                title=""
                class="timeline-item text-left mb-5"
                date={timeAgo.format(gameSession.game.createdAt)}
            >
                <p class="mt-1 text-left text-sm text-base font-normal text-oath-text">
                    The game was started
                </p>
            </TimelineItem>
        </Timeline>
    </div>
</div>

<!-- flowbite-svelte's TimelineItem renders an extra marker div; hidden here. -->
<style>
    .history :global(.timeline-item > div) {
        display: none;
    }
</style>
