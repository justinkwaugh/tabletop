<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists, range } from '@tabletop/common'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import { PowerQuestionKind, RerolledRollKind, type RerolledRoll } from '@tabletop/oath'
    import QuestionConspiracy from '$lib/components/QuestionConspiracy.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import QuestionGatheringFloor from '$lib/components/QuestionGatheringFloor.svelte'
    import QuestionStackOrder from '$lib/components/QuestionStackOrder.svelte'
    import QuestionVision from '$lib/components/QuestionVision.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import QuestionWoodPick from '$lib/components/QuestionWoodPick.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { cardName, listed, siteName, transferText } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Every "no" is a first-class button: silence is not an answer (R-X.1).
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let question = $derived(draft.open)
    let mine = $derived(draft.mine)
    // Brass Horse's sites are equal choices, one width.
    const siteWidth = new ChoiceWidth()

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
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}<TokenText text="Burn how many favor for as many secrets?" />{/snippet}
            <div class="mb-2">
                <CountPicker
                    values={range(1, draft.myFavor)}
                    picked={draft.burn}
                    label={(n) => `burn ${n} favor`}
                    onpick={(n) => draft.setBurn(n)}
                    disabled={busy}
                />
            </div>
            <QuestionYesNo yes="Burn" no="None" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.PayOrLoseRelic}
        <QuestionForm cardId={mine.relicCardId}>
            {#snippet line()}Pay <PlayerName playerId={mine.takerPlayerId} />
                <TokenText text="{mine.price} favor" /> to keep {cardName(
                    mine.relicCardId
                )}?{/snippet}
            <QuestionYesNo yes="Pay" no="Refuse" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.PickFavorBank}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}<TokenText
                    text="Gain {mine.amount} favor from which bank?"
                />{/snippet}
            <SuitPicker
                suits={draft.favorBanks}
                picked={[]}
                onpick={(suit) => draft.takeFavorFrom(suit)}
                {busy}
            />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.Exchange}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Exchange with <PlayerName
                    playerId={mine.proposerPlayerId}
                />?{/snippet}
            <div class="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span class="text-oath-text-muted">You get</span>
                <span>
                    <TokenText
                        text={transferText(
                            gameState,
                            mine.terms.fromProposer,
                            mine.proposerPlayerId
                        )}
                    />
                </span>
                <span class="text-oath-text-muted">You give</span>
                <span>
                    <TokenText
                        text={transferText(
                            gameState,
                            mine.terms.fromCounterparty,
                            mine.askedPlayerId
                        )}
                    />
                </span>
            </div>
            <QuestionYesNo yes="Accept" no="Refuse" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.JoinSite}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Go to {siteName(gameState, mine.siteId)}?{/snippet}
            <QuestionYesNo yes="Go" no="Stay" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.KeepOrBottomRelic}
        <QuestionForm cardId={mine.relicCardId}>
            {#snippet line()}Take {cardName(mine.relicCardId)}?{/snippet}
            <QuestionYesNo yes="Take" no="To the bottom" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.BottomRelic}
        <QuestionForm>
            {#snippet line()}Which relic goes to the bottom?{/snippet}
            <CardChoiceRow
                choices={[
                    {
                        key: mine.relicCardId,
                        cardId: mine.relicCardId,
                        label: cardName(mine.relicCardId),
                        caption: 'drawn'
                    },
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
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.RerollDice}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Reroll {rolledDice(mine.roll)}? Now {standingRoll(
                    mine.roll
                )}.{/snippet}
            <QuestionYesNo yes="Reroll" no="Keep" cost={draft.acceptCost} />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.TravelFreeTo}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Travel where? Free.{/snippet}
            <div class="flex flex-wrap gap-1.5">
                {#each mine.siteIds as siteId (siteId)}
                    <MenuChoice
                        label="Travel to {siteName(gameState, siteId)}"
                        disabled={busy}
                        width={siteWidth}
                        onclick={() => draft.travelTo(siteId)}
                    >
                        {siteName(gameState, siteId)}
                    </MenuChoice>
                {/each}
            </div>
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.ShroudedWoodDestination && mine.travel}
        <QuestionWoodPick question={mine} />
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
        <QuestionConspiracy />
    {:else if mine.kind === PowerQuestionKind.TakeOrLeaveRelic}
        <QuestionForm cardId={mine.relicCardId}>
            {#snippet line()}Take {cardName(mine.relicCardId)}?{/snippet}
            <QuestionYesNo yes="Take" no="Leave" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.RelicThiefRoll}
        {@const one = mine.relicCardIds.length === 1}
        <QuestionForm cardId={one ? mine.relicCardIds[0] : mine.cardId}>
            {#snippet line()}Roll {mine.relicCardIds.length} defense {one ? 'die' : 'dice'} for {listed(
                    mine.relicCardIds.map(cardName)
                )}? No shields takes {one ? 'it' : 'them'}.{/snippet}
            <QuestionYesNo yes="Roll" no="Pass" cost={draft.acceptCost} />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.PlayOrDiscardVision}
        <QuestionVision question={mine} />
    {:else if mine.kind === PowerQuestionKind.DiscardInstead}
        <QuestionForm>
            {#snippet line()}<TokenText
                    text="Discard one Beast card instead of {listed(
                        mine.planCardIds.map(cardName)
                    )}?"
                />{/snippet}
            <div class="mb-2">
                <CardChoiceRow
                    choices={cardChoices(mine.insteadCardIds)}
                    picked={draft.instead ? [draft.instead] : []}
                    onpick={(cardId) => draft.chooseInstead(toggleSingle(draft.instead, cardId))}
                    {busy}
                    height={80}
                />
            </div>
            <QuestionYesNo yes="Discard instead" no="Discard plans" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.SneakAttack}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Campaign against <PlayerName playerId={mine.defenderPlayerId} /> now? Free.{/snippet}
            <QuestionYesNo yes="Campaign" no="Pass" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.OrderDrawnCards || mine.kind === PowerQuestionKind.OrderDiscards}
        <QuestionStackOrder />
    {:else if mine.kind === PowerQuestionKind.GatheringFloor}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Propose an exchange?{/snippet}
            <QuestionGatheringFloor />
        </QuestionForm>
    {/if}
</div>
