<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { directiveText, fulfilledIn } from '$lib/utils/directives.js'
    import {
        AnomalyBackKind,
        CargoPartnerKind,
        DIRECTIVE_INFLUENCE,
        DIRECTIVE_REDRAW_COST,
        directiveDefinition,
        isChooseDirective,
        isDealDirectives,
        isRedrawDirective,
        type HeldDirective,
        MarkerReason,
        RepairMethod,
        TechField,
        anomalyDefinition,
        CASH_PER_INFLUENCE,
        CASH_PRODUCTION,
        eventDefinition,
        isAcceptPact,
        isAttemptAnomaly,
        isAttemptEvent,
        isBuildShip,
        isDrawEvent,
        isMine,
        isPlaceEvent,
        isPlaceHomesteaders,
        isPlaceRewardSettlements,
        isProposePact,
        isResearch,
        isResolveEvent,
        isResolveShipTerraform,
        isSettleSyndicateTakes,
        isTerraformWithShip,
        isWithdrawPact,
        type GrantedReward,
        isChooseProduction,
        isConvertSettlement,
        isDeclareInitiative,
        isDrawEconomicTile,
        isGrowSettlements,
        isPassConversion,
        isProduceAtBases,
        isRollInitiative,
        isSpendInfluence,
        isChooseFaction,
        isChooseSurveyWorld,
        isChooseTerraformWorld,
        isCloneSettlement,
        isCompletePhase,
        isDevelopTech,
        isEndPhase,
        isEndTurn,
        isExplore,
        isMoveShip,
        isPassTerraform,
        isPlaceStartingBase,
        isRepairShip,
        isResolveAnomaly,
        isResolveSurvey,
        isScrapShip,
        isSettleExplorations,
        isSkipPhase,
        isStartPhase,
        isStartTurn,
        isTerraform,
        isTransferCargo,
        isAssignGoods,
        isChooseDemand,
        isDestroyGoods,
        isDrawTradeGoods,
        isPlaceRewardGoods,
        isSellGoods,
        isTransferGoods,
        isBuyCard,
        isDrawCard,
        isChooseEconomicTile,
        isChooseEndRollModifier,
        isChooseGrowthBase,
        BLOCKADE_INFLUENCE,
        CombatKind,
        CombatSide,
        isAssignHit,
        isDeclareAttack,
        isDefendAttack,
        isEndAttacks,
        isEndCombat,
        isResolveRaid,
        type CombatRolls,
        type HitOutcome,
        isDeclareBlockade,
        isDiscardEscalation,
        isEndBlockades,
        isReduceTransferMarkers,
        type EscalationDraw,
        RewardCardOutcome,
        cardDefinition,
        deckName,
        type RewardCard,
        type CargoPartner,
        shipDefinition,
        techDefinition,
        type CompensationCounts,
        type SettledMarkers
    } from '@tabletop/stellar-horizons-2'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ECONOMIC_TILE_LABELS,
        PHASE_FINISHED,
        PHASE_OVER,
        PHASE_SKIPPED,
        PHASE_STARTED,
        factionName,
        markersText,
        plural,
        productionLabel,
        rolledText,
        capitalized,
        COMBAT_KIND_LABELS,
        systemName
    } from '$lib/utils/presentation.js'
    import { lossText, raidOutcomeText, raidRollText, rollText } from '$lib/utils/combat.js'
    import { pactTargetName, rewardSummary } from '$lib/utils/pacts.js'
    import { goodName, goodsText, holderName } from '$lib/utils/trade.js'
    import { cardBackText, cardTitle } from '$lib/utils/cards.js'
    import { escalationList, escalationName } from '$lib/utils/escalation.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { action, justify = 'start' }: { action: GameAction; justify?: 'start' | 'center' } =
        $props()

    const gameSession = getGameSession()
    // A drawn card is named only to its drawer, as the projection does in a hosted game.
    const viewerId = $derived(gameSession.myPlayerId)

    // Each Player's directives drawn in a deal, in the order they drew.
    function dealtCounts(dealt: readonly HeldDirective[]): { playerId: string; count: number }[] {
        const counts: { playerId: string; count: number }[] = []
        for (const held of dealt) {
            const entry = counts.find((candidate) => candidate.playerId === held.playerId)
            if (entry) {
                entry.count += 1
            } else {
                counts.push({ playerId: held.playerId, count: 1 })
            }
        }
        return counts
    }

    function shipName(shipId: string): string {
        return shipDefinition(shipId).name
    }

    function compensationText(compensation: CompensationCounts): string {
        const parts = [
            ...(compensation.Biology ? [markersText(TechField.Biology, compensation.Biology)] : []),
            ...(compensation.Engineering
                ? [markersText(TechField.Engineering, compensation.Engineering)]
                : [])
        ]
        return parts.length > 0 ? ` (${parts.join(' and ')} in compensation)` : ''
    }

    function rewardCardText(card: RewardCard | undefined): string {
        if (!card) {
            return ''
        }
        const name = card.cardId ? cardTitle(card.cardId) : ''
        switch (card.outcome) {
            case RewardCardOutcome.Earned:
                return name
            case RewardCardOutcome.FromHand:
                return `${name}, from their hand`
            case RewardCardOutcome.AlreadyOwned:
                return `no card (${name} drawn, already owned)`
            case RewardCardOutcome.DeckEmpty:
                return `no card (the level I ${deckName(card.deck)} deck is empty)`
        }
    }

    function rewardText(reward: GrantedReward): string {
        const goodsCash = reward.goodsCash
            ? ` ($${reward.goodsCash}B for goods the pool lacked)`
            : ''
        return `${rewardSummary({
            ...reward,
            markers: reward.markers.length ? `markers (${reward.markers.join(', ')})` : '',
            goods: reward.goods ? plural(reward.goods, 'good') : '',
            card: rewardCardText(reward.card)
        })}${goodsCash}`
    }

    function escalationDrawText(draw: EscalationDraw): string {
        const short = draw.owed - Math.min(draw.owed, draw.drawn.length)
        const lost =
            short > 0 ? `; the pool was ${short} short, costing ${draw.influenceLost} IP` : ''
        const banned = draw.banned ? ', and they cannot attack until the next initiative roll' : ''
        return `drawing ${escalationList(draw.drawn)}${lost}${banned}`
    }

    function hitText(hit: HitOutcome): string {
        const target = hit.target.kind === 'Ship' ? shipName(hit.target.shipId) : 'the base'
        const chooser = hit.chooserId
            ? ` (${gameSession.getPlayerName(hit.chooserId)}'s choice)`
            : ''
        const result = hit.lost
            ? `: ${lossText(hit.lost)}`
            : hit.baseEliminated
              ? ': the base is eliminated'
              : ''
        return `a hit on ${target}${chooser}${result}`
    }

    function hitsText(hits: readonly HitOutcome[]): string {
        return hits.length > 0 ? `${hits.map(hitText).join('; ')}.` : ''
    }

    function rollsText(rolls: CombatRolls | undefined): string {
        if (!rolls) {
            return ''
        }
        const side = (key: CombatSide) => {
            const roll = rolls[key]
            return `${key === CombatSide.Attacker ? 'the attack' : 'the defence'} rolls ${rollText(roll)} with ${roll.combatValue} combat value: ${plural(roll.hits, 'hit')}`
        }
        return `${capitalized(side(CombatSide.Attacker))}; ${side(CombatSide.Defender)}.`
    }

    function signedPercent(value: number): string {
        return value > 0 ? ` + ${value}%` : ` − ${-value}%`
    }

    function transferPartnerName(partner: CargoPartner): string {
        switch (partner.kind) {
            case CargoPartnerKind.Earth:
                return 'Earth'
            case CargoPartnerKind.Base:
                return 'their base'
            case CargoPartnerKind.Ship:
                return shipName(partner.shipId)
        }
    }

    function settledText(entry: SettledMarkers): string {
        const drawn = entry.markers.length > 0 ? ` (${entry.markers.join(', ')})` : ''
        const cash = entry.cash ? ` and $${entry.cash}B from the empty pool` : ''
        const reason =
            entry.reason === MarkerReason.Loss
                ? `for the loss of ${shipName(entry.shipId)}`
                : `for ${shipName(entry.shipId)}'s exploration of ${systemName(entry.systemId)}`
        const survey = entry.survey ? ', enough for a survey' : ''
        return `${markersText(entry.field, entry.markers.length)}${drawn}${cash} ${reason}${survey}`
    }
</script>

<span
    class="inline-flex flex-wrap items-center gap-x-1 {justify === 'center'
        ? 'justify-center'
        : 'justify-start'}"
>
    {#if isChooseFaction(action)}
        <span>leads {factionName(action.faction)}</span>
    {:else if isPlaceStartingBase(action)}
        <span>
            founded a base of {plural(action.metadata?.settlements ?? 0, 'settlement')} at {systemName(
                action.systemId
            )}
        </span>
    {:else if isStartTurn(action)}
        <span>
            The year {action.metadata?.year} begins{action.metadata?.income
                ? `: everyone collects $${action.metadata.income}B`
                : ''}{action.metadata?.arrivedShipIds.length
                ? `; ${plural(action.metadata.arrivedShipIds.length, 'ship')} arrived`
                : ''}.
        </span>
        {#each action.metadata?.influence ?? [] as { playerId, amount } (playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName {playerId} /> earns {amount} IP from their cards.</span
            >
        {/each}
        {#each action.metadata?.removedDirectives ?? [] as { playerId, directiveId } (directiveId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName {playerId} /> gives up the directive “{directiveText(
                    directiveDefinition(directiveId).condition
                )}”, its system fully surveyed, and draws two.</span
            >
        {/each}
    {:else if isBuildShip(action)}
        <span>built {shipName(action.shipId)} at {systemName(action.systemId)}</span>
    {:else if isRepairShip(action)}
        <span
            >repaired {shipName(action.shipId)}{action.method === RepairMethod.Dock
                ? ''
                : ' remotely'} for ${action.metadata?.cost}B</span
        >
    {:else if isScrapShip(action)}
        <span
            >scrapped {shipName(action.shipId)}{action.metadata?.refund
                ? ` for $${action.metadata.refund}B`
                : ''}</span
        >
    {:else if isCloneSettlement(action)}
        <span>cloned a settlement at {systemName(action.systemId)}</span>
    {:else if isTransferCargo(action)}
        {@const count = plural(Math.abs(action.settlements), 'settlement')}
        {#if action.partner.kind === CargoPartnerKind.Earth}
            <span
                >bought {count} for {shipName(action.shipId)}{action.metadata
                    ? ` ($${action.metadata.cost}B)`
                    : ''}</span
            >
        {:else if action.partner.kind === CargoPartnerKind.Ship}
            <span
                >moved {count} from {shipName(
                    action.settlements > 0 ? action.partner.shipId : action.shipId
                )} to {shipName(
                    action.settlements > 0 ? action.shipId : action.partner.shipId
                )}</span
            >
        {:else if action.settlements > 0}
            <span
                >loaded a settlement onto {shipName(action.shipId)}{action.metadata
                    ? ` at ${systemName(action.metadata.systemId)}`
                    : ''}</span
            >
        {:else}
            <span
                >{action.metadata?.foundedBase
                    ? 'founded a base'
                    : 'expanded their base'}{action.metadata
                    ? ` at ${systemName(action.metadata.systemId)}`
                    : ''} ({plural(
                    action.metadata?.baseSettlements ?? -action.settlements,
                    'settlement'
                )})</span
            >
        {/if}
    {:else if isTransferGoods(action)}
        {@const count = `${Math.abs(action.count)} ${goodName(action.good)}`}
        <span
            >{action.count > 0
                ? `loaded ${count} onto ${shipName(action.shipId)} from ${transferPartnerName(action.partner)}`
                : `unloaded ${count} from ${shipName(action.shipId)} to ${transferPartnerName(action.partner)}`}</span
        >
    {:else if isSellGoods(action)}
        <span
            >sold {action.metadata?.count ?? ''}
            {goodName(action.good)} at {systemName(action.systemId)}{action.metadata
                ? ` for $${action.metadata.cash}B${action.metadata.influence ? ` and ${action.metadata.influence} IP` : ''}`
                : ''}</span
        >
        {#if action.payeeId && action.metadata}
            <span class="inline-flex items-center gap-x-1"
                >, paying <PlayerName playerId={action.payeeId} /> ${action.metadata.payment}B</span
            >
        {/if}
    {:else if isChooseDemand(action)}
        <span
            >{action.metadata
                ? `chose ${goodName(action.good)} demand for ${systemName(action.metadata.systemId)}, from ${action.metadata.drawn.map(goodName).join(' and ')}`
                : `chose ${goodName(action.good)} demand`}</span
        >
    {:else if isDestroyGoods(action)}
        <span
            >destroyed {action.count}
            {goodName(action.good)} at {holderName(action.holder)} for ${action.count}B</span
        >
    {:else if isDrawTradeGoods(action)}
        <span>Trade goods drawn:</span>
        {#each action.metadata?.draws ?? [] as draw, index (draw.playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={draw.playerId} />
                {draw.goods.length > 0 ? goodsText(draw.goods) : 'none'}{index <
                (action.metadata?.draws.length ?? 0) - 1
                    ? ';'
                    : ''}</span
            >
        {/each}
    {:else if isAssignGoods(action)}
        <span
            >{action.assignments.length > 0
                ? `assigned ${action.assignments
                      .map(
                          (assignment) =>
                              `${goodName(assignment.good)} to ${holderName(assignment.store)}`
                      )
                      .join(', ')}`
                : 'assigned no goods'}{action.metadata?.discarded.length
                ? `; discarded ${goodsText(action.metadata.discarded)} for $${action.metadata.cash}B`
                : ''}</span
        >
    {:else if isPlaceRewardGoods(action)}
        <span
            >{action.placements.length > 0
                ? `put reward goods in ${action.placements
                      .map((placement) => `${holderName(placement.holder)} (${placement.count})`)
                      .join(', ')}`
                : 'placed no reward goods'}{action.metadata?.destroyed
                ? `; destroyed ${action.metadata.destroyed} for $${action.metadata.cash}B`
                : ''}</span
        >
    {:else if isMoveShip(action)}
        <span
            >sent {shipName(action.shipId)} to {systemName(action.systemId)}{action.metadata
                ? `, arriving in ${plural(action.metadata.turns, 'turn')}`
                : ''}</span
        >
    {:else if isExplore(action)}
        <span>
            explored {action.metadata ? systemName(action.metadata.systemId) : ''} with {shipName(
                action.shipId
            )}{action.metadata
                ? `: ${markersText(action.metadata.field, action.metadata.markerCount)} earned`
                : ''}{action.metadata?.rewardRoll !== undefined && action.metadata.rewardRolls
                ? ` (${rolledText(action.metadata.rewardRoll, action.metadata.rewardRolls)} for one more)`
                : ''}{action.metadata?.destroyed
                ? `; the ship was lost to a malfunction${compensationText(action.metadata.compensation)}`
                : action.metadata?.damage
                  ? `; a malfunction caused ${action.metadata.damage} damage`
                  : ''}
        </span>
    {:else if isSettleExplorations(action)}
        <span
            >{action.metadata?.settled.length
                ? `received ${action.metadata.settled.map(settledText).join('; ')}`
                : 'received no markers'}</span
        >
    {:else if isDevelopTech(action)}
        <span
            >developed {techDefinition(action.techId).name}{action.influence
                ? ` with ${action.influence} IP`
                : ''}{action.metadata?.first ? ', the first to do so (+1 IP)' : ''}</span
        >
    {:else if isBuyCard(action)}
        <span
            >bought {cardTitle(action.cardId)}{action.metadata
                ? ` for ${action.metadata.cost} ${cardDefinition(action.cardId).field.toLowerCase()} points`
                : ''}{action.influence ? `, ${action.influence} IP of them` : ''}</span
        >
    {:else if isDrawCard(action)}
        {@const drawn = action.metadata?.drawn?.cardId}
        {#if action.level === undefined}
            <span>could draw no {deckName(action.deck)}: no deck they may draw from has cards</span>
        {:else}
            {@const card =
                viewerId === action.playerId && drawn !== undefined
                    ? cardTitle(drawn)
                    : cardBackText(action.deck, action.level)}
            <span
                >drew {card}{action.metadata?.kept
                    ? ''
                    : ', a copy of a card they have, and discarded it'}</span
            >
        {/if}
    {:else if isChooseEconomicTile(action)}
        <span
            >chose the economic tile with Hive Mind: {ECONOMIC_TILE_LABELS[
                action.tile
            ].toLowerCase()}.{action.metadata?.earthProduction.length
                ? ' Every faction collects its Earth production.'
                : ''}</span
        >
    {:else if isChooseGrowthBase(action)}
        <span
            >grew {plural(action.metadata?.settlements ?? 0, 'settlement')} at {systemName(
                action.systemId
            )} with Prolific Breeders</span
        >
    {:else if isChooseEndRollModifier(action)}
        <span
            >announced Transcend Biology's change to the end roll: {action.amount === 0
                ? 'none'
                : `${action.amount > 0 ? '+' : ''}${action.amount}%`}</span
        >
    {:else if isDrawEconomicTile(action)}
        {#if action.metadata}
            {@const tile = action.metadata.tile}
            <span
                >Economic phase: {ECONOMIC_TILE_LABELS[tile].toLowerCase()}.{action.metadata
                    .earthProduction.length > 0
                    ? ' Every faction collects its Earth production.'
                    : ''}</span
            >
        {/if}
    {:else if isDeclareInitiative(action)}
        <span
            >{action.influence > 0
                ? `spent ${action.influence} IP on initiative`
                : 'spent no IP on initiative'}{action.kept
                ? ` and chose to keep ${escalationList(action.kept)}`
                : ''}</span
        >
    {:else if isRollInitiative(action)}
        <span>Initiative rolled:</span>
        {#each action.metadata?.order ?? [] as playerId, index (playerId)}
            {@const roll = action.metadata?.rolls.find((entry) => entry.playerId === playerId)}
            <span class="inline-flex items-center gap-x-1"
                >{index + 1}. <PlayerName {playerId} />
                {roll
                    ? `${roll.total}%${roll.bid || roll.modifier ? ` (${roll.roll}${roll.bid ? ` + ${roll.bid} IP` : ''}${roll.modifier ? signedPercent(roll.modifier) : ''})` : ''}`
                    : ''}{index < (action.metadata?.order.length ?? 0) - 1 ? ',' : ''}</span
            >
        {/each}
        {#each action.metadata?.escalationDiscards ?? [] as { playerId, discarded } (playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName {playerId} /> returns {escalationList(discarded)}.</span
            >
        {/each}
    {:else if isChooseProduction(action)}
        <span
            >chose to produce {action.production === CASH_PRODUCTION
                ? 'cash'
                : action.production.toLowerCase()} at {systemName(action.systemId)}</span
        >
    {:else if isProduceAtBases(action)}
        <span>Bases produce:</span>
        {#each action.metadata?.results ?? [] as result, index (`${result.playerId}:${result.systemId}`)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={result.playerId} />
                {productionLabel(result.production, result.amount)}{result.goods.goods.length
                    ? ` and ${goodsText(result.goods.goods)}`
                    : ''}{result.goods.cash ? ` and $${result.goods.cash}B for goods` : ''} at {systemName(
                    result.systemId
                )}{result.blockaded ? ' (blockaded, halved)' : ''}{index <
                (action.metadata?.results.length ?? 0) - 1
                    ? ';'
                    : ''}</span
            >
        {:else}
            <span>nothing.</span>
        {/each}
    {:else if isGrowSettlements(action)}
        {@const grown = (action.metadata?.results ?? []).filter(
            (result) => result.after > result.before
        )}
        <span>Settlements grow:</span>
        {#each grown as result, index (`${result.playerId}:${result.systemId}`)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={result.playerId} />
                +{result.after - result.before} at {systemName(result.systemId)}{index <
                grown.length - 1
                    ? ';'
                    : ''}</span
            >
        {:else}
            <span>no base gained any.</span>
        {/each}
        {#each action.metadata?.chosen ?? [] as chosen (chosen.playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={chosen.playerId} /> +{chosen.settlements} at {systemName(
                    chosen.systemId
                )} with Prolific Breeders</span
            >
        {/each}
    {:else if isConvertSettlement(action)}
        <span>tried to convert a settlement of</span>
        <PlayerName playerId={action.targetPlayerId} />
        <span
            >at {systemName(action.systemId)}{action.metadata
                ? `: rolled ${action.metadata.roll}${action.metadata.target === undefined ? '' : ` against ${action.metadata.target}`}, ${action.metadata.converted ? 'converted' : 'failed'}`
                : ''}</span
        >
    {:else if isPassConversion(action)}
        <span>chose not to convert anyone</span>
    {:else if isSpendInfluence(action)}
        <span>turned {action.influence} IP into ${action.influence * CASH_PER_INFLUENCE}B</span>
    {:else if isStartPhase(action)}
        <span
            >{action.metadata ? PHASE_STARTED[action.metadata.phase] : 'starts a phase'}{action
                .metadata?.repairedShipIds?.length
                ? `; Self Repair System took a point of damage off ${action.metadata.repairedShipIds
                      .map(shipName)
                      .join(', ')}`
                : ''}</span
        >
    {:else if isEndPhase(action)}
        <span>{PHASE_FINISHED[action.phase]}</span>
    {:else if isSkipPhase(action)}
        <span>{action.metadata ? PHASE_SKIPPED[action.metadata.phase] : 'has nothing to do'}</span>
    {:else if isCompletePhase(action)}
        <span>{action.metadata ? PHASE_OVER[action.metadata.phase] : 'The phase is over.'}</span>
        {#each action.metadata?.discardedHands ?? [] as playerId (playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName {playerId} /> bought nothing and discards their hand.</span
            >
        {/each}
    {:else if isAttemptAnomaly(action)}
        <span>
            sent {action.shipIds.map(shipName).join(', ')} to resolve {action.metadata
                ? anomalyDefinition(action.metadata.anomalyId).name
                : 'an anomaly'} at {systemName(action.systemId)}{action.metadata
                ? ` (${action.metadata.strength} against ${action.metadata.difficulty})`
                : ''}
        </span>
    {:else if isResolveAnomaly(action)}
        {#if action.metadata}
            {@const metadata = action.metadata}
            {#if metadata.pactId}
                <span
                    >A pact {metadata.resolved ? 'resolved' : 'arrived too late to resolve'}
                    {anomalyDefinition(metadata.anomalyId).name} at {systemName(
                        metadata.systemId
                    )}</span
                >
                {#each metadata.shares ?? [] as share (share.playerId)}
                    <span class="inline-flex items-center gap-x-1"
                        >; <PlayerName playerId={share.playerId} /> {rewardText(share)}</span
                    >
                {/each}
                {#if metadata.keeperId}
                    <span class="inline-flex items-center gap-x-1"
                        >; <PlayerName playerId={metadata.keeperId} /> keeps the tile</span
                    >
                {/if}
            {:else}
                <PlayerName playerId={metadata.playerId} />
                <span>
                    {metadata.resolved ? 'resolved' : 'arrived too late to resolve'}
                    {anomalyDefinition(metadata.anomalyId).name} at {systemName(
                        metadata.systemId
                    )}{metadata.reward ? `: ${rewardText(metadata.reward)}` : ''}
                </span>
            {/if}
            {#if metadata.turnedOver}
                <span
                    >{metadata.turnedOver.back === AnomalyBackKind.Bases
                        ? 'The tile is turned over and stays in the system.'
                        : metadata.turnedOver.back === AnomalyBackKind.StellarChart
                          ? `The Stellar Chart draws ${plural(metadata.turnedOver.worlds.length, 'world')}.`
                          : 'The tile leaves the game.'}</span
                >
            {/if}
        {/if}
    {:else if isPlaceRewardSettlements(action)}
        <span
            >placed reward settlements: {action.placements
                .map((placement) => `${placement.settlements} at ${systemName(placement.systemId)}`)
                .join(', ')}</span
        >
    {:else if isMine(action)}
        <span
            >mined {action.metadata ? systemName(action.metadata.systemId) : ''} with {shipName(
                action.shipId
            )}{action.metadata
                ? `: ${rolledText(action.metadata.roll, action.metadata.rolls)} against ${action.metadata.target}, $${action.metadata.cash}B`
                : ''}</span
        >
    {:else if isResearch(action)}
        <span
            >researched {action.metadata ? systemName(action.metadata.systemId) : ''} with {shipName(
                action.shipId
            )}{action.metadata
                ? `: rolled ${action.metadata.roll} against ${action.metadata.target}, ${action.metadata.success ? `a ${action.metadata.field?.toLowerCase()} marker` : 'nothing'}`
                : ''}</span
        >
    {:else if isSettleSyndicateTakes(action)}
        <span>The Syndicate takes its cut:</span>
        {#each action.metadata?.takes ?? [] as take, index (index)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={take.fromPlayerId} /> pays ${take.cash}B at {systemName(
                    take.systemId
                )}</span
            >
        {/each}
    {:else if isTerraformWithShip(action)}
        <span
            >sent {shipName(action.shipId)} to terraform a world; it happens once everyone has explored</span
        >
    {:else if isResolveShipTerraform(action)}
        {#if action.metadata}
            <PlayerName playerId={action.metadata.playerId} />
            <span
                >{action.metadata.outcome
                    ? `terraformed a world at ${systemName(action.metadata.systemId)} with ${shipName(action.metadata.shipId)}${action.metadata.outcome.flipped ? '' : ' and drew new worlds'}`
                    : `could no longer terraform at ${systemName(action.metadata.systemId)}`}</span
            >
        {/if}
    {:else if isDrawEvent(action)}
        {#if action.metadata}
            {@const metadata = action.metadata}
            {#each metadata.triggered as triggered (triggered.eventId)}
                <span
                    >{eventDefinition(triggered.eventId).name} was not resolved in time and strikes
                    {triggered.systemId ? systemName(triggered.systemId) : ''}.</span
                >
            {/each}
            {#if metadata.eventId}
                <span
                    >Event: {eventDefinition(metadata.eventId).name}{metadata.placerId
                        ? '; it must be placed at a base of'
                        : metadata.drawn
                          ? '.'
                          : '; nobody has a base, so it is ignored.'}</span
                >
                {#if metadata.placerId}
                    <PlayerName playerId={metadata.placerId} />
                {/if}
                {#if metadata.drawn && metadata.drawn.players.length > 0}
                    <span>It favours</span>
                    {#each metadata.drawn.players as playerId (playerId)}
                        <PlayerName {playerId} />
                    {/each}
                {/if}
            {:else}
                <span>No event is left to draw.</span>
            {/if}
        {/if}
    {:else if isPlaceEvent(action)}
        <span>placed the event at {systemName(action.systemId)}</span>
    {:else if isPlaceHomesteaders(action)}
        <span>added 2 Homesteaders settlements at {systemName(action.systemId)}</span>
    {:else if isAttemptEvent(action)}
        <span
            >sent {action.shipIds.map(shipName).join(', ')} against {eventDefinition(action.eventId)
                .name}</span
        >
    {:else if isResolveEvent(action)}
        {#if action.metadata}
            <PlayerName playerId={action.metadata.playerId} />
            <span
                >{action.metadata.resolved
                    ? `${action.metadata.pactId ? "'s pact resolved" : 'resolved'} ${eventDefinition(action.metadata.eventId).name} for ${action.metadata.influence} IP`
                    : `arrived too late to resolve ${eventDefinition(action.metadata.eventId).name}`}</span
            >
        {/if}
    {:else if isProposePact(action)}
        <span
            >{action.pactId ? 'countered with a pact' : 'proposed a pact'} on {pactTargetName(
                action.terms
            )} with</span
        >
        {#each action.terms.partnerIds.filter((playerId) => playerId !== action.playerId) as playerId (playerId)}
            <PlayerName {playerId} />
        {/each}
    {:else if isAcceptPact(action)}
        <span>{action.metadata?.agreed ? 'agreed the pact' : 'accepted the pact'}</span>
    {:else if isWithdrawPact(action)}
        <span>withdrew from a pact</span>
    {:else if isResolveSurvey(action)}
        {#if action.metadata}
            <PlayerName playerId={action.metadata.playerId} />
            <span>
                {action.metadata.completed
                    ? `completed a survey of ${systemName(action.metadata.systemId)}${action.metadata.placedSlot !== undefined ? ' and found a new world' : ''}`
                    : `arrived too late to survey ${systemName(action.metadata.systemId)}`}{action
                    .metadata.anomaly?.anomalyId
                    ? ` and discovered an anomaly: ${anomalyDefinition(action.metadata.anomaly.anomalyId).name}`
                    : ''}
            </span>
        {/if}
    {:else if isChooseSurveyWorld(action)}
        <span
            >{action.tileId === undefined
                ? 'kept their surveyed worlds'
                : action.slot === undefined
                  ? 'chose which surveyed world to place'
                  : 'swapped in a newly surveyed world'}</span
        >
    {:else if isTerraform(action)}
        <span
            >terraformed a world at {systemName(action.systemId)}{action.metadata?.flipped
                ? ''
                : ' and drew new worlds'}</span
        >
    {:else if isPassTerraform(action)}
        <span>chose not to terraform</span>
    {:else if isChooseTerraformWorld(action)}
        <span
            >{action.tileId ? 'replaced a terraformed world' : 'kept their terraformed world'}</span
        >
    {:else if isDeclareAttack(action)}
        <span
            >{action.kind === CombatKind.Explorer && action.explorerId
                ? `destroys ${shipName(action.explorerId)} at ${systemName(action.systemId)}, an RE of`
                : `starts a ${COMBAT_KIND_LABELS[action.kind].toLowerCase()} at ${systemName(action.systemId)}${action.shipIds.length ? ` with ${action.shipIds.map(shipName).join(' and ')}` : ''} against`}</span
        >
        <PlayerName playerId={action.defenderId} />
        {#if action.metadata}
            {@const metadata = action.metadata}
            {#if metadata.explorerLoss}
                <span>({lossText(metadata.explorerLoss)}).</span>
            {/if}
            {#if metadata.raid}
                <span
                    >The raid rolls {raidRollText(metadata.raid)} and {metadata.raid.percentile}%
                    for damage.</span
                >
            {/if}
            {#if metadata.raidOutcome}
                <span>{raidOutcomeText(metadata.raidOutcome)}</span>
            {/if}
            <span>{rollsText(metadata.rolls)}</span>
            <span>{capitalized(hitsText(metadata.hits))}</span>
        {/if}
    {:else if isDefendAttack(action)}
        <span
            >defends {action.includeBase
                ? 'with their base too'
                : action.shipIds.length
                  ? `with ${action.shipIds.map(shipName).join(' and ')}`
                  : 'without adding to the defence'}.</span
        >
        {#if action.metadata}
            <span>{rollsText(action.metadata.rolls)}</span>
            <span>{capitalized(hitsText(action.metadata.hits))}</span>
        {/if}
    {:else if isAssignHit(action)}
        <span>assigns {hitsText(action.metadata?.hits ?? [])}</span>
    {:else if isResolveRaid(action)}
        <span>{action.metadata ? raidOutcomeText(action.metadata) : ''}</span>
    {:else if isEndCombat(action)}
        {#if action.metadata?.declined}
            <span>declines the escalation markers, so the defender gains no IP.</span>
        {:else if action.metadata}
            <span
                >The attacker {action.metadata.escalation
                    ? escalationDrawText(action.metadata.escalation)
                    : ''}; the defender gains {action.metadata.influence} IP.</span
            >
        {/if}
    {:else if isEndAttacks(action)}
        <span>makes no more attacks</span>
    {:else if isDeclareBlockade(action)}
        <span>blockaded</span>
        {#each action.targetIds as targetId, index (targetId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName playerId={targetId} />{index < action.targetIds.length - 1
                    ? ' and'
                    : ''}</span
            >
        {/each}
        <span
            >at {systemName(action.systemId)}{action.metadata
                ? `, ${action.metadata.force} against ${action.metadata.defence}, ${escalationDrawText(action.metadata.escalation)}`
                : ''}; {action.targetIds.length === 1
                ? 'the blockaded faction gains'
                : 'each blockaded faction gains'}
            {BLOCKADE_INFLUENCE} IP</span
        >
    {:else if isEndBlockades(action)}
        <span>declared no more blockades</span>
    {:else if isDiscardEscalation(action)}
        <span>discarded {escalationName(action.marker)} (Military Academy)</span>
    {:else if isReduceTransferMarkers(action)}
        <span
            >Transfer markers drop{action.metadata?.arrivedShipIds.length
                ? `: ${plural(action.metadata.arrivedShipIds.length, 'ship')} arrived`
                : ''}.</span
        >
    {:else if isEndTurn(action)}
        <span>
            {#if action.metadata?.endRoll?.ended}
                The campaign ends in {action.metadata.year}: the end roll was {action.metadata
                    .endRoll.roll} against {action.metadata.endRoll.chance}%.
            {:else if action.metadata?.endRoll}
                {action.metadata.year} ends; the end roll was {action.metadata.endRoll.roll}
                against {action.metadata.endRoll.chance}%{action.metadata.endRoll.modifier
                    ? `, Transcend Biology moving it ${action.metadata.endRoll.modifier.amount > 0 ? 'up' : 'down'} ${Math.abs(action.metadata.endRoll.modifier.amount)}%`
                    : ''}.
            {:else if action.metadata?.victorIds.length}
                The goal is reached in {action.metadata.year}!
            {:else if action.metadata?.gameOver}
                {action.metadata.year} ends and nobody reached the goal.
            {:else}
                {action.metadata?.year} ends.
            {/if}
            {#if action.metadata?.truceRoll}
                The truce roll was {action.metadata.truceRoll.roll} against {action.metadata
                    .truceRoll.chance}%: {action.metadata.truceRoll.ended
                    ? 'the truce is over, and factions may now attack each other.'
                    : 'the truce holds.'}
            {/if}
            {#if action.metadata?.shuffledCards}
                {plural(action.metadata.shuffledCards, 'discarded card')}
                {action.metadata.shuffledCards === 1 ? 'is' : 'are'} shuffled back into the decks.
            {/if}
        </span>
    {:else if isDealDirectives(action)}
        {@const dealt = dealtCounts(action.metadata?.dealt ?? [])}
        <span>Directives are dealt:</span>
        {#each dealt as { playerId, count }, index (playerId)}
            <span class="inline-flex items-center gap-x-1"
                ><PlayerName {playerId} /> draws {plural(count, 'directive')}{index <
                dealt.length - 1
                    ? ';'
                    : '.'}</span
            >
        {/each}
    {:else if isChooseDirective(action)}
        <span
            >keeps a directive{action.directiveId
                ? `: “${directiveText(directiveDefinition(action.directiveId).condition)}”`
                : ''}</span
        >
    {:else if isRedrawDirective(action)}
        <span
            >gives up their directive for {DIRECTIVE_REDRAW_COST} IP{action.metadata?.queued
                ? '; two more are drawn once everyone has finished the phase'
                : ' and draws two more'}</span
        >
    {:else}
        <span>{action.type}</span>
    {/if}
    {#each fulfilledIn(action) as fulfilled (fulfilled.directiveId)}
        {@const directive = directiveDefinition(fulfilled.directiveId)}
        <span
            ><PlayerName playerId={fulfilled.playerId} /> fulfils the directive “{directiveText(
                directive.condition
            )}” for {directive.points} VP and {DIRECTIVE_INFLUENCE} IP.</span
        >
    {/each}
</span>
