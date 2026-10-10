<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        AttackStep,
        UnitType,
        opposingSide,
        type ProjectedUnit,
        type Side
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeLocale } from '$lib/model/battle.js'
    import Force from './battle/Force.svelte'
    import DefenseStep from './battle/DefenseStep.svelte'
    import RetreatStep from './battle/RetreatStep.svelte'
    import FeintStep from './battle/FeintStep.svelte'
    import DeclareStep from './battle/DeclareStep.svelte'
    import CounterStep from './battle/CounterStep.svelte'
    import DecisionStep from './battle/DecisionStep.svelte'
    import OccupyStep from './battle/OccupyStep.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const attack = $derived(gameSession.attack)

    const attackerSide: Side | undefined = $derived(attack ? game.sideOf(attack.attackerId) : undefined)
    const defenseApproach = $derived(attack ? game.map.approach(attack.defenseApproach) : undefined)
    const attackApproach = $derived(attack ? game.map.approach(attack.attackApproach) : undefined)

    const PENALTY_NAMES: Record<UnitType, string> = {
        [UnitType.Infantry]: 'infantry',
        [UnitType.Cavalry]: 'cavalry',
        [UnitType.Artillery]: 'artillery'
    }

    const terrain = $derived.by(() => {
        if (!defenseApproach) {
            return ''
        }
        const notes = [defenseApproach.wide ? 'wide approach' : 'narrow approach']
        if (defenseApproach.penalties.length > 0) {
            notes.push(`${defenseApproach.penalties.map((type) => PENALTY_NAMES[type]).join(' and ')} penalised`)
        }
        if (defenseApproach.obstructed) {
            notes.push('obstructed')
        }
        return notes.join(', ')
    })

    function living(ids: string[]): ProjectedUnit[] {
        return ids.flatMap((id) => game.findUnit(id) ?? [])
    }

    const attackers = $derived(living(attack?.attackingUnitIds ?? []))
    const defenders = $derived(living(attack?.defendingUnitIds ?? []))
    const attackMarkers = $derived(
        Object.fromEntries((attack?.attackLeaderIds ?? []).map((id) => [id, 'leads']))
    )
    const defenseMarkers = $derived(
        Object.fromEntries([
            ...(attack?.defenseLeaderIds ?? []).map((id) => [id, 'leads']),
            ...(attack?.counterAttackerIds ?? []).map((id) => [id, 'counter-attacks'])
        ])
    )

    const WAITING: Record<AttackStep, string> = {
        [AttackStep.DefenseResponse]: 'to defend or give ground',
        [AttackStep.FeintDecision]: 'to press the attack or call it a feint',
        [AttackStep.AttackDeclaration]: 'to declare the attack',
        [AttackStep.CounterAttackDecision]: 'to counter-attack or hold',
        [AttackStep.Resolving]: 'to settle the outcome',
        [AttackStep.Retreating]: 'to retreat',
        [AttackStep.Occupying]: 'to move in'
    }

    function signed(value: number): string {
        return value > 0 ? `+${value}` : String(value)
    }
</script>

{#if attack && attackerSide && attackApproach && defenseApproach}
    {@const defenderSide = opposingSide(attackerSide)}
    <div class="nt-battle">
        <div class="nt-battle-title">
            {attack.guardAttack ? 'Guard Attack' : 'Attack'} from {describeLocale(game, attackApproach.locale)}
            into {describeLocale(game, defenseApproach.locale)}
            <span class="nt-battle-faint">· {terrain}</span>
        </div>
        {#if attackers.length > 0 || defenders.length > 0 || attack.initialResult !== undefined}
            <div class="nt-battle-sides">
                {#if attackers.length > 0}
                    <div>
                        <div class="nt-battle-faint">Attacking</div>
                        <Force side={attackerSide} units={attackers} markers={attackMarkers} />
                    </div>
                {/if}
                {#if defenders.length > 0}
                    <div>
                        <div class="nt-battle-faint">
                            Defending{attack.defendersBlocking === false ? ' from reserve' : ' on the approach'}
                        </div>
                        <Force side={defenderSide} units={defenders} markers={defenseMarkers} />
                    </div>
                {/if}
                {#if attack.initialResult !== undefined}
                    <div class="nt-battle-result">
                        Initial {signed(attack.initialResult)}{attack.finalResult !== undefined
                            ? ` · Final ${signed(attack.finalResult)}`
                            : ''}
                    </div>
                {/if}
            </div>
        {/if}
        {#if gameSession.canAct && gameSession.mySide}
            {@const side = gameSession.mySide}
            {#if attack.step === AttackStep.DefenseResponse}
                <DefenseStep {side} />
            {:else if attack.step === AttackStep.FeintDecision}
                <FeintStep {side} />
            {:else if attack.step === AttackStep.AttackDeclaration}
                <DeclareStep {side} />
            {:else if attack.step === AttackStep.CounterAttackDecision}
                <CounterStep {side} />
            {:else if attack.step === AttackStep.Resolving}
                <DecisionStep {side} />
            {:else if attack.step === AttackStep.Retreating}
                <RetreatStep {side} />
            {:else if attack.step === AttackStep.Occupying}
                <OccupyStep {side} />
            {/if}
        {:else if !gameSession.isViewingHistory}
            <div class="nt-battle-prompt">
                Waiting for <PlayerName playerId={game.activePlayerIds[0]} />
                {WAITING[attack.step]}.
            </div>
        {/if}
    </div>
{/if}

<style>
    .nt-battle {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0 12px 8px;
        padding: 6px 10px 8px;
        border: 1px solid #2b2620;
        border-radius: 4px;
        color: #2b2620;
        font-size: 14px;
    }

    @media (max-width: 639px) {
        .nt-battle {
            margin: 0 4px 6px;
            padding: 4px 6px 6px;
            font-size: 12px;
        }
    }

    .nt-battle-title {
        font-size: 15px;
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

    .nt-battle :global(.nt-battle-result) {
        font-weight: 700;
        align-self: center;
    }

    .nt-battle :global(.nt-battle-warning) {
        color: #7a1418;
    }

    .nt-battle :global(.nt-battle-small) {
        font-size: 12px;
        padding: 1px 6px;
    }

    .nt-battle :global(.nt-chosen) {
        background: #2b2620;
        color: #f1ecdc;
    }

    .nt-battle :global(button:disabled) {
        opacity: 0.4;
    }
</style>
