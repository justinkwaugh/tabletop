<script lang="ts">
    import { ActionSpaceId } from '@tabletop/railheads'
    import ActionSpaceIcon from '$lib/components/ActionSpaceIcon.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SPACE_NAMES,
        SPACE_SHORT_NAMES,
        spaceText,
        SPACE_DISPLAY_ORDER
    } from '$lib/utils/describeAction.js'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const rounds = $derived(state.edition.definition.rounds)
    const timerFraction = $derived(state.roundTimer / state.roundTimerSize(state.round()))
    const spaces = $derived(
        SPACE_DISPLAY_ORDER.map((space) => ({
            space,
            title: SPACE_NAMES[space],
            shortTitle: SPACE_SHORT_NAMES[space],
            ...spaceText(state, space),
            coins: state.spaceCoins(space),
            cost: state.spaceCost(space),
            selectable: gameSession.selectableSpaces.includes(space),
            consolidatable: gameSession.consolidatableSpaces.includes(space),
            active: state.activeSpace === space
        }))
    )

    function choose(space: ActionSpaceId, selectable: boolean) {
        if (selectable) {
            void gameSession.chooseSpace(space)
        }
    }
</script>

<div class="strip" aria-label="Action selection">
    <div class="timer" title="Coins left on the Round Timer; the round ends when they run out">
        <span class="round">
            {#if state.round() === 0}Initial auction{:else}Round<br class="wide" />
                <span class="nowrap">{state.round()} of {rounds}</span>{/if}
        </span>
        <span class="coin" class:ending={gameSession.roundEndingChoiceAvailable}
            >{state.roundTimer}</span
        >
        <span class="timer-bar"><span style:width="{timerFraction * 100}%"></span></span>
    </div>
    {#each spaces as entry (entry.space)}
        <div class="space" class:active={entry.active} class:selectable={entry.selectable}>
            {#if entry.coins > 0}
                <span
                    class="bubble pot"
                    title="Coins waiting on this space; consolidate to take them"
                    >{entry.coins}</span
                >
            {/if}
            <span
                class="bubble cost"
                title="Coins you pay from the Round Timer to choose this space now"
                >{entry.cost}</span
            >
            <button
                type="button"
                class="choose"
                disabled={!entry.selectable}
                aria-label="Choose {entry.title} for {entry.cost} coin{entry.cost === 1 ? '' : 's'}"
                onclick={() => choose(entry.space, entry.selectable)}
            >
                <ActionSpaceIcon space={entry.space} />
                <span class="title"
                    ><span class="full">{entry.title}</span><span class="short"
                        >{entry.shortTitle}</span
                    ></span
                >
                <span class="terms" title={entry.rules}>
                    {#each entry.terms as line (line)}<span class="term">{line}</span>{/each}
                </span>
            </button>
            {#if entry.consolidatable}
                <button
                    type="button"
                    class="collect"
                    onclick={() => gameSession.consolidate(entry.space)}
                    aria-label="Consolidate"
                    title="Take the ${entry.coins} on this space as cash"
                    ><span class="full">Consolidate</span><span class="short">Take</span></button
                >
            {/if}
        </div>
    {/each}
</div>

<style>
    .strip {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) repeat(5, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 10px 0;
        font-family: 'Railheads Baskerville', Georgia, serif;
        color: #26300f;
    }

    .timer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        border: 2px solid #33401a;
        border-radius: 8px;
        background: #33401a;
        color: #f4f0d8;
        padding: 3px 4px;
        text-align: center;
    }

    .nowrap {
        white-space: nowrap;
    }

    .round {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .coin {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        border: 2px solid #7a5f0a;
        border-radius: 999px;
        background: #e3c34a;
        box-shadow:
            inset 0 0 0 3px #e3c34a,
            inset 0 0 0 4px rgba(122, 95, 10, 0.45);
        color: #4a3a05;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
    }

    .coin.ending {
        border-color: #6e140f;
        background: #c42a22;
        box-shadow:
            inset 0 0 0 3px #c42a22,
            inset 0 0 0 4px rgba(255, 255, 255, 0.45);
        color: #ffffff;
    }

    .timer-bar {
        display: none;
    }

    .space {
        position: relative;
        display: flex;
        flex-direction: column;
        border: 2px solid #5c4a2c;
        border-radius: 8px;
        background: #f6f2da;
    }

    .space.active {
        border-color: #9a7d12;
        box-shadow: 0 0 0 2px #d8b62a;
    }

    .space.selectable {
        border-color: #9a7d12;
        background: #fbf3c4;
    }

    .bubble {
        position: absolute;
        top: -9px;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 21px;
        height: 21px;
        padding: 0 4px;
        border-radius: 999px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
    }

    .pot {
        left: -6px;
        background: #33401a;
        color: #f4f0d8;
    }

    .cost {
        right: -6px;
        border: 1.5px solid #7a5f0a;
        background: #e3c34a;
        color: #4a3a05;
    }

    .choose {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 7px 8px;
        border-radius: 6px;
        color: inherit;
        text-align: center;
    }

    .choose:disabled {
        cursor: default;
    }

    .space.selectable .choose:hover,
    .space.selectable .choose:focus-visible {
        background: #f7e897;
        outline: none;
    }

    .title {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.15;
    }

    .short {
        display: none;
    }

    .terms {
        align-self: stretch;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 12.5px;
        line-height: 1.2;
        color: #26300f;
        font-style: italic;
    }

    .term {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .collect {
        border-top: 1px dashed #9a7d12;
        border-radius: 0 0 6px 6px;
        background: #ece7c6;
        padding: 3px 4px;
        font-size: 13px;
        font-weight: 700;
        color: #33401a;
    }

    .collect:hover {
        background: #e0d99c;
    }

    @media (max-width: 639px) {
        .strip {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 8px 7px;
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
            color: #33401a;
            padding: 0;
            text-align: left;
        }

        .wide {
            display: none;
        }

        .round {
            font-size: 12px;
        }

        .coin {
            width: 30px;
            height: 30px;
            border-width: 1.5px;
            font-size: 14px;
        }

        .timer-bar {
            display: block;
            grid-column: 1 / -1;
            height: 6px;
            overflow: hidden;
            border-radius: 3px;
            background: #d6cfa8;
        }

        .timer-bar span {
            display: block;
            height: 100%;
            background: #33401a;
        }

        .space {
            border-radius: 10px;
        }

        .bubble {
            min-width: 19px;
            height: 19px;
            font-size: 12px;
        }

        .choose {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
            padding: 9px 2px 6px;
            border-radius: 8px;
            text-align: center;
        }

        .title {
            font-size: 10.5px;
            line-height: 1.1;
        }

        .full,
        .terms {
            display: none;
        }

        .short {
            display: inline;
        }

        .collect {
            padding: 5px 0;
            border-radius: 0 0 8px 8px;
            font-size: 10px;
        }
    }
</style>
