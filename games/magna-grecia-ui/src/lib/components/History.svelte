<script lang="ts">
    import { tick } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import { createTimeAgo, PlayerName } from '@tabletop/frontend-components'
    import { actionCard } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        historyLines,
        historyRounds,
        historySpaces,
        type HistoryRound,
        type HistoryTurn
    } from '$lib/utils/historyTurns.js'
    import AllowanceList from './AllowanceList.svelte'
    import HistoryEntryRow from './HistoryEntryRow.svelte'
    import SeatSquares from './SeatSquares.svelte'

    const timeAgo = createTimeAgo()
    const gameSession = getGameSession()

    let scrollContainer: HTMLDivElement | undefined = $state()
    type ReplayUiState = {
        activeTurnKey: string
        frozenActions: GameAction[]
        frozenScrollTop: number
        showFinishedMarker: boolean
    }
    let replayUiState = $state<ReplayUiState | null>(null)

    const liveActions = $derived(
        gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
    )
    const displayedActions = $derived(replayUiState ? replayUiState.frozenActions : liveActions)
    const rounds = $derived(
        historyRounds(displayedActions, gameSession.gameState.players.length).toReversed()
    )
    const showFinishedMarker = $derived(
        replayUiState
            ? replayUiState.showFinishedMarker
            : !!(gameSession.game.finishedAt && !gameSession.isViewingHistory)
    )

    function highlight(actions: GameAction[]) {
        gameSession.historyHighlight = historySpaces(actions, gameSession.gameState.board)
    }

    $effect(() => () => highlight([]))

    function roundCard(round: number) {
        const cardId = gameSession.gameState.revealedCardIds[round]
        return cardId === undefined ? undefined : actionCard(cardId)
    }

    function turnTime(turn: HistoryTurn): string {
        return turn.lastAt ? timeAgo.format(turn.lastAt) : ''
    }

    function roundEnd(round: HistoryRound): GameAction | undefined {
        return round.turns.findLast((turn) => turn.actions.length > 0)?.actions.at(-1)
    }

    async function jumpToHistoryAction(action: GameAction | undefined) {
        if (action?.index === undefined || replayUiState) {
            return
        }
        await gameSession.history.goToActionIndex(action.index)
        await tick()
        scrollContainer?.scrollTo({ top: 0, behavior: 'auto' })
    }

    function onActivate(event: KeyboardEvent, activate: () => void) {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
            return
        }
        event.preventDefault()
        activate()
    }

    async function replayTurn(turn: HistoryTurn) {
        const start = turn.actions[0]?.index
        const end = turn.actions.at(-1)?.index
        if (replayUiState || start === undefined || end === undefined) {
            return
        }

        const nextReplayUiState: ReplayUiState = {
            activeTurnKey: turn.key,
            frozenActions: displayedActions.slice(),
            frozenScrollTop: scrollContainer?.scrollTop ?? 0,
            showFinishedMarker
        }
        replayUiState = nextReplayUiState
        await tick()
        scrollContainer?.scrollTo({ top: nextReplayUiState.frozenScrollTop, behavior: 'auto' })

        try {
            await gameSession.history.replayRange(start, end)
        } finally {
            replayUiState = null
            await tick()
            scrollContainer?.scrollTo({ top: nextReplayUiState.frozenScrollTop, behavior: 'auto' })
        }
    }
</script>

<div class="history">
    <div class="scroll" class:frozen={replayUiState} bind:this={scrollContainer}>
        {#if showFinishedMarker}
            <div class="milestone">
                <span>Game over</span>
                {#if gameSession.gameState.winningPlayerIds.length > 0}
                    <span class="winners">
                        {#each gameSession.gameState.winningPlayerIds as playerId (playerId)}
                            <PlayerName {playerId} />
                        {/each}
                        {gameSession.gameState.winningPlayerIds.length > 1 ? 'win' : 'wins'}
                    </span>
                {/if}
                <span class="when">{timeAgo.format(gameSession.game.finishedAt!)}</span>
            </div>
        {/if}
        {#each rounds as round (round.round)}
            {@const card = roundCard(round.round)}
            {@const end = roundEnd(round)}
            <section class="round" aria-label="Round {round.round + 1}">
                <div
                    class="round-head"
                    class:jumps={end}
                    role="button"
                    tabindex={end && !replayUiState ? 0 : -1}
                    aria-disabled={end ? undefined : 'true'}
                    aria-label={end
                        ? `Show the board at the end of round ${round.round + 1}`
                        : undefined}
                    title={end ? 'Show the board at the end of this round' : undefined}
                    onclick={() => jumpToHistoryAction(end)}
                    onkeydown={(event) => onActivate(event, () => jumpToHistoryAction(end))}
                >
                    <span class="round-label">
                        Round <span class="round-number">{round.round + 1}</span>
                    </span>
                    {#if card}
                        <span class="round-card">
                            <AllowanceList
                                {card}
                                label="Round {round.round + 1}'s actions"
                                size={13}
                            />
                            <SeatSquares
                                playerIds={gameSession.gameState.turnOrderForCard(card)}
                                size={15}
                            />
                        </span>
                    {/if}
                </div>
                {#each round.turns.toReversed() as turn (turn.key)}
                    {@const color = gameSession.colors.getPlayerUiColor(turn.playerId)}
                    {@const replayable = turn.actions.length > 0}
                    {@const replaying = replayUiState?.activeTurnKey === turn.key}
                    <article
                        class="turn"
                        class:replaying
                        class:dimmed={replayUiState && !replaying}
                        style:--player={color}
                    >
                        <div
                            class="turn-head"
                            class:jumps={replayable}
                            role="button"
                            tabindex={replayable && !replayUiState ? 0 : -1}
                            aria-disabled={replayable ? undefined : 'true'}
                            aria-label={replayable
                                ? `Replay ${gameSession.getPlayerName(turn.playerId)}'s turn`
                                : undefined}
                            title={replayable ? 'Replay this turn' : undefined}
                            onclick={() => replayTurn(turn)}
                            onkeydown={(event) => onActivate(event, () => replayTurn(turn))}
                            onpointerenter={() => highlight(turn.actions)}
                            onpointerleave={() => highlight([])}
                            onfocus={() => highlight(turn.actions)}
                            onblur={() => highlight([])}
                        >
                            <PlayerName playerId={turn.playerId} />
                            {#if !turn.ended}
                                <span class="in-progress">playing</span>
                            {/if}
                            {#if replaying}
                                <span class="replaying-tag">Replaying</span>
                            {/if}
                            <span class="when">{turnTime(turn)}</span>
                        </div>
                        {#if turn.actions.length > 0}
                            <div class="entries">
                                {#each historyLines(turn.actions) as line (line.key)}
                                    <HistoryEntryRow
                                        {line}
                                        {color}
                                        onhighlight={(on) => highlight(on ? line.actions : [])}
                                    />
                                {/each}
                            </div>
                        {:else if turn.ended}
                            <div class="passed">Passed</div>
                        {/if}
                    </article>
                {/each}
            </section>
        {/each}
        <div class="milestone start">
            <span>Game started</span>
            <span class="when">{timeAgo.format(gameSession.game.createdAt)}</span>
        </div>
    </div>
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 300px;
        overflow: hidden;
        border-radius: 14px;
        background: #fbf5e6;
        box-shadow:
            inset 0 0 0 1.5px rgba(107, 63, 29, 0.35),
            0 2px 6px rgba(40, 24, 8, 0.15);
        color: #4a2c12;
        font-size: 14px;
        text-align: left;
    }

    .scroll {
        height: 100%;
        overflow: auto;
        padding: 0 8px 10px;
    }

    .scroll.frozen {
        overflow: hidden;
    }

    .round-head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 4px 10px;
        margin: 0 -8px;
        padding: 8px 12px 6px;
        border-bottom: 1px solid rgba(107, 63, 29, 0.18);
        background: #f3e8cd;
    }

    .jumps {
        cursor: pointer;
    }

    .round-head.jumps:hover,
    .round-head.jumps:focus-visible {
        background: #efe0bd;
        outline: none;
    }

    .turn-head.jumps:hover,
    .turn-head.jumps:focus-visible {
        background: rgba(107, 63, 29, 0.08);
        outline: none;
    }

    .turn.replaying {
        border-radius: 3px 8px 8px 3px;
        background: rgba(224, 168, 58, 0.18);
    }

    .turn.dimmed {
        opacity: 0.45;
    }

    .replaying-tag {
        padding: 0 6px;
        border-radius: 999px;
        background: #e0a83a;
        color: #3b2208;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .round-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .round-number {
        font-size: 18px;
        font-weight: 700;
    }

    .round-card {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #6b4520;
    }

    .turn {
        margin-top: 8px;
        padding: 2px 0 2px 8px;
        border-left: 4px solid var(--player);
        border-radius: 3px;
    }

    .turn-head {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: -6px;
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
    }

    .when {
        margin-left: auto;
        font-size: 11px;
        font-weight: 400;
        color: #9b7a52;
        white-space: nowrap;
    }

    .in-progress {
        font-size: 11px;
        font-style: italic;
        font-weight: 400;
        color: #8c6a45;
    }

    .entries {
        margin: 2px 0 0 -6px;
    }

    .passed {
        padding: 2px 0 4px;
        font-size: 13px;
        font-style: italic;
        color: #8c6a45;
    }

    .milestone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 10px 0 2px;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(107, 63, 29, 0.08);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .milestone.start {
        margin-top: 14px;
        font-weight: 400;
    }

    .winners {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: system-ui, sans-serif;
        font-weight: 600;
    }
</style>
