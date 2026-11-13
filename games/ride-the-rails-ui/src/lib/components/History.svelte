<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import { isCallGameAction } from '@tabletop/common'
    import { isEndRound } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'
    import {
        historyEntries,
        jumpTarget,
        openEntryKey,
        phaseHeading,
        replayRange,
        turnDescription,
        type HistoryEntry
    } from '$lib/utils/history.js'
    import Description from './Description.svelte'
    import SeatDot from './panel/SeatDot.svelte'

    const gameSession = getGameSession()

    // `actions` and the managers follow the displayed state, so in History View the list ends at
    // the displayed step (docs/game-ui-layout.md, History description).
    const entries = $derived(
        historyEntries(
            gameSession.actions,
            gameSession.gameState.roundManager.series,
            gameSession.gameState.phaseManager.series
        )
    )

    // A replay walks the displayed state through the entry; the list holds still meanwhile.
    let frozen: HistoryEntry[] | undefined = $state()
    const shown = $derived(frozen ?? entries)
    const openKey = $derived(openEntryKey(shown))

    async function jump(entry: HistoryEntry) {
        const target = jumpTarget(entry)
        if (target && !frozen) {
            await gameSession.history.goToActionIndex(target.actionIndex, { exact: target.exact })
        }
    }

    async function replay(entry: HistoryEntry) {
        const range = replayRange(entry)
        if (!range || frozen) {
            return
        }
        frozen = entries
        try {
            await gameSession.history.replayRange(range.startIndex, range.endIndex)
        } finally {
            frozen = undefined
        }
    }
</script>

<!-- Oldest first, newest at the foot. The reversed column keeps the scroll pinned to the foot as
     entries arrive. -->
<div
    class="flex h-full min-h-[300px] flex-col-reverse overflow-y-auto rounded-lg border border-rtr-line bg-rtr-table/60 p-2 text-left text-[13px] leading-snug text-rtr-ink"
>
    <ol class="flex flex-col gap-1.5" aria-label="Game history">
        {#each shown as entry (entry.key)}
            {#if entry.kind === 'phase'}
                <li>
                    <button
                        type="button"
                        class="interstitial jumpable"
                        title="Jump to the start of this phase"
                        disabled={!!frozen}
                        onclick={() => jump(entry)}>{phaseHeading(entry)}</button
                    >
                </li>
            {:else if entry.kind === 'milestone'}
                <li>
                    {#if isCallGameAction(entry.action)}
                        <div class="interstitial">
                            <CalledGameDescription action={entry.action} />
                        </div>
                    {:else if isEndRound(entry.action)}
                        <button
                            type="button"
                            class="interstitial jumpable"
                            title="Jump to the new turn order"
                            disabled={!!frozen}
                            onclick={() => jump(entry)}
                            ><Description description={describeAction(entry.action)} /></button
                        >
                    {:else}
                        <div class="interstitial">
                            <Description description={describeAction(entry.action)} />
                        </div>
                    {/if}
                </li>
            {:else}
                {@const canReplay = replayRange(entry) !== undefined}
                <li
                    class="flex items-start gap-2 rounded-md border border-rtr-line bg-rtr-panel px-2 py-1.5"
                    class:open={entry.key === openKey}
                >
                    <span class="mt-[3px]"><SeatDot playerId={entry.playerId} /></span>
                    <span class="min-w-0 flex-1">
                        <Description description={turnDescription(entry)} />
                    </span>
                    <span class="flex shrink-0 items-center gap-1 text-[11px] text-rtr-ink-muted">
                        <button
                            type="button"
                            class="link"
                            disabled={!!frozen}
                            onclick={() => jump(entry)}>jump</button
                        >
                        {#if canReplay}
                            <span aria-hidden="true">·</span>
                            <button
                                type="button"
                                class="link"
                                disabled={!!frozen}
                                onclick={() => replay(entry)}>replay</button
                            >
                        {/if}
                    </span>
                </li>
            {/if}
        {/each}
    </ol>
</div>

<style>
    .interstitial {
        display: block;
        width: 100%;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid var(--rtr-line);
        color: var(--rtr-ink-muted);
        font-size: 11.5px;
        letter-spacing: 0.06em;
        text-align: center;
        text-transform: uppercase;
    }

    .jumpable:not(:disabled) {
        cursor: pointer;
    }

    .jumpable:not(:disabled):hover,
    .jumpable:focus-visible {
        color: var(--rtr-ink);
    }

    .open {
        box-shadow: inset 3px 0 0 var(--rtr-accent);
    }

    .link {
        padding: 2px 0;
        cursor: pointer;
    }

    .link:hover,
    .link:focus-visible {
        color: var(--rtr-ink);
        text-decoration: underline;
    }

    @media (max-width: 639px) {
        /* A finger-sized press on a phone. */
        .link {
            padding: 6px 3px;
        }
    }

    .link:disabled {
        cursor: default;
        text-decoration: none;
    }
</style>
