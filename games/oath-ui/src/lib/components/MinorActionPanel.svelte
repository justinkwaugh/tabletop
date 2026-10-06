<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { range } from '@tabletop/common'
    import {
        ActionType,
        WarbandMoveKind,
        type WarbandMove,
        type WarbandMoveOption
    } from '@tabletop/oath'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import LetPeekPicker from '$lib/components/LetPeekPicker.svelte'
    import PeekMenu from '$lib/components/PeekMenu.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { warbandImage } from '$lib/images/pieceImages.js'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, siteName } from '$lib/model/names.js'

    // R-6.1, R-6.3, R-6.5, R-6.7, R-9.4; R-6.6 is `CitizenshipPanel` and `ConsentPanel`.
    let { action }: { action: ActionType } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let advisers = $derived(
        action === ActionType.PlayFacedownAdviser ? gameSession.facedownAdviserOptions : []
    )
    let chosenAdviser = $derived(advisers.find((a) => a.cardId === gameSession.adviserCardId))
    let moves = $derived(gameSession.warbandMoves.options)
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

    function moveName(option: WarbandMoveOption): string {
        const other = otherPlayerOf(option.move)
        const to = other ? ` — ${gameSession.getPlayerName(other)}` : ''
        return `${MOVE_LABELS[option.move.kind]}${to}`
    }
</script>

<div class="flex flex-col gap-1">
    {#if action === ActionType.PlayFacedownAdviser}
        {#if advisers.length === 0}
            <p class="text-xs text-oath-text-muted">No facedown adviser to play.</p>
        {:else}
            <CardChoiceRow
                choices={cardChoices(advisers.map((adviser) => adviser.cardId))}
                picked={chosenAdviser ? [chosenAdviser.cardId] : []}
                onpick={(cardId) => gameSession.chooseAdviser(cardId)}
                {busy}
                height={100}
            />
        {/if}
        {#if chosenAdviser}
            {@const adviser = chosenAdviser}
            <div class="flex items-start gap-2">
                {#if gameSession.adviserPlay !== undefined}
                    {@const reason = gameSession.adviserPlayReason}
                    <div class="grow">
                        {#if gameSession.adviserOtherSites.length > 0}
                            <label class="mb-1 flex items-center gap-2 text-xs">
                                <span class="text-oath-text-muted">Play to:</span>
                                <select
                                    disabled={busy}
                                    class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs grow"
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
                                <span class="text-oath-text-muted">Discard first:</span>
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
                            <p class="text-xs text-oath-text-muted mb-1">
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
                            <p class="text-xs text-oath-text-muted mb-1">
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
                            <p class="text-[11px] text-oath-danger">
                                <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                            </p>
                        {/if}
                        <button
                            class="mt-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs"
                            disabled={busy || !!reason}
                            onclick={() => gameSession.confirmAdviserPlay()}
                        >
                            Play {cardName(adviser.cardId)}
                        </button>
                    </div>
                {:else}
                    <div class="flex flex-wrap gap-1.5 grow">
                        {#each adviser.placements.filter((p) => p.blockedBecause === undefined) as option (option.label)}
                            <MenuChoice
                                label="{option.label}: {cardName(adviser.cardId)}"
                                disabled={busy}
                                onclick={() =>
                                    gameSession.chooseAdviserPlay(adviser.cardId, option.play)}
                            >
                                {option.label}
                            </MenuChoice>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {:else if action === ActionType.Peek}
        <PeekMenu />
    {:else if action === ActionType.LetPeek}
        <LetPeekPicker />
    {:else if action === ActionType.MoveWarbands}
        {#if moves.length === 0}
            <p class="text-xs text-oath-text-muted">No warbands you may move.</p>
        {:else}
            <div class="flex flex-col gap-1.5" role="list" aria-label="Warband moves">
                {#each moves as option (JSON.stringify(option.move) + option.owner)}
                    {@const name = moveName(option)}
                    <MenuRow
                        image={warbandImage(gameSession.warbandColor(option.owner))}
                        imageAlt={gameSession.warbandOwnerName(option.owner)}
                        {name}
                        points={gameSession.warbandMoves.points(option)}
                    >
                        <CountPicker
                            values={range(1, option.max)}
                            picked={undefined}
                            label={(count) => `${name}: move ${count}`}
                            onpick={(count) => gameSession.warbandMoves.sendNow(option, count)}
                            disabled={busy}
                        />
                    </MenuRow>
                {/each}
            </div>
        {/if}
    {:else if action === ActionType.ExileCitizen}
        {#each citizens as citizenPlayerId (citizenPlayerId)}
            <button
                class="rounded border border-oath-frame bg-oath-surface-raised hover:border-oath-accent
                       px-2 py-1 text-sm text-left"
                disabled={busy}
                onclick={() => gameSession.exileCitizen(citizenPlayerId)}
            >
                Exile {gameSession.getPlayerName(citizenPlayerId)}
            </button>
        {/each}
    {/if}
</div>
