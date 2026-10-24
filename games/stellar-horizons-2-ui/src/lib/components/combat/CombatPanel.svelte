<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        CombatSide,
        MachineState,
        hitChooser,
        hitTargets,
        lostShipIds,
        raidChoices,
        raidResult,
        sameHitTarget,
        shipDefinition,
        sideBeingHit,
        sideOwner,
        type HitTarget
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        combatUnits,
        raidChoiceLabel,
        raidOutcomeText,
        raidRollText,
        rollText
    } from '$lib/utils/combat.js'
    import {
        COMBAT_KIND_LABELS,
        RAID_RESULT_LABELS,
        plural,
        systemName
    } from '$lib/utils/presentation.js'
    import ShipCounter from '../board/ShipCounter.svelte'

    const COUNTER_SIZE = 64
    const SIDES = [CombatSide.Attacker, CombatSide.Defender] as const

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const combat = $derived(gameSession.shownCombat)
    // Once fought, the combat is shown as it ended, with the markers drawn and IP gained.
    const outcome = $derived(combat && 'outcome' in combat ? combat.outcome : undefined)
    const live = $derived(combat !== undefined && outcome === undefined)
    const hitSide = $derived(live && combat ? sideBeingHit(combat) : undefined)
    const chooser = $derived(live && combat?.rolls ? hitChooser(combat) : undefined)
    const choosing = $derived(
        chooser !== undefined && chooser === gameSession.myPlayerId && gameSession.canAct
    )
    const targets: HitTarget[] = $derived(choosing ? hitTargets(gameState) : [])
    const raiding = $derived(
        live &&
            gameState.machineState === MachineState.ResolvingRaid &&
            combat?.attackerId === gameSession.myPlayerId &&
            gameSession.canAct
    )

    function targetable(target: HitTarget): boolean {
        return targets.some((candidate) => sameHitTarget(candidate, target))
    }
</script>

{#if combat}
    <aside class="panel" aria-label="Combat at {systemName(combat.systemId)}">
        <header>
            <h2>
                {COMBAT_KIND_LABELS[combat.kind]} at {systemName(combat.systemId)}{outcome
                    ? ' · over'
                    : ''}
            </h2>
            <button type="button" class="back" onclick={() => gameSession.leaveFocus()}
                >Back to map</button
            >
        </header>
        <div class="body">
            {#if combat.raid}
                {@const raid = combat.raid}
                <section class="raid">
                    <span
                        >Raid roll: {raidRollText(raid)}: {RAID_RESULT_LABELS[
                            raidResult(raid.total)
                        ]}</span
                    >
                    <span class="note">Damage roll: {raid.percentile}%</span>
                    {#if raiding}
                        <p class="status"><b>Choose the raid's result</b></p>
                        <div class="choices">
                            {#each raidChoices(gameState) as choice, index (index)}
                                <button
                                    type="button"
                                    class="choice"
                                    onclick={() => gameSession.resolveRaid(choice)}
                                    >{raidChoiceLabel(choice)}</button
                                >
                            {/each}
                        </div>
                    {:else if live && !combat.raidOutcome}
                        <p class="status">
                            <PlayerName playerId={combat.attackerId} /> chooses the result
                        </p>
                    {/if}
                    {#if combat.raidOutcome}
                        <p class="status">{raidOutcomeText(combat.raidOutcome)}</p>
                    {/if}
                </section>
            {/if}
            {#each SIDES as side (side)}
                {@const roll = combat.rolls?.[side]}
                {@const hitsLeft = live ? combat.hits[side] : 0}
                <section class="side" class:hit={hitSide === side}>
                    <h3>
                        <PlayerName playerId={sideOwner(combat, side)} />
                        <span class="role"
                            >{side === CombatSide.Attacker ? 'attacks' : 'defends'}</span
                        >
                    </h3>
                    {#if roll}
                        <p class="roll">
                            Rolled {rollText(roll)} · combat value {roll.combatValue} ·
                            <b>{plural(roll.hits, 'hit')}</b>
                        </p>
                    {/if}
                    <div class="units">
                        {#each combatUnits(gameState, combat, side) as unit (unit.target.kind === 'Ship' ? unit.target.shipId : 'base')}
                            <button
                                type="button"
                                class="unit"
                                class:target={targetable(unit.target)}
                                disabled={!targetable(unit.target)}
                                aria-label={targetable(unit.target)
                                    ? `Hit ${unit.name}`
                                    : unit.name}
                                onclick={() => gameSession.assignHit(unit.target)}
                            >
                                {#if unit.ship}
                                    <svg
                                        width={COUNTER_SIZE}
                                        height={COUNTER_SIZE}
                                        viewBox="0 0 {COUNTER_SIZE} {COUNTER_SIZE}"
                                        overflow="visible"
                                        aria-hidden="true"
                                    >
                                        <ShipCounter ship={unit.ship} size={COUNTER_SIZE} />
                                    </svg>
                                {/if}
                                <span class="name">{unit.name}</span>
                                <span class="note">{unit.detail}</span>
                            </button>
                        {/each}
                        {#each lostShipIds(gameState, combat, side) as shipId (shipId)}
                            <span class="unit lost">
                                <span class="name">{shipDefinition(shipId).name}</span>
                                <span class="note">Destroyed</span>
                            </span>
                        {/each}
                        {#if side === CombatSide.Defender && combat.defenderLosses.baseEliminated}
                            <span class="unit lost">
                                <span class="name">Base</span>
                                <span class="note">Eliminated</span>
                            </span>
                        {/if}
                    </div>
                    {#if hitSide === side && chooser}
                        <p class="status">
                            {plural(hitsLeft, 'hit')} left on these units ·
                            {#if choosing}
                                <b>choose the unit for the next</b>
                            {:else}
                                <PlayerName playerId={chooser} /> chooses the next
                            {/if}
                        </p>
                    {:else if hitsLeft > 0}
                        <p class="status">{plural(hitsLeft, 'hit')} to take next</p>
                    {/if}
                </section>
            {/each}
            {#if outcome}
                <section class="outcome">
                    {#if outcome.declined}
                        <p class="status">
                            <PlayerName playerId={combat.attackerId} /> declined the escalation markers,
                            so <PlayerName playerId={combat.defenderId} /> gains no IP.
                        </p>
                    {:else if outcome.owed === 0}
                        <p class="status">No escalation markers: the raid had no effect.</p>
                    {:else}
                        <p class="status">
                            <PlayerName playerId={combat.attackerId} /> draws {plural(
                                outcome.owed,
                                'escalation marker'
                            )};
                            <PlayerName playerId={combat.defenderId} /> gains {outcome.influence} IP.
                        </p>
                    {/if}
                </section>
            {/if}
        </div>
    </aside>
{/if}

<style>
    .panel {
        height: 100%;
        overflow: hidden;
        border-left: 1px solid #1e2b44;
        background: #0c1220;
        color: #dbe7f5;
        display: flex;
        flex-direction: column;
    }

    header {
        display: flex;
        flex-shrink: 0;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 14px 16px 10px;
        border-bottom: 1px solid #1e2b44;
    }

    h2 {
        font-size: 20px;
        font-weight: 600;
        color: #f2c94c;
    }

    .back {
        flex-shrink: 0;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid #2f5f86;
        background: #16304b;
        color: #e8f1ff;
        font-size: 13px;
    }

    .body {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
        overflow-y: auto;
        padding: 12px 16px 14px;
    }

    .side {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border: 1px solid #1e2b44;
        border-radius: 10px;
        background: #0d1322;
    }

    .side.hit {
        border-color: #a8443d;
    }

    h3 {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 15px;
    }

    .role,
    .note {
        font-size: 12px;
        color: #9fb4d0;
    }

    .roll,
    .status {
        margin: 0;
        font-size: 13px;
    }

    .units {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .unit {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 88px;
        padding: 6px;
        border: 1px solid #1e2b44;
        border-radius: 8px;
        background: #111a2c;
        color: inherit;
    }

    .raid {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .choice {
        padding: 4px 10px;
        border: 1px solid #f2d27a;
        border-radius: 8px;
        background: #111a2c;
        color: inherit;
        font-size: 13px;
    }

    .outcome {
        padding: 8px;
        border: 1px solid #1e2b44;
        border-radius: 10px;
    }

    .unit.target {
        cursor: pointer;
        border-color: #f2d27a;
    }

    .unit.lost {
        opacity: 0.5;
        text-decoration: line-through;
    }

    .name {
        font-size: 13px;
        font-weight: 600;
    }
</style>
