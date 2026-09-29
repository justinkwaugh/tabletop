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

<div class="rounded-lg bg-stone-900/70 border border-amber-500/40 px-3 py-2 text-stone-100">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">
        {question ? cardName(question.cardId) : 'A question'}
    </h3>

    {#if !question}
        <p class="text-sm text-stone-400">Nothing is waiting on an answer.</p>
    {:else if !draft.isMine}
        <p class="text-sm text-stone-300">
            Waiting on {gameSession.getPlayerName(question.askedPlayerId)} to answer {cardName(
                question.cardId
            )}
            {#if asking && asking !== question.askedPlayerId}(played by {gameSession.getPlayerName(
                    asking
                )}){/if}.
        </p>
    {:else if question.kind === PowerQuestionKind.BurnFavorForSecrets}
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
    {:else if question.kind === PowerQuestionKind.PayOrLoseRelic}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(question.takerPlayerId)} takes {cardName(
                question.relicCardId
            )} unless you give them {question.price} favor. You have {draft.myFavor}.
        </p>
        <QuestionYesNo yes="Pay {question.price} favor, keep it" no="Let them take it" />
    {:else if question.kind === PowerQuestionKind.PickFavorBank}
        <p class="text-sm mb-2">You gain {question.amount} favor from any one favor bank.</p>
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
    {:else if question.kind === PowerQuestionKind.Exchange}
        <p class="text-sm mb-1">
            {gameSession.getPlayerName(question.proposerPlayerId)} proposes a binding exchange (R-7.6.3):
        </p>
        <div class="mb-2 rounded border border-stone-700 px-2 py-1.5 text-xs">
            <div>
                {gameSession.getPlayerName(question.proposerPlayerId)} gives {transferText(
                    gameState,
                    question.terms.fromProposer,
                    question.proposerPlayerId
                )}
            </div>
            <div>
                {gameSession.getPlayerName(question.askedPlayerId)} gives {transferText(
                    gameState,
                    question.terms.fromCounterparty,
                    question.askedPlayerId
                )}
            </div>
        </div>
        <QuestionYesNo yes="Accept" no="Refuse" />
    {:else if question.kind === PowerQuestionKind.JoinSite}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: you may put your pawn at {siteName(
                gameState,
                question.siteId
            )}.
        </p>
        <QuestionYesNo yes="Go there" no="Stay" />
    {:else if question.kind === PowerQuestionKind.KeepOrBottomRelic}
        {@const relic =
            question.relicCardId !== undefined ? cardName(question.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: you drew {relic}. Take it, or put it on the bottom of the
            relic deck.
        </p>
        {#if question.relicCardId !== undefined}
            <div class="mb-2"><ShownCards cardIds={[question.relicCardId]} /></div>
        {/if}
        <QuestionYesNo yes="Take {relic}" no="Put it on the bottom" />
    {:else if question.kind === PowerQuestionKind.BottomRelic}
        {@const relic =
            question.relicCardId !== undefined ? cardName(question.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: you drew {relic}. Put it, or a relic you hold, on the
            bottom of the relic deck.
        </p>
        <p class="text-xs text-stone-400 mb-1">Tap the relic that goes to the bottom:</p>
        <CardChoiceRow
            choices={[
                ...(question.relicCardId !== undefined
                    ? [
                          {
                              key: question.relicCardId,
                              cardId: question.relicCardId,
                              label: cardName(question.relicCardId),
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
                void (cardId === question.relicCardId
                    ? draft.putOnBottom()
                    : draft.putOnBottom(cardId))}
            {busy}
            height={80}
        />
    {:else if question.kind === PowerQuestionKind.RerollDice}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: reroll {rolledDice(question.roll)} once? The roll stands as it
            is otherwise ({standingRoll(question.roll)}). The card's cost is paid if you do.
        </p>
        <QuestionYesNo yes="Reroll" no="Keep the roll" />
    {:else if question.kind === PowerQuestionKind.TravelFreeTo}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: travel to one of these sites, for no Supply.
        </p>
        <div class="flex flex-wrap gap-1">
            {#each question.siteIds as siteId (siteId)}
                <button
                    class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-1 text-xs"
                    disabled={busy}
                    onclick={() => draft.travelTo(siteId)}
                >
                    {siteName(gameState, siteId)}
                </button>
            {/each}
        </div>
    {:else if question.kind === PowerQuestionKind.ShroudedWoodDestination}
        <p class="text-sm mb-2">
            You rule the Shrouded Wood: choose where {gameSession.getPlayerName(
                question.travelerPlayerId
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
    {:else if question.kind === PowerQuestionKind.PlayOrDiscardConspiracy}
        <QuestionConspiracy {question} />
    {:else if question.kind === PowerQuestionKind.TakeOrLeaveRelic}
        {@const relic =
            question.relicCardId !== undefined ? cardName(question.relicCardId) : 'the relic'}
        <p class="text-sm mb-2">
            {cardName(question.cardId)}: the relic in {reliquaryLabel(question.slotId)} is
            {relic}. Take it, or leave it there.
        </p>
        {#if question.relicCardId !== undefined}
            <div class="mb-2"><ShownCards cardIds={[question.relicCardId]} /></div>
        {/if}
        <QuestionYesNo yes="Take {relic}" no="Leave it" />
    {:else if question.kind === PowerQuestionKind.RelicThiefRoll}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(question.takerPlayerId)} took {question.relicCardIds
                .map(cardName)
                .join(', ')}
            in your region. Use {cardName(question.cardId)} to roll {question.relicCardIds.length}
            defense
            {question.relicCardIds.length === 1 ? 'die' : 'dice'}: no shields, and the relics are
            yours. The card's cost is paid either way.
        </p>
        <QuestionYesNo yes="Roll for them" no="Let them go" />
    {:else if question.kind === PowerQuestionKind.PlayOrDiscardVision}
        <QuestionVision {question} />
    {:else if question.kind === PowerQuestionKind.DiscardInstead}
        <p class="text-sm mb-1">
            Your Nomad battle plans {question.planCardIds.map(cardName).join(', ')} are to be discarded.
            You may discard one Beast card you rule instead.
        </p>
        <div class="mb-2 text-xs">
            <span class="text-stone-400">Tap the Beast card to discard instead:</span>
            <CardChoiceRow
                choices={cardChoices(question.insteadCardIds)}
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
    {:else if question.kind === PowerQuestionKind.SneakAttack}
        <p class="text-sm mb-2">
            {gameSession.getPlayerName(question.defenderPlayerId)}'s Campaign is over. You may
            campaign against them now, for no Supply, while their turn waits.
        </p>
        <QuestionYesNo yes="Campaign" no="Pass" />
    {:else if question.kind === PowerQuestionKind.OrderDrawnCards || question.kind === PowerQuestionKind.OrderDiscards}
        <QuestionStackOrder {question} />
    {:else if question.kind === PowerQuestionKind.GatheringFloor}
        <QuestionGatheringFloor />
    {/if}
</div>
