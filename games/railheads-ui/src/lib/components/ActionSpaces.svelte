<script lang="ts">
    import { ACTION_SPACES, isLayTrackSpace, type ActionSpaceId } from '@tabletop/railheads'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SPACE_NAMES, spaceTerms } from '$lib/utils/describeAction.js'
    import TrainIcon from './TrainIcon.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const rounds = $derived(state.edition.definition.rounds)
    const spaces = $derived(
        ACTION_SPACES.map((space) => ({
            space,
            title: SPACE_NAMES[space],
            terms: spaceTerms(space, isLayTrackSpace(space) ? state.layTrackRules(space) : undefined),
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
            {#if state.round() === 0}Initial auction{:else}Round {state.round()} of {rounds}{/if}
        </span>
        <span class="pips" title="The game ends after the payout of round {rounds}">
            {#each Array.from({ length: rounds }, (_, index) => index + 1) as round (round)}
                <span
                    class="pip"
                    class:done={round < state.round()}
                    class:now={round === state.round()}
                    class:last={round === rounds}>{round === rounds ? 'END' : round}</span
                >
            {/each}
        </span>
        <span class="coins"><span class="coin">$</span>{state.roundTimer}</span>
        {#if state.startPlayerId}
            <span class="starter" title="Start Player">
                <TrainIcon size={16} />
                <PlayerName playerId={state.startPlayerId} />
            </span>
        {/if}
    </div>
    {#each spaces as entry (entry.space)}
        <div class="space" class:active={entry.active} class:selectable={entry.selectable}>
            <button
                type="button"
                class="choose"
                disabled={!entry.selectable}
                aria-label="Choose {entry.title} for {entry.cost} coin{entry.cost === 1 ? '' : 's'}"
                onclick={() => choose(entry.space, entry.selectable)}
            >
                <span class="title">{entry.title}</span>
                <span class="terms">{entry.terms}</span>
                <span class="pile">
                    <span class="held" title="Coins on this space">
                        {#each Array.from({ length: Math.min(entry.coins, 6) }, (_, index) => index) as coin (coin)}
                            <span class="mini-coin"></span>
                        {/each}
                        <span class="amount">{entry.coins > 0 ? `$${entry.coins}` : 'empty'}</span>
                    </span>
                    <span class="cost" title="Coins it costs to choose this space now">
                        next {entry.cost}
                    </span>
                </span>
            </button>
            {#if entry.consolidatable}
                <button
                    type="button"
                    class="collect"
                    onclick={() => gameSession.consolidate(entry.space)}
                    >Consolidate ${entry.coins}</button
                >
            {/if}
        </div>
    {/each}
</div>

<style>
    .strip {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) repeat(5, minmax(0, 1fr));
        gap: 6px;
        margin: 6px 8px 0;
        font-family: 'Libre Baskerville', Georgia, serif;
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

    .pips {
        display: inline-flex;
        gap: 3px;
    }

    .pip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 3px;
        border: 1.5px solid #8f9a63;
        border-radius: 4px;
        color: #cfd6a8;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
    }

    .pip.done {
        background: #5b6b2c;
        color: #f4f0d8;
    }

    .pip.now {
        border-color: #f2d438;
        background: #f2d438;
        color: #26300f;
    }

    .pip.last:not(.now) {
        border-style: dashed;
    }

    .round {
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .coins {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
    }

    .coin {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #e3c34a;
        color: #4a3a05;
        font-size: 11px;
    }

    .starter {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
    }

    .space {
        display: flex;
        flex-direction: column;
        overflow: hidden;
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

    .choose {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: stretch;
        gap: 3px;
        padding: 5px 8px 6px;
        color: inherit;
        text-align: left;
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

    .terms {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12.5px;
        line-height: 1.2;
        color: #26300f;
    }

    .pile {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 13px;
    }

    .held {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        min-height: 14px;
    }

    .mini-coin {
        width: 9px;
        height: 9px;
        margin-right: -3px;
        border: 1px solid #7a5f0a;
        border-radius: 999px;
        background: #e3c34a;
    }

    .amount {
        margin-left: 5px;
        font-weight: 700;
    }

    .cost {
        white-space: nowrap;
        color: #26300f;
    }

    .collect {
        border-top: 1px dashed #9a7d12;
        background: #ece7c6;
        padding: 2px 4px;
        font-size: 12.5px;
        font-weight: 700;
        color: #33401a;
    }

    .collect:hover {
        background: #e0d99c;
    }

    @media (max-width: 639px) {
        .strip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4px;
            margin: 4px 6px 0;
        }

        .terms {
            font-size: 11.5px;
        }

        .title {
            font-size: 13px;
        }

        .coins {
            font-size: 18px;
        }
    }
</style>
