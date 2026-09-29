<script lang="ts">
    import { range } from '@tabletop/common'
    import { ActionType, WarbandMoveKind, type WarbandMove } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import LetPeekPicker from '$lib/components/LetPeekPicker.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, humanizeReason, siteName } from '$lib/model/names.js'

    // R-6.1, R-6.3, R-6.5, R-6.7, R-9.4; R-6.6 is `CitizenshipPanel` and `ConsentPanel`.
    let { action }: { action: ActionType } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let advisers = $derived(
        action === ActionType.PlayFacedownAdviser ? gameSession.facedownAdviserOptions : []
    )
    let chosenAdviser = $derived(advisers.find((a) => a.cardId === gameSession.adviserCardId))
    let chosenMove = $derived(gameSession.warbandMoves.chosen)
    let peekTargets = $derived(gameSession.peekTargets)
    let moves = $derived(gameSession.warbandMoves.options)
    let imperialMoves = $derived(
        moves.filter(
            (o) =>
                o.move.kind === WarbandMoveKind.GiveToImperial ||
                o.move.kind === WarbandMoveKind.TakeFromImperial
        )
    )
    let citizens = $derived(gameSession.exileTargets)

    const MOVE_LABELS: Record<WarbandMoveKind, string> = {
        [WarbandMoveKind.SiteToBoard]: 'From your site to your board',
        [WarbandMoveKind.BoardToSite]: 'From your board to your site',
        [WarbandMoveKind.GiveToImperial]: 'Give to another Imperial player',
        [WarbandMoveKind.TakeFromImperial]: 'Take from another Imperial player'
    }

    function otherPlayerOf(move: WarbandMove): string | undefined {
        return 'otherPlayerId' in move ? move.otherPlayerId : undefined
    }
</script>

<div class="flex flex-col gap-1">
    {#if action === ActionType.PlayFacedownAdviser}
        {#if !chosenAdviser}
            <p class="text-xs text-stone-400">
                {advisers.length === 0
                    ? 'No facedown adviser to play.'
                    : 'Tap one of your facedown advisers, on your card.'}
            </p>
        {:else}
            {@const adviser = chosenAdviser}
            <div class="flex items-start gap-2">
                <CardImage
                    cardId={adviser.cardId}
                    width={44}
                    label={cardName(adviser.cardId)}
                    inspect
                />
                {#if gameSession.adviserPlay !== undefined}
                    {@const reason = gameSession.adviserPlayReason}
                    <div class="grow">
                        {#if gameSession.adviserOtherSites.length > 0}
                            <label class="mb-1 flex items-center gap-2 text-xs">
                                <span class="text-stone-400">Play to:</span>
                                <select
                                    disabled={busy}
                                    class="rounded bg-stone-800 px-1 py-0.5 text-xs grow"
                                    value={gameSession.adviserToSite ?? ''}
                                    onchange={(e) =>
                                        gameSession.setAdviserToSite(
                                            e.currentTarget.value || undefined
                                        )}
                                >
                                    <option value="">your site</option>
                                    {#each gameSession.adviserOtherSites as siteId (siteId)}
                                        <option value={siteId}
                                            >{siteName(gameSession.gameState, siteId)}</option
                                        >
                                    {/each}
                                </select>
                            </label>
                        {/if}
                        {#if gameSession.adviserDiscardFirstOptions.length > 0}
                            <div class="mb-1 text-xs">
                                <span class="text-stone-400">Discard first:</span>
                                <CardChoiceRow
                                    choices={cardChoices(gameSession.adviserDiscardFirstOptions)}
                                    picked={gameSession.adviserDiscardFirst
                                        ? [gameSession.adviserDiscardFirst]
                                        : []}
                                    onpick={(cardId) =>
                                        gameSession.setAdviserDiscardFirst(
                                            toggleSingle(gameSession.adviserDiscardFirst, cardId)
                                        )}
                                    {busy}
                                    height={72}
                                />
                            </div>
                        {/if}
                        {#if gameSession.adviserPlayRoom.needed > 0}
                            <p class="text-xs text-stone-300 mb-1">
                                Over the adviser limit: discard {gameSession.adviserPlayRoom
                                    .needed}.
                            </p>
                            <div class="mb-1">
                                <CardChoiceRow
                                    choices={cardChoices(gameSession.adviserPlayRoom.discardable)}
                                    picked={gameSession.adviserPlayDiscards}
                                    onpick={(cardId) =>
                                        gameSession.toggleAdviserPlayDiscard(cardId)}
                                    {busy}
                                    height={72}
                                />
                            </div>
                        {/if}
                        {#if gameSession.adviserConspiracyTargets.length > 0}
                            <ConspiracyTakePicker
                                targets={gameSession.adviserConspiracyTargets}
                                prizesOf={(target) => gameSession.adviserConspiracyPrizesOf(target)}
                                pick={gameSession.adviserConspiracyPick}
                                onchange={(pick) => gameSession.setAdviserConspiracyPick(pick)}
                            />
                        {/if}
                        {#if gameSession.adviserPlayChoices.length > 0}
                            <p class="text-xs text-stone-300 mb-1">
                                Choose for its When Played power.
                            </p>
                            <PowerChoicePicker
                                choices={gameSession.adviserPlayChoices}
                                bind:picks={
                                    () => gameSession.adviserPlayPicks,
                                    (picks) => gameSession.setAdviserPlayPicks(picks)
                                }
                            />
                        {/if}
                        {#if reason}
                            <p class="text-[11px] text-rose-300">{humanizeReason(reason)}</p>
                        {/if}
                        <button
                            class="mt-1 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5 text-xs"
                            disabled={busy || !!reason}
                            onclick={() => gameSession.confirmAdviserPlay()}
                        >
                            Play {cardName(adviser.cardId)}
                        </button>
                    </div>
                {:else}
                    <div class="flex flex-wrap gap-1 grow">
                        {#each adviser.placements as option (option.label)}
                            <button
                                class="rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 px-2 py-1 text-xs text-left"
                                disabled={busy || option.blockedBecause !== undefined}
                                title={humanizeReason(option.blockedBecause)}
                                onclick={() =>
                                    gameSession.chooseAdviserPlay(adviser.cardId, option.play)}
                            >
                                {option.label}{#if option.blockedBecause}<span
                                        class="text-stone-500"
                                        >&nbsp;— {humanizeReason(option.blockedBecause)}</span
                                    >{/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {:else if action === ActionType.Peek}
        <p class="text-xs text-stone-400">
            {peekTargets.length === 0 ? 'Nothing to peek at.' : 'Tap a lit relic at your site.'}
        </p>
    {:else if action === ActionType.LetPeek}
        <LetPeekPicker />
    {:else if action === ActionType.MoveWarbands}
        {#if chosenMove}
            {@const otherPlayerId = otherPlayerOf(chosenMove.move)}
            <div class="text-xs text-stone-300 mb-1">
                {MOVE_LABELS[chosenMove.move.kind]}
                {#if otherPlayerId}
                    — {gameSession.getPlayerName(otherPlayerId)}
                {/if}
                <span class="text-stone-500">— how many?</span>
            </div>
            <div class="flex gap-1 flex-wrap">
                {#each range(1, chosenMove.max) as count (count)}
                    <button
                        class="rounded bg-amber-700 hover:bg-amber-600 px-2.5 py-1 text-sm font-semibold"
                        disabled={busy}
                        onclick={() => gameSession.warbandMoves.send(count)}
                    >
                        {count}
                    </button>
                {/each}
            </div>
        {:else}
            <p class="text-xs text-stone-400">
                {moves.length === 0
                    ? 'No warbands you may move.'
                    : `Tap ${gameSession.warbandMoves.boardToSite ? 'your site on the map to move warbands onto it' : ''}${gameSession.warbandMoves.boardToSite && gameSession.warbandMoves.siteToBoard ? ', or ' : ''}${gameSession.warbandMoves.siteToBoard ? 'the Board counter on your card to bring them back' : ''}.`}
            </p>
            {#each gameSession.warbandMoves.byColour as option (option.move.kind + option.color)}
                <button
                    class="rounded border border-amber-500/40 bg-stone-800/60 hover:border-amber-300 px-2 py-1 text-xs text-left"
                    disabled={busy}
                    onclick={() => gameSession.warbandMoves.choose(option)}
                >
                    {MOVE_LABELS[option.move.kind]}
                    <span class="text-stone-500">({option.color}, up to {option.max})</span>
                </button>
            {/each}
            {#each imperialMoves as option (JSON.stringify(option.move) + option.color)}
                {@const otherPlayerId = otherPlayerOf(option.move)}
                <button
                    class="rounded border border-amber-500/40 bg-stone-800/60 hover:border-amber-300 px-2 py-1 text-xs text-left"
                    disabled={busy}
                    onclick={() => gameSession.warbandMoves.choose(option)}
                >
                    {MOVE_LABELS[option.move.kind]} — {otherPlayerId
                        ? gameSession.getPlayerName(otherPlayerId)
                        : ''}
                    <span class="text-stone-500">({option.color}, up to {option.max})</span>
                </button>
            {/each}
        {/if}
    {:else if action === ActionType.ExileCitizen}
        {#each citizens as citizenPlayerId (citizenPlayerId)}
            <button
                class="rounded border border-amber-500/40 bg-stone-800/60 hover:border-amber-300
                       px-2 py-1 text-sm text-left"
                disabled={busy}
                onclick={() => gameSession.exileCitizen(citizenPlayerId)}
            >
                Exile {gameSession.getPlayerName(citizenPlayerId)}
            </button>
        {/each}
    {/if}
</div>
