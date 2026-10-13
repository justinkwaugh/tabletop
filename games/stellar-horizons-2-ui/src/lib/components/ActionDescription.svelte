<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import {
        CargoPartnerKind,
        MarkerReason,
        RepairMethod,
        TechField,
        anomalyDefinition,
        isAttemptAnomaly,
        isBuildShip,
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
        shipDefinition,
        techDefinition,
        type CompensationCounts,
        type SettledMarkers
    } from '@tabletop/stellar-horizons-2'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        PHASE_FINISHED,
        PHASE_OVER,
        PHASE_SKIPPED,
        PHASE_STARTED,
        factionName,
        plural,
        systemName
    } from '$lib/utils/presentation.js'

    let { action, justify = 'start' }: { action: GameAction; justify?: 'start' | 'center' } =
        $props()

    function shipName(shipId: string): string {
        return shipDefinition(shipId).name
    }

    function markers(field: TechField, count: number): string {
        return plural(count, `${field.toLowerCase()} marker`)
    }

    function compensationText(compensation: CompensationCounts): string {
        const parts = [
            ...(compensation.Biology ? [markers(TechField.Biology, compensation.Biology)] : []),
            ...(compensation.Engineering
                ? [markers(TechField.Engineering, compensation.Engineering)]
                : [])
        ]
        return parts.length > 0 ? ` (${parts.join(' and ')} in compensation)` : ''
    }

    function settledText(entry: SettledMarkers): string {
        const drawn = entry.markers.length > 0 ? ` (${entry.markers.join(', ')})` : ''
        const cash = entry.cash ? ` and $${entry.cash}B from the empty pool` : ''
        const reason =
            entry.reason === MarkerReason.Loss
                ? `for the loss of ${shipName(entry.shipId)}`
                : `for ${shipName(entry.shipId)}'s exploration of ${systemName(entry.systemId)}`
        const survey = entry.survey ? ', enough for a survey' : ''
        return `${markers(entry.field, entry.markers.length)}${drawn}${cash} ${reason}${survey}`
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
                ? `: ${markers(action.metadata.field, action.metadata.markerCount)} earned`
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
        <span>developed {techDefinition(action.techId).name}</span>
    {:else if isStartPhase(action)}
        <span>{action.metadata ? PHASE_STARTED[action.metadata.phase] : 'starts a phase'}</span>
    {:else if isEndPhase(action)}
        <span>{PHASE_FINISHED[action.phase]}</span>
    {:else if isSkipPhase(action)}
        <span>{action.metadata ? PHASE_SKIPPED[action.metadata.phase] : 'has nothing to do'}</span>
    {:else if isCompletePhase(action)}
        <span>{action.metadata ? PHASE_OVER[action.metadata.phase] : 'The phase is over.'}</span>
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
            <PlayerName playerId={action.metadata.playerId} />
            <span>
                {action.metadata.resolved ? 'resolved' : 'arrived too late to resolve'}
                {anomalyDefinition(action.metadata.anomalyId).name} at {systemName(
                    action.metadata.systemId
                )}
            </span>
        {/if}
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
            >{action.slot === undefined
                ? 'kept their surveyed worlds'
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
    {:else if isEndTurn(action)}
        <span>
            {#if action.metadata?.victorIds.length}
                The goal is reached in {action.metadata.year}!
            {:else if action.metadata?.gameOver}
                {action.metadata.year} ends and nobody reached the goal.
            {:else}
                {action.metadata?.year} ends.
            {/if}
        </span>
    {:else}
        <span>{action.type}</span>
    {/if}
</span>
