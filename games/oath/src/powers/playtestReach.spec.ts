import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { PLAYTEST_DECK, PLAYTEST_RELICS } from '../data/playtestDeck.js'
import { cardDefinition } from '../data/cardRegistry.js'
import { BattlePlanSide, cardPowers, PowerTiming } from '../data/cardPowers.js'
import { MachineState } from '../definition/states.js'
import { legalPowers } from '../util/powerDoorway.js'
import { mandatoryModifiers, usableModifiers } from '../util/modifiers.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { persistentsInPlay } from '../util/persistent.js'
import { hasEffect } from './registry.js'
import { HydratedUseRestPower } from '../actions/useRestPower.js'
import '../powers/index.js'
import { reachTable, routesFor, listed } from '../testing/reach.js'

export const REACH_CARDS = [...PLAYTEST_DECK, ...PLAYTEST_RELICS]

describe('the playtest deck is in reach by every route', () => {
    for (const cardId of REACH_CARDS) {
        const powers = cardPowers(cardId)
        for (const power of powers) {
            const name = `${cardDefinition(cardId)?.name ?? cardId} (${power.timing}${power.modifiesAction ? ':' + power.modifiesAction : ''})`
            it(name, () => {
                expect(hasEffect(power), 'built').toBe(true)
                for (const route of routesFor(cardId)) {
                    const s = reachTable(cardId, route, MachineState.ActPhase, power.timing === PowerTiming.BattlePlan || power.timing === PowerTiming.Persistent)
                    switch (power.timing) {
                        case PowerTiming.Modifier: {
                            const action = power.modifiesAction
                            assertExists(action, 'a Modifier power names the action it modifies')
                            const list = [...usableModifiers(s, 'me', action), ...mandatoryModifiers(s, 'me', action).map((m) => m.power)]
                            expect(listed(cardId, list), `${route}: listed for ${action}`).toBe(true)
                            break
                        }
                        case PowerTiming.Action:
                            expect(listed(cardId, legalPowers(s, 'me', PowerTiming.Action)), `${route}: offered as an Action power`).toBe(true)
                            break
                        case PowerTiming.Rest: {
                            const r = reachTable(cardId, route, MachineState.RestPhase)
                            expect(listed(cardId, HydratedUseRestPower.legalRestPowers(r, 'me')), `${route}: offered as a Rest power`).toBe(true)
                            break
                        }
                        case PowerTiming.BattlePlan: {
                            const side = power.battlePlanSide === BattlePlanSide.Defender ? BattlePlanSide.Defender : BattlePlanSide.Attacker
                            expect(listed(cardId, usableBattlePlans(s, 'me', side)), `${route}: offered as a battle plan`).toBe(true)
                            break
                        }
                        case PowerTiming.Persistent:
                            expect(persistentsInPlay(s).some((p) => p.ctx.cardId === cardId && p.ctx.ownerIds.includes('me')), `${route}: in play for me`).toBe(true)
                            break
                        default:
                            break
                    }
                }
                const foreign = reachTable(cardId, 'foreign')
                if (power.timing === PowerTiming.Modifier) {
                    assertExists(power.modifiesAction, 'a Modifier power names the action it modifies')
                    expect(listed(cardId, usableModifiers(foreign, 'me', power.modifiesAction))).toBe(false)
                }
                if (power.timing === PowerTiming.Action) expect(listed(cardId, legalPowers(foreign, 'me', PowerTiming.Action))).toBe(false)
                if (power.timing === PowerTiming.BattlePlan) expect(listed(cardId, usableBattlePlans(foreign, 'me', BattlePlanSide.Attacker))).toBe(false)
            })
        }
    }
})
