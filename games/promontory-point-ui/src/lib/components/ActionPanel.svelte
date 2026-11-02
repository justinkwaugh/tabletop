<script lang="ts">
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnPanel } from '$lib/model/turnPanel.js'
    import { repairsRow } from '$lib/model/repairsRow.js'
    import { scoreView } from '$lib/model/score.js'
    import { waitingView } from '$lib/model/waitingView.js'
    import EndTurnChoices from './EndTurnChoices.svelte'
    import RepairsPanel from './RepairsPanel.svelte'
    import RepairsRow from './RepairsRow.svelte'
    import ScoreTable from './ScoreTable.svelte'
    import ShareBlock from './ShareBlock.svelte'
    import TurnHeader from './TurnHeader.svelte'
    import TurnChoices from './TurnChoices.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const panel = $derived(turnPanel(gameSession))

    // R-6.2: the action area becomes the score once the game has ended; a call shows the shared
    // ending in its place, with no score (docs/player-votes.md).
    const score = $derived(scoreView(gameSession.gameState, gameSession.gameCall))

    // R-4.3: every seat's bill while a Repairs is being paid, from the displayed state.
    const row = $derived(repairsRow(gameSession.gameState, gameSession.actions))

    // R-4.3, R-X.1: the deciding short seat's own panel.
    const repairs = $derived(gameSession.repairsPanel)

    // Contract, "Watching": every seat without a decision of its own.
    const waiting = $derived(
        waitingView(gameSession.gameState, gameSession.actions, gameSession.myPlayer?.id)
    )
</script>

<div class="flex flex-col gap-1.5 text-pp-ink max-sm:gap-1">
    <TurnHeader />
    {#if gameSession.gameCall}
        <div class="action-area px-3 pt-2 pb-2.5 max-sm:px-2" data-called-ending>
            <CalledGameEnding class="ending text-[15px] max-sm:text-[13.5px]" />
        </div>
    {:else if score}
        <div class="action-area px-3 pt-2 pb-2.5 max-sm:px-2">
            <ScoreTable {score} />
        </div>
    {:else if repairs}
        <div class="action-area px-3 pt-2 pb-2.5 max-sm:px-2">
            {#if row}
                <div class="mb-2 max-sm:mb-1">
                    <RepairsRow {row} />
                </div>
            {/if}
            <RepairsPanel panel={repairs} />
        </div>
    {:else if panel}
        <div class="action-area px-3 pt-2 pb-2.5 max-sm:px-2">
            <p class="mb-2 text-[15px] max-sm:mb-1 max-sm:text-[13.5px] max-sm:leading-snug">
                <b class="pp-prompt">{panel.prompt.lead}</b>
                {panel.prompt.text}
                {#if panel.prompt.note}
                    <!-- A phone keeps the action area to the decision; the share block tells the lock. -->
                    <span class="pp-aside ml-2 text-[13px] max-sm:hidden">{panel.prompt.note}</span>
                {/if}
            </p>
            {#if panel.endTurn.length > 0}
                <div class="mb-2 max-sm:mb-1">
                    <EndTurnChoices choices={panel.endTurn} />
                </div>
            {/if}
            <!-- The hand is beside the map (a bar under the board on a phone), not here. -->
            <div class="flex flex-wrap items-stretch gap-4 max-sm:flex-col max-sm:gap-2">
                <ShareBlock shares={panel.shares} />
                <TurnChoices {panel} />
            </div>
        </div>
    {:else if waiting}
        <div class="action-area px-3 pt-2 pb-2.5 max-sm:px-2">
            <WaitingView view={waiting} {row} />
        </div>
    {/if}
</div>

<style>
    /* Paper panels, prompts in Oswald, secondary lines in Caslon italic. */
    .action-area {
        background: var(--pp-paper);
        border-radius: 4px;
        box-shadow: 0 2px 0 color-mix(in srgb, var(--pp-halo) 30%, transparent);
    }

    /* The shared ending in the prompt's Oswald. */
    .action-area :global(.ending) {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        letter-spacing: 0.02em;
    }

    .action-area :global(.pp-prompt) {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        font-size: 1.07em;
        letter-spacing: 0.02em;
    }

    .action-area :global(.pp-aside) {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        color: var(--pp-ink-sub);
    }

    .action-area :global(.pp-block) {
        background: color-mix(in srgb, var(--pp-paper-deep) 55%, transparent);
        border: 1.5px dashed color-mix(in srgb, var(--pp-brown) 55%, transparent);
        border-radius: 4px;
        padding: 8px 10px;
    }

    .action-area :global(.pp-block-heading) {
        margin: 0 0 6px;
        font-family: Oswald, sans-serif;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--pp-brown);
    }

    /* Buttons: charcoal outline on paper, Oswald caps; the primary charcoal with paper text. */
    .action-area :global(.pp-button) {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-height: 30px;
        background: var(--pp-paper);
        color: var(--pp-charcoal);
        border: 1.5px solid var(--pp-charcoal);
        border-radius: 3px;
        padding: 2px 11px;
        font-family: Oswald, sans-serif;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
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
        background: var(--pp-charcoal);
        border-color: var(--pp-charcoal);
        color: var(--pp-paper);
    }

    .action-area :global(.pp-button.primary small) {
        color: var(--pp-paper-deep);
    }

    .action-area :global(.pp-button.big) {
        padding: 4px 16px;
        font-size: 15px;
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
