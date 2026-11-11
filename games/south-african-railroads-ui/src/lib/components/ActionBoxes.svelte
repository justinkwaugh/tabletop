<script lang="ts">
    import {
        ACTION_BOXES,
        ACTION_TRACK_ADVANCE,
        ACTION_TRACK_LIMIT,
        ActionBox
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
    const trackFraction = $derived(Math.min(state.actionTrack / (ACTION_TRACK_LIMIT + 1), 1))
    const trackWillPass = $derived(
        gameSession.dividendBoxes.some((box) => box !== ActionBox.PayDividends)
    )

    const boxes = $derived(
        ACTION_BOXES.map((box) => {
            const occupants = gameSession.placedPlayers
                .filter((player) => player.locomotive === box)
                .map((player) => player.playerId)
            const slots = Math.max(state.boxCapacity(box), occupants.length)
            const advance = ACTION_TRACK_ADVANCE[box]
            return {
                box,
                title: BOX_NAMES[box],
                shortTitle: BOX_SHORT_NAMES[box],
                terms: boxTerms(state.map, box, context),
                rules: boxRules(state.map, box, context),
                advance: box === ActionBox.PayDividends ? '↺' : `+${advance}`,
                paysDividends: gameSession.dividendBoxes.includes(box),
                slots: Array.from({ length: slots }, (_, index) => occupants[index]),
                selectable: gameSession.selectableBoxes.includes(box)
            }
        })
    )

    function advanceTitle(entry: (typeof boxes)[number]): string {
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
    <span class="slots">
        {#each entry.slots as playerId, index (index)}
            <span class="slot">
                {#if playerId}<PlayerInitial {playerId} />{/if}
            </span>
        {/each}
    </span>
{/snippet}

<div class="strip" aria-label="Action boxes">
    <div class="timer" title="Action track: dividends are paid once it passes {ACTION_TRACK_LIMIT}">
        <span class="round" class:final={finalPayoffNext}>
            {#if finalPayoffNext}Final<br class="wide" /> Round{:else}Round<br class="wide" />
                <span class="nowrap">{state.round()} of {state.rounds()}</span>{#if era}<br />
                    <span class="era">{era}</span>{/if}{/if}
        </span>
        <span class="track">
            <span class="clock" class:ending={trackWillPass}>{state.actionTrack}</span>
            <span class="limit">of {ACTION_TRACK_LIMIT}</span>
        </span>
        <span class="track-bar" class:ending={trackWillPass}
            ><span style:width="{trackFraction * 100}%"></span></span
        >
    </div>
    {#each boxes as entry (entry.box)}
        <div class="box" class:selectable={entry.selectable}>
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
        font-family: 'Libre Baskerville', Georgia, serif;
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

    .box {
        position: relative;
        display: flex;
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
