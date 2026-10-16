<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        MachineState,
        UnitType,
        attackStep,
        type AttackStep,
        type ProjectedUnit
    } from '@tabletop/napoleons-triumph'
    import { anyLoss } from '$lib/model/attackLosses.js'
    import { StageKind } from '$lib/model/battleSelection.js'
    import { rolesBeforeTheCounterAttack } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { printedSideOf } from '$lib/utils/approachSymbols.js'
    import ApproachMarks from './battle/ApproachMarks.svelte'
    import CounterStep from './battle/CounterStep.svelte'
    import DecisionStep from './battle/DecisionStep.svelte'
    import DeclareStep from './battle/DeclareStep.svelte'
    import DefenseStep from './battle/DefenseStep.svelte'
    import FeintStep from './battle/FeintStep.svelte'
    import LeadStep from './battle/LeadStep.svelte'
    import Force from './battle/Force.svelte'
    import OccupyStep from './battle/OccupyStep.svelte'
    import LossRule from './battle/LossRule.svelte'
    import ResultRule from './battle/ResultRule.svelte'
    import RetreatStep from './battle/RetreatStep.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const attack = $derived(gameSession.attack)
    const stage = $derived(gameSession.battleStage)

    const PENALTY_NAMES: Record<UnitType, string> = {
        [UnitType.Infantry]: 'infantry',
        [UnitType.Cavalry]: 'cavalry',
        [UnitType.Artillery]: 'artillery'
    }

    const WAITING: Record<AttackStep, string> = {
        [MachineState.DefenseResponse]: 'to defend or retreat',
        [MachineState.FeintDecision]: 'to press the attack or call it a feint',
        [MachineState.DefenseDeclaration]: 'to name the leading units of the defence',
        [MachineState.AttackDeclaration]: 'to declare the attack',
        [MachineState.CounterAttackDecision]: 'to counter-attack or hold',
        [MachineState.ResolvingAttack]: 'to settle the outcome',
        [MachineState.Retreating]: 'to retreat',
        [MachineState.Occupying]: 'to move in'
    }

    function terrain(defenseApproachId: number): string {
        const approach = game.map.approach(defenseApproachId)
        return [
            approach.wide ? 'wide approach' : 'narrow approach',
            ...(approach.penalties.length > 0
                ? [
                      `${approach.penalties.map((type) => PENALTY_NAMES[type]).join(' and ')} penalised`
                  ]
                : []),
            ...(approach.obstructed ? ['obstructed'] : [])
        ].join(', ')
    }

    function living(ids: string[]): ProjectedUnit[] {
        return ids.flatMap((id) => game.findUnit(id) ?? [])
    }
</script>

{#if attack}
    {@const attackers = living(attack.attackingUnitIds)}
    {@const defenders = living(attack.defendingUnitIds)}
    {@const counterAttackers = living(attack.counterAttackingUnitIds)}
    {@const roles = gameSession.foughtRoles}
    {@const losses = gameSession.attackLosses}
    {@const verdict = gameSession.attackVerdict}
    {@const printedSide = printedSideOf(attack.defenseApproach)}
    <div class="nt-battle">
        <div class="nt-battle-title">
            {attack.guardAttack ? 'Guard Attack' : 'Attack'} from
            {game.map.label(game.map.approach(attack.attackApproach).locale)} into
            {game.map.label(game.map.approach(attack.defenseApproach).locale)}
            <span class="nt-battle-faint">· {terrain(attack.defenseApproach)}</span>
            {#if printedSide}
                <ApproachMarks marks={printedSide.marks} />
            {/if}
        </div>
        {#if attackers.length > 0 || defenders.length > 0}
            <div class="nt-battle-sides">
                {#if attackers.length > 0}
                    <div>
                        <div class="nt-battle-faint">Attacking</div>
                        <Force units={attackers} {roles} lettersOnly />
                    </div>
                {/if}
                {#if defenders.length > 0}
                    <div>
                        <div class="nt-battle-faint">
                            Defending{attack.defendersBlocking === false
                                ? ' from reserve'
                                : ' on the approach'}
                        </div>
                        <Force
                            units={defenders}
                            roles={rolesBeforeTheCounterAttack(attack, roles)}
                            lettersOnly
                        />
                    </div>
                {/if}
            </div>
        {/if}
        {#if counterAttackers.length > 0}
            <div>
                <div class="nt-battle-faint">Counter-attacking</div>
                <Force units={counterAttackers} {roles} lettersOnly />
            </div>
        {/if}
        {#if attack.feint}
            <ResultRule feint />
        {:else if attack.initialResult !== undefined}
            <ResultRule initialResult={attack.initialResult} finalResult={attack.finalResult} />
        {/if}
        {#if verdict}
            <div class="nt-battle-prompt nt-battle-verdict">{verdict}</div>
        {/if}
        {#if losses && anyLoss(losses)}
            <LossRule {losses} />
        {/if}
        {#if !stage}
            <div class="nt-battle-prompt">
                Waiting for <PlayerName playerId={game.activePlayerIds[0]} />
                {WAITING[attackStep(attack)]}.
            </div>
        {:else if stage.kind === StageKind.Defence}
            <DefenseStep {stage} />
        {:else if stage.kind === StageKind.DefenceLeaders}
            <LeadStep {stage} />
        {:else if stage.kind === StageKind.Retreat}
            <RetreatStep {stage} />
        {:else if stage.kind === StageKind.Feint}
            <FeintStep {stage} />
        {:else if stage.kind === StageKind.Declaration}
            <DeclareStep {stage} />
        {:else if stage.kind === StageKind.Occupation}
            <OccupyStep {stage} />
        {:else if stage.kind === StageKind.Counter}
            <CounterStep {stage} />
        {:else}
            <DecisionStep {stage} />
        {/if}
    </div>
{/if}

<style>
    .nt-battle {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 14px;
    }

    @media (max-width: 639px) {
        .nt-battle {
            font-size: 12px;
        }
    }

    .nt-battle-title {
        font-size: 17px;
        font-style: italic;
    }

    .nt-battle-sides {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 4px 28px;
    }

    .nt-battle :global(.nt-battle-faint) {
        font-size: 12px;
        opacity: 0.7;
    }

    .nt-battle :global(.nt-battle-prompt) {
        line-height: 1.3;
        max-width: 60ch;
    }

    .nt-battle-verdict {
        padding: 5px 0 6px;
    }

    .nt-battle :global(.nt-battle-warning) {
        color: var(--nt-warn);
    }

    .nt-battle :global(.nt-plain-button[disabled]) {
        opacity: 0.4;
    }
</style>
