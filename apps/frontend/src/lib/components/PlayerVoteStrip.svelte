<script lang="ts">
    import {
        ViewingHistoryLine,
        type GameSession,
        type ViewedHistoryPosition
    } from '@tabletop/frontend-components'
    import {
        assertExists,
        playerVoteIneligibility,
        PlayerVoteKind,
        votingPlayers,
        type GameState,
        type HydratedGameState,
        type UndoVotePreview
    } from '@tabletop/common'
    import { Button } from 'flowbite-svelte'
    import { UndoOutline } from 'flowbite-svelte-icons'
    import { toast } from 'svelte-sonner'
    import { readable } from 'svelte/store'
    import { untrack } from 'svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import {
        callWinnersDetail,
        undoneDetail,
        undoneSummary,
        voteErrorMessage,
        voteTally
    } from '$lib/utils/playerVoteText'

    type Proposal =
        | { actionIndex: number; kind: 'confirm'; preview: UndoVotePreview }
        | { actionIndex: number; kind: 'ownUndo' }

    const buttonClass = 'h-7 whitespace-nowrap'

    let props: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const gameSession = untrack(() => props.gameSession)

    const { gameService, authorizationService } = getAppContext()
    const { isViewingHistory, colors, gameState, showHistoryBeforeAction, showLiveGame } =
        gameSession.bridge
    const viewedPosition = gameSession.bridge.viewedHistoryPosition ?? readable(undefined)

    const game = $derived(gameService.cachedGame(gameSession.game.id) ?? gameSession.game)
    const vote = $derived(game.vote)
    const voter = $derived(
        game.players.find(
            (player) =>
                player.userId !== undefined &&
                player.userId === authorizationService.getSessionUser()?.id
        )
    )
    const canVote = $derived(voter !== undefined && playerVoteIneligibility(game) === undefined)
    const voters = $derived(votingPlayers(game.players))

    // Older UI Artifacts expose no Undo reach, so every position is offered and the host decides.
    // They also lack showLiveGame, so the live action count below is never relied on.
    const position: ViewedHistoryPosition | undefined = $derived(
        $viewedPosition ??
            ($isViewingHistory && $gameState
                ? {
                      actionIndex: $gameState.actionCount,
                      liveActionCount: $gameState.actionCount,
                      beyondUndoReach: true,
                      startsWithUserAction: true
                  }
                : undefined)
    )

    let proposal: Proposal | undefined = $state()
    const shownProposal = $derived(
        proposal?.actionIndex === position?.actionIndex ? proposal : undefined
    )

    let voteSummary: UndoVotePreview | undefined = $state()
    const summaryTarget = $derived(
        vote?.kind === PlayerVoteKind.Undo && canVote
            ? { vote, lastActionAt: game.lastActionAt }
            : undefined
    )
    $effect(() => {
        const target = summaryTarget
        voteSummary = undefined
        if (!target) return
        gameService
            .previewUndoVote(game, target.vote.targetActionIndex)
            .then((preview) => {
                if (summaryTarget === target) voteSummary = preview
            })
            .catch((error: unknown) => console.warn('Undo vote summary unavailable', error))
    })

    // The asker stays in History View while their vote is open. Once it passes, the game has been
    // undone to its target, so return them to the live game. The vote closing and the Undo arrive
    // as separate updates, in either order.
    let ownVoteTarget: number | undefined
    $effect(() => {
        if (vote) {
            ownVoteTarget =
                vote.kind === PlayerVoteKind.Undo && vote.initiatorPlayerId === voter?.id
                    ? vote.targetActionIndex
                    : undefined
            return
        }
        if (!position) {
            ownVoteTarget = undefined
            return
        }
        if (ownVoteTarget !== undefined && position.liveActionCount <= ownVoteTarget) {
            ownVoteTarget = undefined
            showLiveGame?.()
        }
    })

    let busy = $state(false)

    async function run(work: () => Promise<unknown>) {
        busy = true
        try {
            await work()
        } catch (error) {
            toast.error(voteErrorMessage(error))
        } finally {
            busy = false
        }
    }

    function ask(actionIndex: number) {
        return run(async () => {
            const preview = await gameService.previewUndoVote(game, actionIndex)
            proposal = preview.ownUndoReaches
                ? { actionIndex, kind: 'ownUndo' }
                : { actionIndex, kind: 'confirm', preview }
        })
    }

    function send(preview: UndoVotePreview) {
        return run(async () => {
            await gameService.openUndoVote(game, preview)
            proposal = undefined
        })
    }

    function playerName(playerId: string): string {
        const player = game.players.find((candidate) => candidate.id === playerId)
        assertExists(player, `Vote names an unknown player ${playerId}`)
        return player.name
    }
</script>

{#if canVote && vote}
    {@const approvals = vote.approvingPlayerIds}
    {@const declines = vote.kind === PlayerVoteKind.Call ? vote.decliningPlayerIds : []}
    <div class="vote-strip" role="status">
        <span class="line">
            <span>
                <span
                    class="me-1 rounded px-1.5 font-semibold"
                    style:background-color={$colors.getPlayerBgColorValue(vote.initiatorPlayerId)}
                    style:color={$colors.getPlayerTextColorValue(vote.initiatorPlayerId)}
                    >{playerName(vote.initiatorPlayerId)}</span
                >{#if vote.kind === PlayerVoteKind.Undo}<span class="font-medium text-white"
                        >is asking to undo to an earlier point</span
                    >{#if voteSummary}<span class="text-gray-400"
                            >{` undoing ${undoneDetail(voteSummary)}`}</span
                        >{/if}{:else}<span class="font-medium text-white"
                        >is asking to end the game</span
                    ><span class="text-gray-400"
                        >{` ${callWinnersDetail(vote.declaredWinnerIds.map(playerName))}`}</span
                    >{/if}
            </span>
        </span>
        <span class="line">
            <span class="inline-flex gap-1" aria-label={voteTally(vote, game.players)}>
                {#each voters as player (player.id)}
                    <span
                        class="h-2.5 w-2.5 rounded-full border-2"
                        class:border-gray-500={!approvals.includes(player.id) &&
                            !declines.includes(player.id)}
                        class:border-green-400={approvals.includes(player.id)}
                        class:bg-green-400={approvals.includes(player.id)}
                        class:border-red-400={declines.includes(player.id)}
                        class:bg-red-400={declines.includes(player.id)}
                    ></span>
                {/each}
            </span>
            <span class="text-xs text-gray-400 tabular-nums">{voteTally(vote, game.players)}</span>
        </span>
        <span class="buttons">
            {#if showHistoryBeforeAction && vote.kind === PlayerVoteKind.Undo}
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => showHistoryBeforeAction(vote.targetActionIndex)}
                    >View that point</Button
                >
            {/if}
            {#if vote.initiatorPlayerId === voter?.id}
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.withdrawVote(game, vote.id))}
                    >Withdraw</Button
                >
            {:else if voter && !approvals.includes(voter.id) && !declines.includes(voter.id)}
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.declineVote(game, vote.id))}
                    >Decline</Button
                >
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.approveVote(game, vote.id))}>Agree</Button
                >
            {/if}
        </span>
        {#if position}
            <span class="line own-line"><ViewingHistoryLine /></span>
        {/if}
    </div>
{:else if position}
    <div class="vote-strip">
        {#if shownProposal?.kind === 'ownUndo'}
            <span class="line text-white">You can undo this yourself with Undo.</span>
            <Button
                size="xs"
                color="alternative"
                class={buttonClass}
                onclick={() => (proposal = undefined)}>OK</Button
            >
        {:else if shownProposal?.kind === 'confirm'}
            {@const preview = shownProposal.preview}
            <span class="line">
                <span class="font-medium text-white">Ask everyone to undo to here?</span>
                <span class="text-gray-400">{undoneSummary(preview)}</span>
            </span>
            <span class="line">
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => (proposal = undefined)}>Cancel</Button
                >
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => send(preview)}>Send request</Button
                >
            </span>
        {:else}
            {@const target = position}
            <span class="line"><ViewingHistoryLine /></span>
            {#if canVote && target.beyondUndoReach && target.startsWithUserAction}
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => ask(target.actionIndex)}
                    ><UndoOutline class="me-1.5 h-4 w-4" />Ask to undo to here</Button
                >
            {/if}
        {/if}
    </div>
{/if}

<style>
    .vote-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 16px;
        min-height: 44px;
        padding: 6px 12px;
        background-color: var(--color-gray-700);
        border-top: 1px solid var(--color-gray-600);
        font-size: 14px;
        line-height: 20px;
        color: var(--color-gray-200);
        text-align: center;
    }
    .line {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px 8px;
    }
    .buttons {
        display: inline-flex;
        gap: 8px;
    }
    .own-line {
        flex-basis: 100%;
    }
    @media (max-width: 639px) {
        .vote-strip {
            padding: 6px 8px;
        }
        .line {
            flex-basis: 100%;
        }
    }
</style>
