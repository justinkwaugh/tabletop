<script lang="ts">
    import {
        ViewingHistoryLine,
        type GameSession,
        type ViewedHistoryPosition
    } from '@tabletop/frontend-components'
    import {
        assertExists,
        awaitsAnswerFrom,
        playerVoteIneligibility,
        PlayerVoteKind,
        gameHoldsUpPlayer,
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
        undoneSummary,
        voteErrorMessage,
        voteRequestParts,
        voteTally
    } from '$lib/utils/playerVoteText'
    import { m } from '$lib/paraglide/messages'
    import RichMessage from './RichMessage.svelte'
    import { readNoticedVoteIds, rememberNoticedVote } from '$lib/utils/voteNotice'
    import PlayerVoteNotice from './PlayerVoteNotice.svelte'
    import {
        offersUndoRequest,
        shownProposal,
        voteStripPosition
    } from '$lib/utils/voteStripPosition'

    type Proposal =
        | { actionIndex: number; kind: 'confirm'; preview: UndoVotePreview }
        | { actionIndex: number; kind: 'ownUndo' }

    const buttonClass = 'h-7 whitespace-nowrap'

    let props: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const gameSession = untrack(() => props.gameSession)

    const { gameService, authorizationService } = getAppContext()
    const { isViewingHistory, colors, gameState, showHistoryBeforeAction, showLiveGame } =
        gameSession.bridge
    const reportsPosition = gameSession.bridge.viewedHistoryPosition !== undefined
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

    // UI Artifacts without a reported position also lack showLiveGame, so their stand-in live
    // action count is never relied on.
    const position: ViewedHistoryPosition | undefined = $derived(
        voteStripPosition({
            reportsPosition,
            seated: voter !== undefined,
            viewedPosition: $viewedPosition,
            isViewingHistory: $isViewingHistory,
            actionCount: $gameState?.actionCount
        })
    )

    let proposal: Proposal | undefined = $state()
    const shown = $derived(shownProposal(proposal, position))

    let summary: { voteId: string; preview: UndoVotePreview | undefined } | undefined = $state()
    const voteSummary = $derived(summary?.voteId === vote?.id ? summary?.preview : undefined)
    const summarySettled = $derived(vote !== undefined && summary?.voteId === vote.id)
    const summaryTarget = $derived(
        vote?.kind === PlayerVoteKind.Undo && canVote
            ? { vote, lastActionAt: game.lastActionAt }
            : undefined
    )
    $effect(() => {
        const target = summaryTarget
        if (!target) return
        const voteId = target.vote.id
        gameService
            .previewUndoVote(game, target.vote.targetActionIndex)
            .then((preview) => {
                if (vote?.id === voteId) summary = { voteId, preview }
            })
            .catch((error: unknown) => {
                console.warn('Undo vote summary unavailable', error)
                if (vote?.id === voteId) {
                    summary = {
                        voteId,
                        preview: summary?.voteId === voteId ? summary.preview : undefined
                    }
                }
            })
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

    const heldUp = $derived(canVote && voter !== undefined && gameHoldsUpPlayer(game, voter))

    let noticedVoteIds = $derived(voter?.userId ? readNoticedVoteIds(voter.userId) : [])
    const noticeOpen = $derived(
        heldUp && vote !== undefined && summarySettled && !noticedVoteIds.includes(vote.id)
    )

    function dismissNotice(open: boolean) {
        if (open || !vote || !voter?.userId) return
        noticedVoteIds = rememberNoticedVote(voter.userId, vote.id)
    }

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

    function initiatorPlayerId(): string {
        assertExists(vote, 'Only an open vote names its initiator')
        return vote.initiatorPlayerId
    }
</script>

{#if canVote && vote}
    {@const approvals = vote.approvingPlayerIds}
    {@const declines = vote.kind === PlayerVoteKind.Call ? vote.decliningPlayerIds : []}
    <div class="vote-strip" role="status">
        <span class="line">
            <span class="font-medium text-white">
                <RichMessage
                    parts={voteRequestParts(vote, voteSummary, playerName, 'line')}
                    markup={{ player: initiatorChip, detail: requestDetail }}
                />
            </span>
        </span>
        <span class="line">
            <span class="inline-flex gap-1" aria-label={voteTally(vote, game.players)}>
                {#each voters as player (player.id)}
                    <span
                        class="h-2.5 w-2.5 rounded-full border-2"
                        class:border-gray-500={awaitsAnswerFrom(vote, player.id)}
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
                    >{m.games_vote_view_that_point()}</Button
                >
            {/if}
            {#if vote.initiatorPlayerId === voter?.id}
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.withdrawVote(game, vote.id))}
                    >{m.games_vote_withdraw()}</Button
                >
            {:else if voter && awaitsAnswerFrom(vote, voter.id)}
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.declineVote(game, vote.id))}
                    >{m.games_vote_decline()}</Button
                >
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => run(() => gameService.approveVote(game, vote.id))}
                    >{m.games_vote_agree()}</Button
                >
            {/if}
        </span>
        {#if heldUp}
            <span class="line own-line font-medium text-yellow-300"
                >{m.games_vote_answer_before_playing()}</span
            >
        {/if}
        {#if position}
            <span class="line own-line"><ViewingHistoryLine /></span>
        {/if}
    </div>
{:else if position}
    <div class="vote-strip">
        {#if shown?.kind === 'ownUndo'}
            <span class="line text-white">{m.games_vote_undo_yourself()}</span>
            <Button
                size="xs"
                color="alternative"
                class={buttonClass}
                onclick={() => (proposal = undefined)}>{m.games_vote_ok()}</Button
            >
        {:else if shown?.kind === 'confirm'}
            {@const preview = shown.preview}
            <span class="line">
                <span class="font-medium text-white">{m.games_vote_confirm_undo()}</span>
                <span class="text-gray-400">{undoneSummary(preview)}</span>
            </span>
            <span class="line">
                <Button
                    size="xs"
                    color="alternative"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => (proposal = undefined)}>{m.cancel()}</Button
                >
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => send(preview)}>{m.games_vote_send_request()}</Button
                >
            </span>
        {:else}
            {@const target = position}
            <span class="line"><ViewingHistoryLine /></span>
            {#if canVote && offersUndoRequest(target)}
                <Button
                    size="xs"
                    color="blue"
                    class={buttonClass}
                    disabled={busy}
                    onclick={() => ask(target.actionIndex)}
                    ><UndoOutline class="me-1.5 h-4 w-4" />{m.games_vote_ask_to_undo()}</Button
                >
            {/if}
        {/if}
    </div>
{/if}

{#snippet initiatorChip(name: string)}
    <span
        class="rounded px-1.5 font-semibold"
        style:background-color={$colors.getPlayerBgColorValue(initiatorPlayerId())}
        style:color={$colors.getPlayerTextColorValue(initiatorPlayerId())}>{name}</span
    >
{/snippet}

{#snippet requestDetail(text: string)}<span class="font-normal text-gray-400">{text}</span
    >{/snippet}

{#if noticeOpen && vote}
    <PlayerVoteNotice
        bind:open={() => noticeOpen, dismissNotice}
        parts={voteRequestParts(vote, voteSummary, playerName, 'sentence')}
        playerChip={initiatorChip}
    />
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
