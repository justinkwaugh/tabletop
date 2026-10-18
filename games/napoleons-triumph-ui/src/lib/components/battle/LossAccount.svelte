<script lang="ts">
    import { Side } from '@tabletop/napoleons-triumph'
    import {
        PENALTY_NAMES,
        lossSummary,
        owedByAttacker,
        owedByDefender,
        type AttackLosses,
        type OwedLine,
        type SideLosses
    } from '$lib/model/attackLosses.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AccountSheet from './AccountSheet.svelte'

    let { losses, onclose }: { losses: AttackLosses; onclose: () => void } = $props()

    const gameSession = getGameSession()
    const attack = $derived(gameSession.shownAttack)
    const accounts = $derived(gameSession.resultAccounts)

    const ARMIES: Record<Side, string> = {
        [Side.French]: 'The French',
        [Side.Allied]: 'The Allies'
    }

    function owedBy(side: SideLosses): OwedLine[] {
        if (!attack || attack.finalResult === undefined || !accounts.initial) {
            return []
        }
        return side.playerId === attack.attackerId
            ? owedByAttacker(accounts.initial, attack.finalResult)
            : owedByDefender(
                  accounts.initial,
                  attack.finalResult,
                  (accounts.counter ?? []).flatMap((term) => term.faces ?? []).length
              )
    }

    function wonTheFight(side: SideLosses): boolean {
        return (
            attack?.attackerWon !== undefined &&
            attack.attackerWon === (side.playerId === attack.attackerId)
        )
    }
</script>

<AccountSheet label="What the attack has cost" {onclose}>
    {#snippet title()}Losses{/snippet}
    {#snippet description()}
        What the attack has cost each army so far, in steps and in morale. Only the army that loses
        the fight, or retreats, pays morale for the steps it loses.
    {/snippet}
    {#each [losses.attacker, losses.defender] as side (side.playerId)}
        {@const owed = owedBy(side)}
        <section>
            <h3>
                <span>{ARMIES[gameSession.gameState.sideOf(side.playerId)]}</span>
                <b>{lossSummary(side)}</b>
            </h3>
            <table>
                <tbody>
                    {#each owed as line, index (index)}
                        <tr>
                            <th scope="row">{line.text}</th>
                            <td>{line.steps}</td>
                        </tr>
                    {/each}
                    {#if side.paidForSteps > 0}
                        <tr>
                            <th scope="row">Morale for the steps lost</th>
                            <td>{side.paidForSteps}</td>
                        </tr>
                    {:else if side.steps > 0 && wonTheFight(side)}
                        <tr>
                            <th scope="row">No morale for its steps, having won the fight</th>
                            <td>0</td>
                        </tr>
                    {/if}
                    {#each side.penalties as penalty, index (index)}
                        <tr>
                            <th scope="row">{PENALTY_NAMES[penalty.kind]}, in morale</th>
                            <td>{penalty.moraleLost}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>
    {/each}
</AccountSheet>

<style>
    section + section {
        padding-top: 4px;
    }

    h3 {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--nt-ink) 45%, transparent);
        font-size: 16px;
        font-style: italic;
    }

    h3 b {
        font-size: 15px;
        font-style: normal;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        padding: 5px 12px 5px 0;
        font-weight: 400;
        line-height: 1.3;
        text-align: left;
    }

    td {
        padding: 5px 0;
        font-size: 16px;
        font-weight: 700;
        text-align: right;
        vertical-align: top;
        white-space: nowrap;
    }
</style>
