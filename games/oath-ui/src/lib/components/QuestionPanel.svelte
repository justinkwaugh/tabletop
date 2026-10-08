<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists, range } from '@tabletop/common'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import { PowerQuestionKind, RerolledRollKind, type RerolledRoll } from '@tabletop/oath'
    import QuestionConspiracy from '$lib/components/QuestionConspiracy.svelte'
    import QuestionGatheringFloor from '$lib/components/QuestionGatheringFloor.svelte'
    import QuestionStackOrder from '$lib/components/QuestionStackOrder.svelte'
    import QuestionVision from '$lib/components/QuestionVision.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import ShownCards from '$lib/components/ShownCards.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
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
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        {question ? cardName(question.cardId) : 'A question'}
    </h3>

    {#if !question}
        <p class="text-sm text-oath-text-muted">Nothing is waiting on an answer.</p>
    {:else if !mine}
        <WaitingOn />
    {:else if mine.kind === PowerQuestionKind.BurnFavorForSecrets}
        <p class="text-sm mb-2">
            <TokenText
                text="You may burn any number of favor to gain as many secrets. You have {draft.myFavor} favor."
            />
        </p>
        <div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <TokenText text="burn favor" />
            <CountPicker
                values={range(0, draft.myFavor + 1)}
                picked={draft.burn}
                label={(n) => `burn ${n} favor`}
                onpick={(n) => draft.setBurn(n)}
                disabled={busy}
            />
        </div>
        <QuestionYesNo yes="Burn {draft.burn} for {draft.burn} secrets" no="Burn none" />
    {:else if mine.kind === PowerQuestionKind.PayOrLoseRelic}
        <p class="text-sm mb-2">
            <TokenText
                text="{gameSession.getPlayerName(mine.takerPlayerId)} takes {cardName(
                    mine.relicCardId
                )} unless you give them {mine.price} favor. You have {draft.myFavor} favor."
            />
        </p>
        <QuestionYesNo yes="Pay {mine.price} favor, keep it" no="Let them take it" />
    {:else if mine.kind === PowerQuestionKind.PickFavorBank}
        <p class="text-sm mb-2">
            <TokenText text="You gain {mine.amount} favor from any one favor bank." />
        </p>
        <SuitPicker
            suits={draft.favorBanks}
            picked={[]}
            onpick={(suit) => draft.takeFavorFrom(suit)}
            {busy}
        />
    {:else if mine.kind === PowerQuestionKind.Exchange}
        <p class="text-sm mb-1">
            {gameSession.getPlayerName(mine.proposerPlayerId)} proposes a binding exchange (R-7.6.3):
        </p>
        <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
            <div>
                {gameSession.getPlayerName(mine.proposerPlayerId)} gives <TokenText
                    text={transferText(gameState, mine.terms.fromProposer, mine.proposerPlayerId)}
                />
            </div>
            <div>
                {gameSession.getPlayerName(mine.askedPlayerId)} gives <TokenText
                    text={transferText(gameState, mine.terms.fromCounterparty, mine.askedPlayerId)}
                />
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
        <p class="text-xs text-oath-text-muted mb-1">Tap the relic that goes to the bottom:</p>
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
                    class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1 text-xs"
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
                    class="rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1 text-xs"
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
            <span class="text-oath-text-muted">Tap the Beast card to discard instead:</span>
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
