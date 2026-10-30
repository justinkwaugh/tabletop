<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnPanel } from '$lib/model/turnPanel.js'
    import { repairsPanel } from '$lib/model/repairsPanel.js'
    import { repairsRow } from '$lib/model/repairsRow.js'
    import { scoreView } from '$lib/model/score.js'
    import { waitingView } from '$lib/model/waitingView.js'
    import RepairsPanel from './RepairsPanel.svelte'
    import RepairsRow from './RepairsRow.svelte'
    import ScoreTable from './ScoreTable.svelte'
    import ShareBlock from './ShareBlock.svelte'
    import StatusStrip from './StatusStrip.svelte'
    import TurnHeader from './TurnHeader.svelte'
    import TurnPieces from './TurnPieces.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const panel = $derived(turnPanel(gameSession))

    // R-6.2: the action area becomes the score once the game has ended.
    const score = $derived(scoreView(gameSession.gameState))

    // R-4.3: every seat's bill while a Repairs is being paid, from the displayed state.
    const row = $derived(repairsRow(gameSession.gameState, gameSession.actions))

    // R-4.3, R-X.1: the deciding short seat's own panel.
    const repairs = $derived.by(() => {
        const draft = gameSession.repairsDraft
        const viewerId = gameSession.decidingPlayerId
        return draft === undefined || row === undefined || viewerId === undefined
            ? undefined
            : repairsPanel(draft, row.placingPlayerId, viewerId)
    })

    // Contract, "Watching": every seat without a decision of its own.
    const waiting = $derived(
        waitingView(gameSession.gameState, gameSession.actions, gameSession.myPlayer?.id)
    )
</script>

<div class="bg-pp-panel text-pp-text">
    <TurnHeader />
    <StatusStrip />
    {#if score}
        <div class="action-area border-b border-pp-halo/40 px-4 pt-2.5 pb-3 max-sm:px-2">
            <ScoreTable {score} />
        </div>
    {:else if repairs && row}
        <div class="action-area border-b border-pp-halo/40 px-4 pt-2.5 pb-3 max-sm:px-2">
            <!-- A phone shows the deciding seat's ring and the turn's dashed chip in the seat strip. -->
            <div class="mb-2 max-sm:hidden">
                <RepairsRow {row} />
            </div>
            <RepairsPanel panel={repairs} />
        </div>
    {:else if panel}
        <div class="action-area border-b border-pp-halo/40 px-4 pt-2.5 pb-3 max-sm:px-2">
            <p class="mb-2 text-[15px] max-sm:mb-1 max-sm:text-[13.5px] max-sm:leading-snug">
                <b class="font-semibold">{panel.prompt.lead}</b>
                {panel.prompt.text}
                {#if panel.prompt.note}
                    <!-- A phone keeps the action area to the decision; the share block tells the lock. -->
                    <span class="ml-2 text-[13px] text-pp-muted max-sm:hidden"
                        >{panel.prompt.note}</span
                    >
                {/if}
            </p>
            <div class="flex flex-wrap items-stretch gap-4 max-sm:flex-col max-sm:gap-2">
                <TurnPieces {panel} />
                <ShareBlock shares={panel.shares} />
            </div>
        </div>
    {:else if waiting}
        <div class="action-area border-b border-pp-halo/40 px-4 pt-2.5 pb-3 max-sm:px-2">
            <WaitingView view={waiting} {row} />
        </div>
    {/if}
</div>

<style>
    .action-area {
        background: linear-gradient(var(--pp-panel), var(--pp-table));
    }

    .action-area :global(.pp-block) {
        background: color-mix(in srgb, var(--pp-halo) 14%, transparent);
        border: 1px solid var(--pp-line);
        border-radius: 8px;
        padding: 8px 10px;
    }

    .action-area :global(.pp-block-heading) {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--pp-muted);
    }

    .action-area :global(.pp-button) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border: 1px solid var(--pp-paper-line);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 13px;
        font-weight: 650;
        white-space: nowrap;
    }

    .action-area :global(.pp-button small) {
        color: var(--pp-ink-sub);
        font-size: 13px;
        font-weight: 500;
    }

    .action-area :global(.pp-button:disabled) {
        opacity: 0.38;
    }

    .action-area :global(.pp-button.primary) {
        background: var(--pp-accent);
        border-color: var(--pp-accent);
        color: var(--pp-accent-ink);
    }

    .action-area :global(.pp-button.big) {
        padding: 7px 16px;
        font-size: 14px;
    }

    /* Contract, "Phone layout": the action area takes at most 36 % of the column and scrolls
       within it past that; every button is a 44 px target. */
    @media (width < 40rem) {
        .action-area {
            /* The column: the viewport less the site's bars, the history controls and padding. */
            max-height: calc(0.36 * (100dvh - var(--app-shell-height, 0px) - 60px));
            overflow-y: auto;
            padding-top: 6px;
            padding-bottom: 8px;
        }

        .action-area :global(.pp-block) {
            padding: 4px 6px;
        }

        .action-area :global(.pp-block-heading) {
            margin-bottom: 2px;
        }

        .action-area :global(.pp-button) {
            min-height: 44px;
            justify-content: center;
        }
    }
</style>
