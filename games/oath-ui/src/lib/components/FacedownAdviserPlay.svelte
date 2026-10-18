<script lang="ts">
    import { CardKind, IMPERIAL_WARBANDS, powerKey, SearchPlay } from '@tabletop/oath'
    import TokenText from '$lib/components/TokenText.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import ConspiracyTakePicker from '$lib/components/ConspiracyTakePicker.svelte'
    import ConspiracyNoTake from '$lib/components/ConspiracyNoTake.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import CardLine from '$lib/components/CardLine.svelte'
    import CardToggleRow from '$lib/components/CardToggleRow.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import PileRows from '$lib/components/PileRows.svelte'
    import { cardBack } from '$lib/images/cardImages.js'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, siteName } from '$lib/model/names.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { powerUseKey, samePowerUse } from '$lib/model/powerUse.js'
    import { actionCardLine, answerCostText } from '$lib/model/actionCards.js'
    import type { AdviserPlacement } from '$lib/model/adviserPlacements.js'
    import { PILE_SIDES, pickerWords } from '$lib/model/powerPickerWords.js'

    // R-6.1 — the chosen facedown adviser large on the left, ringed, with its magnifier; its plays,
    // then every later step of the play, in one column beside it. R-7.4 — each Search card the play
    // may use sits in the step it changes: a site New Growth opens under "Play to:", a card Crop
    // Rotation lets go first under "Discard first", the Cracked Horn's place and Bracken's piles
    // under "To", and a card that adds to the play (Wild Cry) as a row above the confirm. On a
    // phone Bracken's piles run under the card: the column beside it is too narrow for them.
    let { cardId, placements }: { cardId: string; placements: AdviserPlacement[] } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    const layout = new PhoneLayout()
    const playWidth = new ChoiceWidth()
    const placeWidth = new ChoiceWidth()
    const rowWidth = new ChoiceWidth()
    const sideWidth = new ChoiceWidth()

    let name = $derived(cardName(cardId))
    // 280 px tall on a desktop, 170 on a phone; a landscape Vision keeps a portrait card's width.
    let cardHeight = $derived(layout.narrow ? 170 : 280)
    let cardWidth = $derived(
        Math.min(
            widthAtHeight(cardHeight, { cardId }),
            widthAtHeight(cardHeight, { back: CardKind.Denizen })
        )
    )
    // A gained warband is drawn in the colour the seat gains it in, the Empire's for a Citizen.
    let owner = $derived(gameSession.musterWarbandOwner ?? IMPERIAL_WARBANDS)
    const warbandColor = () => gameSession.warbandColor(owner)

    let play = $derived(gameSession.adviserPlay)
    let chosen = $derived(placements.find((option) => option.play === play))
    let place = $derived(gameSession.adviserDiscardPlace)
    let complete = $derived(play !== undefined && gameSession.adviserPlayComplete)
    let reason = $derived(gameSession.adviserPlayReason)
    let confirmWord = $derived(play === SearchPlay.Discard ? 'Discard' : 'Play')
    let piles = $derived(gameSession.adviserDiscardPiles)
    let pilePicked = $derived(place !== 'pile' && !('cardId' in place) ? place : undefined)
    let pilesUnder = $derived(layout.narrow && piles.length > 0)

    const heading = 'text-[11px] font-semibold uppercase tracking-widest text-oath-heading'
</script>

<!-- Bracken: its piles, the Cracked Horn's world deck in the same list, then the pile's side;
     nothing picked until a tap, and "Discard" waits for a pile and a side, or the deck. -->
{#snippet pileTo()}
    <div data-discard-to>
        <h4 class="mb-1 {heading}">To</h4>
        <PileRows
            regions={piles}
            picked={pilePicked?.region}
            onpick={(region) => gameSession.setAdviserDiscardPile(region)}
            width={placeWidth}
        >
            {#snippet after()}
                {#each gameSession.adviserDiscardPlaces as card (powerKey(card.cardId, card.powerIndex))}
                    <MenuToggleRow
                        image={cardBack(gameSession.gameState.topCardBackType ?? CardKind.Denizen)}
                        name="Under the world deck"
                        shape="card"
                        on={place !== 'pile' && 'cardId' in place && samePowerUse(place, card)}
                        disabled={busy}
                        width={placeWidth}
                        onclick={() => gameSession.setAdviserDiscardPlace(powerUseKey(card))}
                    />
                {/each}
            {/snippet}
        </PileRows>
        <div class="mt-1.5 flex gap-2" role="group">
            <AnswerButton
                width={sideWidth}
                picked={pilePicked?.bottom === false}
                disabled={busy}
                onclick={() => gameSession.setAdviserDiscardSide(false)}
                >{PILE_SIDES.first}</AnswerButton
            >
            <AnswerButton
                width={sideWidth}
                picked={pilePicked?.bottom === true}
                disabled={busy}
                onclick={() => gameSession.setAdviserDiscardSide(true)}
                >{PILE_SIDES.second}</AnswerButton
            >
        </div>
    </div>
{/snippet}

{#snippet confirm()}
    {#if reason}
        <p class="text-[11px] text-oath-danger">
            <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
        </p>
    {/if}
    <!-- The gold-outline primary, as wide as its words. -->
    <button
        type="button"
        class="self-start rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-3 py-1 text-sm font-semibold max-sm:min-h-11"
        aria-label="{confirmWord} {name}"
        disabled={busy || !!reason}
        onclick={() => gameSession.confirmAdviserPlay()}
    >
        {confirmWord}
    </button>
{/snippet}

<div class="flex flex-col gap-2" data-facedown-play={cardId}>
    <div class="flex items-start gap-3 max-sm:gap-2">
        <div
            class="relative shrink-0 rounded-[5px] ring-2 ring-oath-accent"
            data-play-card
            style:width="{cardWidth}px"
        >
            <CardImage {cardId} width={cardWidth} label={name} />
            <Magnifier preview={{ cardId, label: name }} label={name} />
        </div>
        <div class="flex min-w-0 flex-col items-start gap-2" data-play-column>
            {#if !chosen}
                <div class="flex flex-col gap-1.5">
                    {#each placements as option (option.label)}
                        <MenuChoice
                            label="{option.label}: {name}"
                            disabled={busy}
                            width={playWidth}
                            onclick={() => gameSession.chooseAdviserPlay(cardId, option.play)}
                        >
                            {option.label}
                        </MenuChoice>
                    {/each}
                </div>
            {:else}
                <!-- The play chosen; Undo takes it back. -->
                <p
                    class="rounded-md border border-oath-accent bg-oath-accent-soft px-2.5 py-1.5 text-[15px] font-semibold ring-1 ring-oath-accent max-sm:flex max-sm:min-h-11 max-sm:items-center"
                    data-chosen-play
                >
                    {chosen.label}
                </p>
                {#if gameSession.adviserOtherSites.length > 0}
                    <label class="flex items-center gap-2 text-xs">
                        <span class="text-oath-text-muted">Play to:</span>
                        <select
                            disabled={busy}
                            class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs w-fit max-w-full"
                            value={gameSession.adviserToSite ?? ''}
                            onchange={(e) =>
                                gameSession.setAdviserToSite(e.currentTarget.value || undefined)}
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
                    <div class="text-xs">
                        <h4 class="mb-1 {heading}">Discard first</h4>
                        <CardChoiceRow
                            choices={cardChoices(gameSession.adviserDiscardFirstOptions)}
                            picked={gameSession.adviserDiscardFirst
                                ? [gameSession.adviserDiscardFirst]
                                : []}
                            onpick={(first) =>
                                gameSession.setAdviserDiscardFirst(
                                    toggleSingle(gameSession.adviserDiscardFirst, first)
                                )}
                            {busy}
                            height={72}
                        />
                    </div>
                {/if}
                {#if gameSession.adviserPlayRoom.needed > 0}
                    <p class="text-xs text-oath-text-muted">
                        Over the adviser limit: discard {gameSession.adviserPlayRoom.needed}.
                    </p>
                    <CardChoiceRow
                        choices={cardChoices(gameSession.adviserPlayRoom.discardable)}
                        picked={gameSession.adviserPlayDiscards}
                        onpick={(adviserId) => gameSession.toggleAdviserPlayDiscard(adviserId)}
                        {busy}
                        height={72}
                    />
                {/if}
                {#if gameSession.adviserConspiracyTargets.length > 0}
                    <ConspiracyTakePicker
                        targets={gameSession.adviserConspiracyTargets}
                        prizesOf={(target) => gameSession.adviserConspiracyPrizesOf(target)}
                        pick={gameSession.adviserConspiracyPick}
                        onchange={(pick) => gameSession.setAdviserConspiracyPick(pick)}
                    />
                {:else}
                    <!-- No one here can be taken from: why, where the take would be. -->
                    <ConspiracyNoTake lines={gameSession.adviserConspiracyNoTake} />
                {/if}
                {#if gameSession.adviserPlayChoices.length > 0}
                    <p class="text-xs text-oath-text-muted">Choose for its When Played power.</p>
                    <PowerChoicePicker
                        choices={gameSession.adviserPlayChoices}
                        bind:picks={
                            () => gameSession.adviserPlayPicks,
                            (picks) => gameSession.setAdviserPlayPicks(picks)
                        }
                        words={pickerWords(cardId)}
                        banks={gameSession.adviserPlayBanks}
                    />
                {/if}
                {#if piles.length > 0}
                    {#if !pilesUnder}{@render pileTo()}{/if}
                {:else if gameSession.adviserDiscardPlaces.length > 0}
                    <div>
                        <h4 class="mb-1 {heading}">To</h4>
                        <div class="flex flex-col gap-1.5">
                            <MenuChoice
                                label="The discard pile"
                                disabled={busy}
                                width={placeWidth}
                                picked={place === 'pile'}
                                onclick={() => gameSession.setAdviserDiscardPlace('pile')}
                            >
                                The discard pile
                            </MenuChoice>
                            {#each gameSession.adviserDiscardPlaces as card (powerKey(card.cardId, card.powerIndex))}
                                <MenuChoice
                                    label="Under the world deck"
                                    disabled={busy}
                                    width={placeWidth}
                                    picked={place !== 'pile' &&
                                        'cardId' in place &&
                                        samePowerUse(place, card)}
                                    onclick={() =>
                                        gameSession.setAdviserDiscardPlace(powerUseKey(card))}
                                >
                                    Under the world deck
                                </MenuChoice>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if gameSession.adviserCardRows.length > 0}
                    <div class="text-xs">
                        <h4 class="mb-1 {heading}">Cards</h4>
                        <div class="flex flex-col gap-1.5">
                            {#each gameSession.adviserCardRows as power (powerKey(power.cardId, power.powerIndex))}
                                <CardToggleRow
                                    cardId={power.cardId}
                                    on={gameSession.adviserRowsInUse.some((use) =>
                                        samePowerUse(use, power)
                                    )}
                                    disabled={busy}
                                    width={rowWidth}
                                    tagUnder
                                    onclick={() =>
                                        gameSession.toggleAdviserCardRow(powerUseKey(power))}
                                >
                                    {#snippet line()}<CardLine
                                            gives={actionCardLine(power.cardId)}
                                            cost={answerCostText(power.cost)}
                                            {warbandColor}
                                        />{/snippet}
                                </CardToggleRow>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if complete}
                    <div class="flex flex-col items-start gap-1 max-sm:hidden">
                        {@render confirm()}
                    </div>
                {/if}
            {/if}
        </div>
    </div>
    {#if chosen && pilesUnder}{@render pileTo()}{/if}
    {#if chosen && complete}
        <!-- On a phone the confirm goes under both, as wide as its words. -->
        <div class="flex flex-col items-start gap-1 sm:hidden">
            {@render confirm()}
        </div>
    {/if}
</div>
