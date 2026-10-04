<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { assertExists, type GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from './ActionDescription.svelte'
    import MajorEventRow from './MajorEventRow.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { rowActorOf } from '$lib/model/actionDescription.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()

    let rows = $derived(gameSession.historyRows)
    let ending = $derived(gameSession.isViewingHistory ? undefined : gameSession.gameEndRow)

    // The engine stamps every action it applies.
    function whenOf(action: GameAction): string {
        assertExists(action.createdAt, `Action ${action.id} was never applied`)
        return timeAgo.format(action.createdAt)
    }
</script>

{#snippet dot()}
    <div
        class="absolute w-3 h-3 bg-oath-heading rounded-full mt-1.5 -start-1.5 border border-oath-heading dark:border-oath-heading dark:bg-oath-heading"
    ></div>
{/snippet}

{#snippet ringedDot(danger: boolean)}
    <div
        class="absolute mt-0.5 -start-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-oath-surface-raised {danger
            ? 'border-oath-danger'
            : 'border-oath-heading'}"
    >
        <span class="h-2 w-2 rounded-full {danger ? 'bg-oath-danger' : 'bg-oath-heading'}"></span>
    </div>
{/snippet}

<div
    class="history rounded-lg border border-oath-frame text-center p-2 h-full flex flex-col justify-start items-start overflow-hidden min-h-[300px] bg-oath-surface"
>
    <div class="overflow-auto h-full w-full">
        <Timeline class="ms-2 border-oath-divider dark:border-oath-divider">
            {#if gameSession.game.finishedAt && !gameSession.isViewingHistory}
                <div>
                    {#if ending}{@render ringedDot(false)}{:else}{@render dot()}{/if}
                    <TimelineItem
                        timeClass="text-oath-text-muted dark:text-oath-text-muted"
                        title=""
                        class="timeline-item text-left mb-5"
                        date={timeAgo.format(gameSession.game.finishedAt)}
                    >
                        {#if ending}
                            <MajorEventRow event={ending}>{ending.sentence}</MajorEventRow>
                        {:else}
                            <p
                                class="mt-1 text-left text-sm text-base font-normal text-oath-heading"
                            >
                                The game has ended.
                            </p>
                        {/if}
                    </TimelineItem>
                </div>
            {/if}
            {#each rows as row (row.action.id)}
                {@const actorId = rowActorOf(row.action)}
                <div>
                    {#if row.event}{@render ringedDot(
                            row.event.tone === 'danger'
                        )}{:else}{@render dot()}{/if}
                    <TimelineItem
                        timeClass="text-oath-text-muted dark:text-oath-text-muted"
                        title=""
                        class="timeline-item text-left mb-5"
                        date={whenOf(row.action)}
                    >
                        {#if row.event}
                            <MajorEventRow event={row.event} {actorId}>
                                <ActionDescription action={row.action} />
                            </MajorEventRow>
                        {:else}
                            <p class="mt-1 text-left text-sm text-base font-normal text-oath-text">
                                {#if actorId}
                                    <PlayerName playerId={actorId} />
                                {/if}
                                <ActionDescription action={row.action} />
                            </p>
                        {/if}
                    </TimelineItem>
                </div>
            {/each}
            {@render dot()}
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
