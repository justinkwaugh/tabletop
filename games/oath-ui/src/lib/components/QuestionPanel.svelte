<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { PowerQuestionKind, RerolledRollKind, type RerolledRoll } from '@tabletop/oath'
    import QuestionConspiracy from '$lib/components/QuestionConspiracy.svelte'
    import QuestionGatheringFloor from '$lib/components/QuestionGatheringFloor.svelte'
    import QuestionStackOrder from '$lib/components/QuestionStackOrder.svelte'
    import QuestionVision from '$lib/components/QuestionVision.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import ShownCards from '$lib/components/ShownCards.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { cardName, reliquaryLabel, siteName, transferText } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Every "no" is a first-class button: silence is not an answer (R-X.1).
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let question = $derived(draft.open)
    let mine = $derived(draft.mine)
    let asking = $derived(gameState.pendingQuestions?.askingPlayerId)

    // Jinx — "after you roll … for any reason".
    function rolledDice(roll: RerolledRoll): string {
        if (roll.kind === RerolledRollKind.Campaign) return `the ${roll.side} dice`
        return roll.kind === RerolledRollKind.GamblingHall
            ? 'the Gambling Hall dice'
            : 'the Relic Thief dice'
    }

    function standingRoll(roll: RerolledRoll): string {
        if (roll.kind !== RerolledRollKind.Campaign) return `${roll.shields} shields`
        const campaign = gameState.campaign
        assertExists(campaign, 'A Campaign reroll is offered only mid-Campaign')
        return roll.side === 'attack' ? `${campaign.swords} swords` : `${campaign.defense} defense`
    }
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">
        {question ? cardName(question.cardId) : 'A question'}
    </h3>

    {#if !question}
        <p class="text-sm text-stone-400">Nothing is waiting on an answer.</p>
    {:else if !mine}
        <p class="text-sm text-stone-300">
            Waiting on {gameSession.getPlayerName(question.askedPlayerId)} to answer {cardName(
                question.cardId
            )}
            {#if asking && asking !== question.askedPlayerId}(played by {gameSession.getPlayerName(
                    asking
                )}){/if}.
        </p>
    {:else if mine.kind === PowerQuestionKind.BurnFavorForSecrets}
        <p class="text-sm mb-2">
            You may burn any number of favor to gain as many secrets. You have {draft.myFavor} favor.
        </p>
        <label class="flex items-center gap-2 text-xs mb-2">
            burn
            <input
                type="number"
                min="0"
                max={draft.myFavor}
                disabled={busy}
                value={draft.burn}
                oninput={(e) => draft.setBurn(Number(e.currentTarget.value) || 0)}
                class="w-16 rounded bg-stone-800 px-1 py-0.5"
            />
            favor
        </label>
        <QuestionYesNo yes="Burn {draft.burn} for {draft.burn} secrets" no="Burn none" />
    {:else if mine.kind === PowerQuestionKind.PayOrLoseRelic}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(mine.takerPlayerId)} takes {cardName(mine.relicCardId)} unless
            you give them {mine.price} favor. You have {draft.myFavor}.
        </p>
        <QuestionYesNo yes="Pay {mine.price} favor, keep it" no="Let them take it" />
    {:else if mine.kind === PowerQuestionKind.PickFavorBank}
        <p class="text-sm mb-2">You gain {mine.amount} favor from any one favor bank.</p>
        <div class="flex flex-wrap gap-1">
            {#each draft.favorBanks as suit (suit)}
                <button
                    class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-1 text-xs capitalize"
                    disabled={busy}
                    onclick={() => draft.takeFavorFrom(suit)}
                >
                    {suit} ({gameState.favorBank[suit]})
                </button>
            {/each}
        </div>
    {:else if mine.kind === PowerQuestionKind.Exchange}
        <p class="text-sm mb-1">
            {gameSession.getPlayerName(mine.proposerPlayerId)} proposes a binding exchange (R-7.6.3):
        </p>
        <div class="mb-2 border-t border-stone-700/60 pt-1.5 text-xs">
            <div>
                {gameSession.getPlayerName(mine.proposerPlayerId)} gives {transferText(
                    gameState,
                    mine.terms.fromProposer,
                    mine.proposerPlayerId
                )}
            </div>
            <div>
                {gameSession.getPlayerName(mine.askedPlayerId)} gives {transferText(
                    gameState,
                    mine.terms.fromCounterparty,
                    mine.askedPlayerId
                )}
            </div>
        </div>
        <QuestionYesNo yes="Accept" no="Refuse" />
    {:else if mine.kind === PowerQuestionKind.JoinSite}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: you may put your pawn at {siteName(gameState, mine.siteId)}.
        </p>
        <QuestionYesNo yes="Go there" no="Stay" />
    {:else if mine.kind === PowerQuestionKind.KeepOrBottomRelic}
        {@const relic = mine.relicCardId !== undefined ? cardName(mine.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: you drew {relic}. Take it, or put it on the bottom of the relic
            deck.
        </p>
        {#if mine.relicCardId !== undefined}
            <div class="mb-2"><ShownCards cardIds={[mine.relicCardId]} /></div>
        {/if}
        <QuestionYesNo yes="Take {relic}" no="Put it on the bottom" />
    {:else if mine.kind === PowerQuestionKind.BottomRelic}
        {@const relic = mine.relicCardId !== undefined ? cardName(mine.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: you drew {relic}. Put it, or a relic you hold, on the bottom of
            the relic deck.
        </p>
        <p class="text-xs text-stone-400 mb-1">Tap the relic that goes to the bottom:</p>
        <CardChoiceRow
            choices={[
                ...(mine.relicCardId !== undefined
                    ? [
                          {
                              key: mine.relicCardId,
                              cardId: mine.relicCardId,
                              label: cardName(mine.relicCardId),
                              caption: 'the one drawn'
                          }
                      ]
                    : []),
                ...cardChoices(draft.heldRelicsToBottom).map((choice) => ({
                    ...choice,
                    caption: 'yours'
                }))
            ]}
            picked={[]}
            onpick={(cardId) =>
                void (cardId === mine.relicCardId
                    ? draft.putOnBottom()
                    : draft.putOnBottom(cardId))}
            {busy}
            height={80}
        />
    {:else if mine.kind === PowerQuestionKind.RerollDice}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: reroll {rolledDice(mine.roll)} once? The roll stands as it is otherwise
            ({standingRoll(mine.roll)}). The card's cost is paid if you do.
        </p>
        <QuestionYesNo yes="Reroll" no="Keep the roll" />
    {:else if mine.kind === PowerQuestionKind.TravelFreeTo}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: travel to one of these sites, for no Supply.
        </p>
        <div class="flex flex-wrap gap-1">
            {#each mine.siteIds as siteId (siteId)}
                <button
                    class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-1 text-xs"
                    disabled={busy}
                    onclick={() => draft.travelTo(siteId)}
                >
                    {siteName(gameState, siteId)}
                </button>
            {/each}
        </div>
    {:else if mine.kind === PowerQuestionKind.ShroudedWoodDestination}
        <p class="text-sm mb-2">
            You rule the Shrouded Wood: choose where {gameSession.getPlayerName(
                mine.travelerPlayerId
            )} goes.
        </p>
        <div class="flex flex-wrap gap-1">
            {#each draft.woodDestinations as siteId (siteId)}
                <button
                    class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-1 text-xs"
                    disabled={busy}
                    onclick={() => draft.sendThrough(siteId)}
                >
                    {siteName(gameState, siteId)}
                </button>
            {/each}
        </div>
    {:else if mine.kind === PowerQuestionKind.PlayOrDiscardConspiracy}
        <QuestionConspiracy question={mine} />
    {:else if mine.kind === PowerQuestionKind.TakeOrLeaveRelic}
        {@const relic = mine.relicCardId !== undefined ? cardName(mine.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(mine.cardId)}: the relic in {reliquaryLabel(mine.slotId)} is
            {relic}. Take it, or leave it there.
        </p>
        {#if mine.relicCardId !== undefined}
            <div class="mb-2"><ShownCards cardIds={[mine.relicCardId]} /></div>
        {/if}
        <QuestionYesNo yes="Take {relic}" no="Leave it" />
    {:else if mine.kind === PowerQuestionKind.RelicThiefRoll}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(mine.takerPlayerId)} took {mine.relicCardIds
                .map(cardName)
                .join(', ')}
            in your region. Use {cardName(mine.cardId)} to roll {mine.relicCardIds.length}
            defense
            {mine.relicCardIds.length === 1 ? 'die' : 'dice'}: no shields, and the relics are yours.
            The card's cost is paid either way.
        </p>
        <QuestionYesNo yes="Roll for them" no="Let them go" />
    {:else if mine.kind === PowerQuestionKind.PlayOrDiscardVision}
        <QuestionVision question={mine} />
    {:else if mine.kind === PowerQuestionKind.DiscardInstead}
        <p class="text-sm mb-1">
            Your Nomad battle plans {mine.planCardIds.map(cardName).join(', ')} are to be discarded. You
            may discard one Beast card you rule instead.
        </p>
        <div class="mb-2 text-xs">
            <span class="text-stone-400">Tap the Beast card to discard instead:</span>
            <CardChoiceRow
                choices={cardChoices(mine.insteadCardIds)}
                picked={draft.instead ? [draft.instead] : []}
                onpick={(cardId) => draft.chooseInstead(toggleSingle(draft.instead, cardId))}
                {busy}
                height={80}
            />
        </div>
        <QuestionYesNo
            yes="Discard {draft.instead ? cardName(draft.instead) : 'it'} instead"
            no="Discard the plans"
        />
    {:else if mine.kind === PowerQuestionKind.SneakAttack}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(mine.defenderPlayerId)}'s Campaign is over. You may campaign
            against them now, for no Supply, while their turn waits.
        </p>
        <QuestionYesNo yes="Campaign" no="Pass" />
    {:else if mine.kind === PowerQuestionKind.OrderDrawnCards || mine.kind === PowerQuestionKind.OrderDiscards}
        <QuestionStackOrder question={mine} />
    {:else if mine.kind === PowerQuestionKind.GatheringFloor}
        <QuestionGatheringFloor />
    {/if}
</div>
