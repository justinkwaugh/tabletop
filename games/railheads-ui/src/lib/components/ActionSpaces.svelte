<script lang="ts">
    import { ActionSpaceId, isLayTrackSpace } from '@tabletop/railheads'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { SPACE_NAMES, spaceTerms } from '$lib/utils/describeAction.js'
    import TrainIcon from './TrainIcon.svelte'

    const DISPLAY_ORDER = [
        ActionSpaceId.IssueShare,
        ActionSpaceId.IndustryInvestment,
        ActionSpaceId.LayTrackI,
        ActionSpaceId.LayTrackII,
        ActionSpaceId.LayTrackIII
    ] as const

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const rounds = $derived(state.edition.definition.rounds)
    const spaces = $derived(
        DISPLAY_ORDER.map((space) => ({
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
                    <span class="held" title="Coins waiting on this space; consolidate to take them">
                        <span class="stack" class:empty={entry.coins === 0}>
                            {#each Array.from({ length: Math.min(entry.coins, 8) }, (_, index) => index) as coin (coin)}
                                <span class="mini-coin" style:bottom="{coin * 3}px"></span>
                            {/each}
                        </span>
                        <span class="amount">{entry.coins > 0 ? `$${entry.coins}` : 'empty'}</span>
                        <span class="label">on space</span>
                    </span>
                    <span class="cost" title="Coins you pay from the Round Timer to choose this space now">
                        <span class="label">Choose for</span>
                        <span class="mini-coin flat"></span>
                        <span class="amount">{entry.cost}</span>
                    </span>
                </span>
            </button>
            {#if entry.consolidatable}
                <button
                    type="button"
                    class="collect"
                    onclick={() => gameSession.consolidate(entry.space)}
                    title="Take the ${entry.coins} on this space as cash"
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

    .round {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.04em;
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
        flex-direction: column;
        gap: 2px;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 13px;
    }

    .held,
    .cost {
        display: flex;
        align-items: center;
        gap: 1px;
    }

    .held .amount {
        margin-left: 0;
        font-size: 20px;
        line-height: 1;
    }

    .held .label {
        margin-left: 6px;
        font-size: 11px;
    }

    .label {
        flex: 1;
    }

    .held .label {
        flex: none;
    }

    .stack {
        position: relative;
        width: 22px;
        height: 28px;
        margin-right: 4px;
    }

    .stack.empty {
        border: 1.5px dashed #b9b48a;
        border-radius: 999px;
        height: 12px;
        margin-top: 16px;
    }

    .mini-coin {
        position: absolute;
        left: 0;
        width: 22px;
        height: 11px;
        border: 1px solid #7a5f0a;
        border-radius: 999px;
        background: #e3c34a;
        box-shadow: 0 1px 0 #a98a1c;
    }

    .mini-coin.flat {
        position: static;
        width: 12px;
        height: 12px;
        margin-left: 4px;
    }

    .amount {
        margin-left: 5px;
        font-weight: 700;
    }

    .cost {
        white-space: nowrap;
        padding-top: 2px;
        border-top: 1px dashed #c9c493;
        color: #26300f;
    }

    .cost .amount {
        margin-left: 4px;
    }

    .collect {
        border-top: 1px dashed #9a7d12;
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
