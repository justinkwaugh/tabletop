<script lang="ts">
    import { Timeline, TimelineItem } from 'flowbite-svelte'
    import { assertExists, type GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import ActionDescription from './ActionDescription.svelte'
    import CampaignLedger from './CampaignLedger.svelte'
    import MajorEventRow from './MajorEventRow.svelte'
    import TokenText from './TokenText.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { rowActorOf } from '$lib/model/actionDescription.js'
    import { quotedPromise } from '$lib/model/tribunalDeals.js'

    const timeAgo = createTimeAgo()

    let gameSession = getGameSession()

    let rows = $derived(gameSession.historyRows)
    let ending = $derived(gameSession.isViewingHistory ? undefined : gameSession.gameEndRow)
    let dropped = $derived(gameSession.droppedDeals)
    // The winner the game-end row names is their chip.
    let seats = $derived({ names: gameSession.historyNames, viewerId: gameSession.myPlayer?.id })

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
                            <MajorEventRow event={ending}
                                ><TokenText text={ending.sentence} {seats} /></MajorEventRow
                            >
                        {:else}
                            <p
                                class="mt-1 text-left text-sm text-base font-normal text-oath-heading"
                            >
                                The game has ended.
                            </p>
                        {/if}
                    </TimelineItem>
                </div>
                <!-- R-7.6.3-H1 — under the game-end row, the Tribunal deals still open, from the
                     ending's record: both parties, the round, and each promise. -->
                {#if dropped.length > 0}
                    <div>
                        {@render dot()}
                        <TimelineItem
                            timeClass="text-oath-text-muted dark:text-oath-text-muted"
                            title=""
                            class="timeline-item text-left mb-5"
                            date={timeAgo.format(gameSession.game.finishedAt)}
                        >
                            <p
                                class="mt-1 text-left text-sm text-base font-normal text-oath-text"
                                data-dropped-deals
                            >
                                Deals still open at the end, dropped:
                                {#each dropped as deal, index (deal.id)}
                                    <PlayerName playerId={deal.proposerPlayerId} />
                                    and
                                    <PlayerName playerId={deal.counterpartyPlayerId} />, round {deal.round}
                                    (<span class="whitespace-pre-wrap"
                                        >{quotedPromise(deal.proposerPromise)}</span
                                    >
                                    /
                                    <span class="whitespace-pre-wrap"
                                        >{quotedPromise(deal.counterpartyPromise)}</span
                                    >){index < dropped.length - 1 ? '; ' : ''}{/each}
                            </p>
                        </TimelineItem>
                    </div>
                {/if}
            {/if}
            {#each rows as row (row.action.id)}
                {@const actorId = rowActorOf(row.action)}
                {#if row.event}
                    <div>
                        {@render ringedDot(row.event.tone === 'danger')}
                        <TimelineItem
                            timeClass="text-oath-text-muted dark:text-oath-text-muted"
                            title=""
                            class="timeline-item text-left mb-5"
                            date={whenOf(row.action)}
                        >
                            {#if row.campaignSteps}
                                <MajorEventRow event={row.event}>
                                    <CampaignLedger steps={row.campaignSteps} />
                                </MajorEventRow>
                            {:else}
                                <MajorEventRow event={row.event} {actorId}>
                                    <ActionDescription
                                        action={row.action}
                                        campaign={row.campaign}
                                    />
                                </MajorEventRow>
                            {/if}
                        </TimelineItem>
                    </div>
                {/if}
                <!-- R-5.5 — the step that closes a Campaign stays a row below its card, as every step does. -->
                {#if !row.event || row.campaignSteps}
                    <div>
                        {@render dot()}
                        <TimelineItem
                            timeClass="text-oath-text-muted dark:text-oath-text-muted"
                            title=""
                            class="timeline-item text-left mb-5"
                            date={whenOf(row.action)}
                        >
                            <p class="mt-1 text-left text-sm text-base font-normal text-oath-text">
                                {#if actorId}
                                    <PlayerName playerId={actorId} />
                                {/if}
                                <ActionDescription action={row.action} campaign={row.campaign} />
                            </p>
                        </TimelineItem>
                    </div>
                {/if}
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
