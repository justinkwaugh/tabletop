<script lang="ts">
    import {
        ActionType,
        WarbandMoveKind,
        type WarbandMove,
        type WarbandMoveOption
    } from '@tabletop/oath'
    import FacedownAdviserPlay from '$lib/components/FacedownAdviserPlay.svelte'
    import LetPeekPicker from '$lib/components/LetPeekPicker.svelte'
    import PeekMenu from '$lib/components/PeekMenu.svelte'
    import ResolveTribunal from '$lib/components/ResolveTribunal.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import FavorTo from '$lib/components/FavorTo.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import { warbandFigure, warbandImage } from '$lib/images/pieceImages.js'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.1, R-6.3, R-6.5, R-6.7, R-6.8, R-9.4, R-7.6.3-H1; R-6.6 is `CitizenshipPanel` and `ConsentPanel`.
    let { action }: { action: ActionType } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let advisers = $derived(
        action === ActionType.PlayFacedownAdviser ? gameSession.facedownAdviserOptions : []
    )
    let chosenAdviser = $derived(advisers.find((a) => a.cardId === gameSession.adviserCardId))
    let moves = $derived(gameSession.warbandMoves.options)
    let exileOffers = $derived(gameSession.exileOffers)
    let selfExile = $derived(gameSession.selfExileOffer)
    const exileWidth = new ChoiceWidth()

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
        {:else if chosenAdviser}
            <!-- R-6.1 — the chosen card large, its plays and later steps beside it. -->
            <FacedownAdviserPlay
                cardId={chosenAdviser.cardId}
                placements={chosenAdviser.placements}
            />
        {:else}
            <CardChoiceRow
                choices={cardChoices(advisers.map((adviser) => adviser.cardId))}
                picked={[]}
                onpick={(cardId) => gameSession.chooseAdviser(cardId)}
                {busy}
                height={100}
            />
        {/if}
    {:else if action === ActionType.Peek}
        <PeekMenu />
    {:else if action === ActionType.LetPeek}
        <LetPeekPicker />
    {:else if action === ActionType.LeaveDealUnconfirmed}
        <ResolveTribunal />
    {:else if action === ActionType.MoveWarbands}
        {#if moves.length === 0}
            <p class="text-xs text-oath-text-muted">No warbands you may move.</p>
        {:else}
            <div class="flex flex-col gap-1.5" role="list" aria-label="Warband moves">
                {#each moves as option (JSON.stringify(option.move) + option.owner)}
                    {@const name = moveName(option)}
                    {@const color = gameSession.warbandColor(option.owner)}
                    <MenuRow
                        image={warbandImage(color)}
                        imageAlt={gameSession.warbandOwnerName(option.owner)}
                        {name}
                        points={gameSession.warbandMoves.points(option)}
                    >
                        <!-- A tap on the Nth warband moves N at once, so none is ever picked. -->
                        <TokenRow
                            image={warbandFigure(color)}
                            held={option.max}
                            addable={option.max}
                            picked={0}
                            label={(count) => `${name}: move ${count}`}
                            ontap={(count) => gameSession.warbandMoves.sendNow(option, count)}
                            tone="plain"
                            {busy}
                        />
                    </MenuRow>
                {/each}
            </div>
        {/if}
    {:else if action === ActionType.ExileCitizen}
        <!-- R-6.7 — each button is the price and whom it goes to; a tap exiles them. One width
             for all, the widest label's, on a phone as on a desktop; side by side while they fit,
             and those that do not go to the next line at the same width. -->
        <div class="flex flex-wrap self-start gap-2">
            {#each exileOffers as offer (offer.citizenPlayerId)}
                <button
                    type="button"
                    class="flex items-center justify-center rounded-md border border-oath-frame bg-oath-surface
                           px-3 py-1.5 text-[15px] font-semibold hover:border-oath-accent hover:bg-oath-accent-soft
                           disabled:opacity-40 max-sm:min-h-11"
                    aria-label="{offer.favor} favor to {gameSession.getPlayerName(
                        offer.citizenPlayerId
                    )}"
                    disabled={busy}
                    onclick={() => gameSession.exileCitizen(offer.citizenPlayerId)}
                >
                    <span class="flex justify-center" style:min-width="{exileWidth.widest}px">
                        <span class="flex w-max" {@attach exileWidth.measure}>
                            <FavorTo
                                favor={offer.favor}
                                playerId={offer.citizenPlayerId}
                                gold={true}
                            />
                        </span>
                    </span>
                </button>
            {/each}
        </div>
    {:else if action === ActionType.SelfExile && selfExile}
        <!-- R-6.8 — staged, so the price shows before it is paid; this sends it and ends the Act Phase. -->
        <button
            type="button"
            class="self-start rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover
                   disabled:opacity-40 border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
            aria-label="{selfExile.favor} favor to {gameSession.getPlayerName(selfExile.holderId)}"
            disabled={busy}
            onclick={() => gameSession.selfExile()}
        >
            <FavorTo favor={selfExile.favor} playerId={selfExile.holderId} gold={false} />
        </button>
    {/if}
</div>
