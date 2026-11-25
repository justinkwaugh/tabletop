<script lang="ts">
    import {
        ACTION_BOXES,
        ACTION_TRACK_ADVANCE,
        ACTION_TRACK_LIMIT,
        ActionBox,
        ROW_ACTIONS
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BOX_NAMES,
        BOX_SHORT_NAMES,
        boxContext,
        boxRules,
        boxTerms,
        eraName
    } from '$lib/utils/describeAction.js'
    import ActionBoxIcon from './ActionBoxIcon.svelte'
    import PlayerInitial from './PlayerInitial.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const finalPayoffNext = $derived(state.isFinalPayoffNext())
    const context = $derived(boxContext(state))
    const era = $derived(eraName(state))
    const rows = $derived(state.actionRows())
    const trackFraction = $derived(
        rows ? state.fullRows() / 2 : Math.min(state.actionTrack / (ACTION_TRACK_LIMIT + 1), 1)
    )
    const trackWillPass = $derived(
        gameSession.dividendBoxes.some((box) => box !== ActionBox.PayDividends)
    )
    const payout = $derived(finalPayoffNext ? 'the final payoff' : 'dividends')

    // A slot holds the player whose locomotive stands there, or on a board with action rows
    // whether its box is filled.
    type Slot = { playerId?: string; filled: boolean }

    const boxes = $derived(
        (rows ? ROW_ACTIONS : ACTION_BOXES).map((box) => {
            const common = {
                box,
                title: BOX_NAMES[box],
                shortTitle: BOX_SHORT_NAMES[box],
                terms: boxTerms(state.map, box, context),
                rules: boxRules(state.map, box, context),
                paysDividends: gameSession.dividendBoxes.includes(box),
                selectable: gameSession.selectableBoxes.includes(box),
                special: gameSession.specialActionBoxes.includes(box)
            }
            if (rows && box !== ActionBox.PayDividends) {
                const capacity = rows.rows[box]
                const filled = state.boxesFilled(box)
                return {
                    ...common,
                    advance: `${filled}/${capacity}`,
                    full: filled >= capacity,
                    slots: Array.from({ length: capacity }, (_, index): Slot => ({
                        filled: index < filled
                    }))
                }
            }
            const occupants = gameSession.placedPlayers
                .filter((player) => player.locomotive === box)
                .map((player) => player.playerId)
            const slots = Math.max(state.boxCapacity(box), occupants.length)
            return {
                ...common,
                advance: box === ActionBox.PayDividends ? '↺' : `+${ACTION_TRACK_ADVANCE[box]}`,
                full: false,
                slots: Array.from({ length: slots }, (_, index): Slot => ({
                    playerId: occupants[index],
                    filled: false
                }))
            }
        })
    )

    function advanceTitle(entry: (typeof boxes)[number]): string {
        if (rows) {
            if (entry.full) {
                return 'This row is full until the next round'
            }
            return entry.paysDividends
                ? `Fills a second row: ${payout} follow once its action is done`
                : `${entry.advance} boxes filled this round`
        }
        if (entry.box === ActionBox.PayDividends) {
            return `Pays ${finalPayoffNext ? 'the final payoff' : 'dividends'} and resets the action track`
        }
        return entry.paysDividends
            ? `Moves the action track past ${ACTION_TRACK_LIMIT}: ${finalPayoffNext ? 'the final payoff' : 'dividends'} follow at once`
            : `Moves the action track ${entry.advance}`
    }
</script>

{#snippet boxContent(entry: (typeof boxes)[number])}
    <ActionBoxIcon box={entry.box} />
    <span class="title"
        ><span class="full">{entry.title}</span><span class="short">{entry.shortTitle}</span></span
    >
    <span class="rules" title={entry.rules}>{entry.terms}</span>
    <span class="slots" class:row={rows}>
        {#each entry.slots as slot, index (index)}
            <span class="slot" class:filled={slot.filled}>
                {#if slot.playerId}<PlayerInitial playerId={slot.playerId} />{/if}
            </span>
        {/each}
    </span>
{/snippet}

<div class="strip" class:rows aria-label="Action boxes">
    <div
        class="timer"
        title={rows
            ? `Action rows: ${payout} are paid once two rows are full`
            : `Action track: dividends are paid once it passes ${ACTION_TRACK_LIMIT}`}
    >
        <span class="round" class:final={finalPayoffNext}>
            {#if finalPayoffNext}Final<br class="wide" /> Round{:else}Round<br class="wide" />
                <span class="nowrap">{state.round()} of {state.rounds()}</span>{#if era}<br />
                    <span class="era">{era}</span>{/if}{/if}
        </span>
        <span class="track">
            {#if rows}
                <span class="clock" class:ending={trackWillPass}>{state.fullRows()}</span>
                <span class="limit">of 2 rows full</span>
            {:else}
                <span class="clock" class:ending={trackWillPass}>{state.actionTrack}</span>
                <span class="limit">of {ACTION_TRACK_LIMIT}</span>
            {/if}
        </span>
        <span class="track-bar" class:ending={trackWillPass}
            ><span style:width="{trackFraction * 100}%"></span></span
        >
    </div>
    {#each boxes as entry (entry.box)}
        <div class="box" class:selectable={entry.selectable} class:full={entry.full}>
            <span class="bubble" class:pays={entry.paysDividends} title={advanceTitle(entry)}
                >{entry.advance}</span
            >
            {#if entry.selectable}
                <button
                    type="button"
                    class="face"
                    aria-label="Choose {entry.title}"
                    onclick={() => gameSession.chooseBox(entry.box)}
                >
                    {@render boxContent(entry)}
                </button>
            {:else}
                <div class="face">
                    {@render boxContent(entry)}
                </div>
            {/if}
            {#if entry.special}
                <button
                    type="button"
                    class="special"
                    title="Take {entry.title} without filling a box. You may do this once a game."
                    onclick={() => gameSession.chooseSpecialAction(entry.box)}
                    >Special action</button
                >
            {/if}
        </div>
    {/each}
</div>

<style>
    .strip {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 10px 0;
        color: #18222f;
        font-family: 'SAR Baskerville', Georgia, serif;
    }

    .timer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 2px solid #1f2d3d;
        border-radius: 8px;
        background: #1f2d3d;
        color: #fdfdfb;
        padding: 4px;
        text-align: center;
    }

    .round {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0.06em;
        line-height: 1.15;
        text-transform: uppercase;
    }

    .round.final,
    .era {
        color: #ffb3a8;
    }

    .nowrap {
        white-space: nowrap;
    }

    .track {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    /* A station clock: the track counts down the time to the next dividend. */
    .clock {
        --rim: #18222f;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 38px;
        height: 38px;
        border: 2px solid var(--rim);
        border-radius: 999px;
        background:
            radial-gradient(circle, #fdfdfb 0 58%, transparent 59%),
            repeating-conic-gradient(from -2deg, var(--rim) 0 4deg, #fdfdfb 4deg 30deg);
        color: var(--rim);
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    .clock.ending {
        --rim: #b0262e;
    }

    .limit {
        font-size: 12px;
        font-style: italic;
    }

    .track-bar {
        display: none;
    }

    .strip.rows {
        grid-template-columns: minmax(0, 0.8fr) repeat(3, minmax(0, 1fr));
    }

    .box {
        position: relative;
        display: flex;
        flex-direction: column;
        border: 2px solid #28394d;
        border-radius: 8px;
        background: #fdfdfb;
    }

    .box.selectable {
        border-color: #c8961a;
        background: #fdfdfb;
        box-shadow: 0 0 0 1px #c8961a;
    }

    .bubble {
        position: absolute;
        top: -9px;
        right: -6px;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 24px;
        height: 21px;
        padding: 0 5px;
        border: 1.5px solid #2b3d53;
        border-radius: 999px;
        background: #e3c34a;
        color: #1a2432;
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
    }

    .bubble.pays {
        border-color: #6e140f;
        background: #c42a22;
        color: #ffffff;
    }

    .face {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 0;
        padding: 6px 8px 7px;
        border-radius: 6px;
        color: inherit;
        text-align: center;
    }

    button.face:hover,
    button.face:focus-visible {
        background: #eef1f2;
        outline: none;
    }

    .title {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.15;
    }

    .short {
        display: none;
    }

    .rules {
        align-self: stretch;
        overflow: hidden;
        font-size: 11.5px;
        font-style: italic;
        line-height: 1.25;
        color: #2f445c;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .slots {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
        margin-top: auto;
    }

    .slots.row {
        flex-wrap: nowrap;
        gap: 2px;
    }

    .slots.row .slot {
        width: 18px;
        height: 18px;
        border-style: solid;
        border-color: #28394d;
        background: #fdfdfb;
    }

    .slots.row .slot.filled {
        background: #3f597a;
    }

    .box.full .face {
        opacity: 0.55;
    }

    .special {
        margin: 0 6px 6px;
        padding: 2px 6px;
        border: 1.5px dashed #c8961a;
        border-radius: 5px;
        background: #fff8e2;
        color: #6b4c05;
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
    }

    .special:hover,
    .special:focus-visible {
        background: #ffe9a8;
        outline: none;
    }

    .slot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 24px;
        border: 1.2px dashed #5478a3;
        border-radius: 4px;
        background: #eef1f2;
    }

    @media (max-width: 639px) {
        .strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px 6px;
            margin: 6px 8px 0;
        }

        .strip.rows {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .slots.row .slot {
            width: 14px;
            height: 14px;
        }

        .special {
            margin: 0 3px 4px;
            padding: 1px 3px;
            font-size: 10.5px;
        }

        .timer {
            display: grid;
            grid-column: 1 / -1;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 4px 8px;
            border: 0;
            background: none;
            color: #1f2d3d;
            padding: 0;
            text-align: left;
        }

        .wide {
            display: none;
        }

        .round {
            font-size: 12px;
        }

        .round.final {
            color: #b0262e;
        }

        .clock {
            width: 28px;
            height: 28px;
            border-width: 1.5px;
            font-size: 13px;
        }

        .limit {
            font-size: 11px;
        }

        .track-bar {
            display: block;
            grid-column: 1 / -1;
            height: 6px;
            overflow: hidden;
            border-radius: 3px;
            background: #eef1f2;
        }

        .track-bar span {
            display: block;
            height: 100%;
            background: #1f2d3d;
        }

        .track-bar.ending span {
            background: #c42a22;
        }

        .bubble {
            min-width: 21px;
            height: 19px;
            font-size: 12px;
        }

        .face {
            gap: 2px;
            padding: 8px 2px 5px;
        }

        .face :global(svg) {
            width: 26px;
            height: 26px;
        }

        .title {
            font-size: 11px;
        }

        .full,
        .rules {
            display: none;
        }

        .short {
            display: inline;
        }

        .slot {
            width: 24px;
            height: 18px;
        }
    }
</style>
