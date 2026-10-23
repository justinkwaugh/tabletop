<script lang="ts">
    import PlaceText from './PlaceText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { UnitType, type ProjectedUnit } from '@tabletop/napoleons-triumph'
    import { anyLoss } from '$lib/model/attackLosses.js'
    import { endingOf } from '$lib/model/concludedBattle.js'
    import { StageKind } from '$lib/model/battleSelection.js'
    import { awaitedStep } from '$lib/model/battleWaiting.js'
    import { resultsSoFar, rolesBeforeTheCounterAttack } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { printedSideOf } from '$lib/utils/approachSymbols.js'
    import ApproachMarks from './battle/ApproachMarks.svelte'
    import FoldToggle from './battle/FoldToggle.svelte'
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
    const attack = $derived(gameSession.shownAttack)
    const concluded = $derived(gameSession.concludedBattle)
    const stage = $derived(gameSession.battleStage)
    const folded = $derived(gameSession.battlePanelShownFolded)

    const PENALTY_NAMES: Record<UnitType, string> = {
        [UnitType.Infantry]: 'infantry',
        [UnitType.Cavalry]: 'cavalry',
        [UnitType.Artillery]: 'artillery'
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

    function unitsOf(ids: string[]): ProjectedUnit[] {
        return ids.flatMap((id) => game.findUnit(id) ?? concluded?.unitsLastSeen.get(id) ?? [])
    }
</script>

{#if attack}
    {@const attackers = unitsOf(attack.attackingUnitIds)}
    {@const defenders = unitsOf(attack.defendingUnitIds)}
    {@const counterAttackers = unitsOf(attack.counterAttackingUnitIds)}
    {@const roles = gameSession.foughtRoles}
    {@const losses = gameSession.attackLosses}
    {@const verdict = gameSession.attackVerdict}
    {@const printedSide = printedSideOf(attack.defenseApproach)}
    {@const results = resultsSoFar(attack, stage)}
    <div class="nt-battle" class:nt-battle-folded={folded}>
        <div class="nt-battle-head">
            <div class="nt-battle-heading">
                <div class="nt-battle-title">
                    <PlaceText
                        text="{attack.guardAttack ? 'Guard Attack' : 'Attack'} from {game.map.label(
                            game.map.approach(attack.attackApproach).locale
                        )} into {game.map.label(game.map.approach(attack.defenseApproach).locale)}"
                    />
                    {#if !folded}
                        <span class="nt-battle-faint">· {terrain(attack.defenseApproach)}</span>
                        {#if printedSide}
                            <ApproachMarks marks={printedSide.marks} />
                        {/if}
                    {/if}
                </div>
                {#if folded && (attack.feint || results.initial !== undefined || results.final !== undefined)}
                    <ResultRule
                        inline
                        feint={attack.feint}
                        initialResult={results.initial}
                        finalResult={results.final}
                    />
                {/if}
            </div>
            {#if gameSession.battlePanelFoldable}
                <div class="nt-battle-toggle"><FoldToggle /></div>
            {/if}
        </div>
        {#if !folded}
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
        {/if}
        {#if verdict}
            <div class="nt-battle-prompt nt-battle-verdict">{verdict}</div>
        {/if}
        {#if !folded && losses && anyLoss(losses)}
            <LossRule {losses} />
        {/if}
        {#if concluded}
            <div class="nt-battle-prompt nt-battle-ending">
                <span class="nt-battle-over">The attack is over.</span>
                <PlaceText
                    text={endingOf(concluded, game.sideOf(concluded.attack.attackerId), (locale) =>
                        game.map.label(locale)
                    )}
                />
            </div>
            {#if gameSession.isCommanding}
                <div class="nt-battle-continue">
                    <button
                        type="button"
                        class="nt-plain-button"
                        onclick={() => gameSession.setConcludedBattleAside()}>Continue</button
                    >
                </div>
            {:else if !game.result}
                <div class="nt-battle-prompt nt-battle-faint">
                    Waiting for <PlayerName playerId={game.activePlayerIds[0]} />.
                </div>
            {/if}
        {:else if !stage}
            {#if gameSession.attack}
                <div class="nt-battle-prompt">
                    Waiting for <PlayerName playerId={game.activePlayerIds[0]} />
                    {awaitedStep(gameSession.attack, game)}.
                </div>
            {/if}
        {:else}
            <div class="nt-battle-step">
                {#if stage.kind === StageKind.Defence}
                    <DefenseStep {stage} {folded} />
                {:else if stage.kind === StageKind.DefenceLeaders}
                    <LeadStep {stage} {folded} />
                {:else if stage.kind === StageKind.Retreat}
                    <RetreatStep {stage} />
                {:else if stage.kind === StageKind.Feint}
                    <FeintStep {stage} {folded} />
                {:else if stage.kind === StageKind.Declaration}
                    <DeclareStep {stage} {folded} />
                {:else if stage.kind === StageKind.Occupation}
                    <OccupyStep {stage} {folded} />
                {:else if stage.kind === StageKind.Counter}
                    <CounterStep {stage} {folded} />
                {:else}
                    <DecisionStep {stage} {folded} />
                {/if}
            </div>
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

    .nt-battle-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
    }

    .nt-battle-heading {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 16px;
        min-width: 0;
    }

    .nt-battle-title {
        font-size: 17px;
        font-style: italic;
    }

    .nt-battle-toggle {
        margin-left: auto;
    }

    .nt-battle-step {
        display: contents;
    }

    .nt-battle-folded {
        gap: 3px;
    }

    .nt-battle-folded .nt-battle-step {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
    }

    .nt-battle-folded .nt-battle-step > :global(.nt-battle-prompt) {
        max-width: none;
    }

    .nt-battle-folded .nt-battle-step > :global(.pt-1) {
        padding-top: 0;
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

    .nt-battle-ending {
        padding-top: 2px;
    }

    .nt-battle-continue {
        padding-top: 10px;
    }

    .nt-battle-over {
        font-style: italic;
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
