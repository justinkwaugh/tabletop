<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists } from '@tabletop/common'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import {
        ActionType,
        PowerQuestionKind,
        RerolledRollKind,
        type RerolledRoll
    } from '@tabletop/oath'
    import QuestionCageReturn from '$lib/components/QuestionCageReturn.svelte'
    import QuestionConspiracy from '$lib/components/QuestionConspiracy.svelte'
    import QuestionForm from '$lib/components/QuestionForm.svelte'
    import QuestionGatheringFloor from '$lib/components/QuestionGatheringFloor.svelte'
    import QuestionStackOrder from '$lib/components/QuestionStackOrder.svelte'
    import QuestionToll from '$lib/components/QuestionToll.svelte'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import QuestionVision from '$lib/components/QuestionVision.svelte'
    import QuestionYesNo from '$lib/components/QuestionYesNo.svelte'
    import WoodStay from '$lib/components/WoodStay.svelte'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices, toggleSingle } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { favorToken } from '$lib/images/tileImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { tappedCount } from '$lib/model/exchangeTerms.js'
    import { cardName, listed, siteName, suitName, transferText } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Every "no" is a first-class button: silence is not an answer (R-X.1).
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.question)
    let busy = $derived(gameSession.busy)
    let question = $derived(draft.open)
    let mine = $derived(draft.mine)
    const discardWidth = new ChoiceWidth()
    const bankWidth = new ChoiceWidth()

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
            <!-- The favor held; the picked ones burn, so they are ringed rose. -->
            {@const burn = draft.burn ?? 0}
            <div class="mb-2">
                <TokenRow
                    image={favorToken()}
                    held={draft.myFavor}
                    addable={draft.myFavor}
                    picked={burn}
                    label={(n) => `burn ${n} favor`}
                    ontap={(n) => draft.setBurn(tappedCount(burn, n))}
                    tone="rose"
                    {busy}
                />
            </div>
            <QuestionYesNo yes="Burn" no="None" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.PayFromHomeBank}
        <!-- Vow of Kinship: what the board left owing, from its bank only as the player chooses. -->
        {@const home = draft.homeBank}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}<TokenText
                    text="Pay how many favor from {home
                        ? `the ${suitName(home.suit)} bank`
                        : 'your bank'}?"
                />{/snippet}
            <!-- The payable favor; the picked ones are placed, so they are ringed gold. -->
            {@const paying = draft.homeBankPay ?? 0}
            <div class="mb-2">
                <TokenRow
                    image={favorToken()}
                    held={home?.payable ?? 0}
                    addable={home?.payable ?? 0}
                    picked={paying}
                    label={(n) => `pay ${n} favor`}
                    ontap={(n) => draft.setHomeBankPay(tappedCount(paying, n))}
                    tone="gold"
                    {busy}
                />
            </div>
            <QuestionYesNo yes="Pay" no="None" />
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
    {:else if mine.kind === PowerQuestionKind.BottomRelic && draft.cageBoards.length > 0}
        <QuestionCageReturn />
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
        <!-- R-11.13-H1 — the sites are lit on the map (`BoardSitesLayer`); a tap there travels. -->
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Travel where? Free.{/snippet}
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.ShroudedWoodDestination}
        <!-- R-11.7 — the ruler picks on the lit map at every width, as for a Travel; a move that
             spends no Supply says so once. -->
        <p class="text-sm">
            Pick where <PlayerName playerId={mine.travelerPlayerId} /> goes.{draft.travelPick?.free
                ? ' Free.'
                : ''}
        </p>
        <WoodStay travelerId={mine.travelerPlayerId} />
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
    {:else if mine.kind === PowerQuestionKind.FreeActionOutOfTurn}
        {@const action = mine.action === ActionType.Travel ? 'Travel' : 'Campaign'}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}{action} now? Free.{/snippet}
            <QuestionYesNo yes={action} no="Skip" />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.OrderDrawnCards || mine.kind === PowerQuestionKind.OrderDiscards}
        <QuestionStackOrder />
    {:else if mine.kind === PowerQuestionKind.GatheringFloor}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Propose an exchange?{/snippet}
            <QuestionGatheringFloor />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.PayTravelToll}
        <QuestionToll question={mine} />
    {:else if mine.kind === PowerQuestionKind.DiscardAdvisers}
        <!-- R-7.6.4 — the adviser-discard pick of a question at the limit (Inquisitor's), after a
             swap; the card it gave is not offered. -->
        {@const refused = draft.adviserDiscardsBlockedBecause}
        <QuestionForm>
            {#snippet line()}Over the adviser limit: discard {draft.adviserDiscardCount}.{/snippet}
            <div class="mb-2">
                <CardChoiceRow
                    choices={cardChoices(draft.adviserDiscardChoices)}
                    picked={draft.adviserDiscards}
                    onpick={(cardId) => draft.toggleAdviserDiscard(cardId)}
                    {busy}
                    height={80}
                    discard
                />
            </div>
            {#if refused}<p class="mb-2 text-[11px] text-oath-danger">
                    <TokenText text={gameSession.humanizeReason(refused) ?? ''} />
                </p>{/if}
            {#if draft.adviserDiscardsComplete}
                <AnswerButton
                    primary
                    width={discardWidth}
                    disabled={busy}
                    onclick={() => draft.discardAdvisers()}
                >
                    Discard
                </AnswerButton>
            {/if}
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.FlipToTravel}
        <!-- R-11.13-H1 — The Hidden Place (or the Narrow Pass from the Buried Giant) only with a flip;
             R-11.13-H2 — both at once take two. -->
        {@const flips = mine.flips === 2 ? 'flip 2 secrets' : 'flip 1 secret'}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Travel to {siteName(gameState, mine.siteId)}?{/snippet}
            <QuestionYesNo yes="Travel" no="Stay" cost={flips} yesLabel={`Travel and ${flips}`} />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.WayStationFavor}
        <!-- R-11.7-H3 — Way Station at the Shrouded Wood's pick: its ruler's favor instead of the Supply;
             either answer travels: "Give 1 [favor]" / "Pay 2 Supply". The bandits' favor is burned. -->
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Spend no Supply by {#if mine.payeeId}giving <PlayerName
                        playerId={mine.payeeId}
                    />{:else}burning{/if}
                <FavorCost count={1} />?{/snippet}
            <QuestionYesNo
                yes={mine.payeeId ? 'Give' : 'Burn'}
                cost="1 favor"
                dot={!mine.payeeId}
                no="Pay {mine.supplyCost} Supply"
            />
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.HospitalityBank}
        <!-- R-11.7-H2 — Hospitality after the Shrouded Wood ruler's pick, two or more banks matching:
             one button per bank, "+1 [favor] [suit]" as on any Travel; one tap gains. -->
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}<TokenText text="Gain 1 favor from:" />{/snippet}
            <div class="flex flex-wrap gap-2">
                {#each mine.banks as suit (suit)}
                    <AnswerButton
                        width={bankWidth}
                        disabled={busy}
                        label="+1 favor from the {suitName(suit)} bank"
                        onclick={() => draft.gainHospitalityFavor(suit)}
                    >
                        <FavorCost count={1} sign="+" />
                        <img
                            class="inline-block h-[1.1em] w-auto"
                            src={suitImage(suit)}
                            alt="the {suitName(suit)} bank"
                        />
                    </AnswerButton>
                {/each}
            </div>
        </QuestionForm>
    {:else if mine.kind === PowerQuestionKind.DragonskinDrum}
        <QuestionForm cardId={mine.cardId}>
            {#snippet line()}Gain <TokenText
                    text="1 warband"
                    warbandColor={() => draft.drumWarbandColor}
                />?{/snippet}
            <QuestionYesNo yes="Gain" no="Skip" />
        </QuestionForm>
    {/if}
</div>
