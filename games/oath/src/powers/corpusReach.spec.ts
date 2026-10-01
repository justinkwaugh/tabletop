import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { cardDefinition, cardIdsOfKind } from '../data/cardRegistry.js'
import { BattlePlanSide, cardPowers, PowerTiming } from '../data/cardPowers.js'
import { CardKind } from '../model/oathEnums.js'
import { MachineState } from '../definition/states.js'
import { legalPowers } from '../util/powerDoorway.js'
import { mandatoryModifiers, usableModifiers } from '../util/modifiers.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { persistentsInPlay } from '../util/persistent.js'
import { hasEffect } from './registry.js'
import { HydratedUseRestPower } from '../actions/useRestPower.js'
import '../powers/index.js'
import { reachTable, routesFor, listed } from '../testing/reach.js'

const CARDS = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)].filter((id) => cardPowers(id).some((p) => hasEffect(p)))

describe('every built card is in reach by every route', () => {
    for (const cardId of CARDS) {
        for (const power of cardPowers(cardId)) {
            if (!hasEffect(power)) continue
            if (![PowerTiming.Modifier, PowerTiming.Action, PowerTiming.Rest, PowerTiming.BattlePlan, PowerTiming.Persistent].includes(power.timing)) continue
            it(`${cardDefinition(cardId)?.name ?? cardId} (${power.timing}${power.modifiesAction ? ':' + power.modifiesAction : ''})`, () => {
                for (const route of routesFor(cardId)) {
                    const s = reachTable(cardId, route, power.timing === PowerTiming.Rest ? MachineState.RestPhase : MachineState.ActPhase, power.timing === PowerTiming.BattlePlan || power.timing === PowerTiming.Persistent)
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
                        case PowerTiming.Rest:
                            expect(listed(cardId, HydratedUseRestPower.legalRestPowers(s, 'me')), `${route}: offered as a Rest power`).toBe(true)
                            break
                        case PowerTiming.BattlePlan: {
                            const side = power.battlePlanSide === BattlePlanSide.Defender ? BattlePlanSide.Defender : BattlePlanSide.Attacker
                            expect(listed(cardId, usableBattlePlans(s, 'me', side)), `${route}: offered as a battle plan`).toBe(true)
                            break
                        }
                        case PowerTiming.Persistent:
                            expect(persistentsInPlay(s).some((p) => p.ctx.cardId === cardId && p.ctx.ownerIds.includes('me')), `${route}: in play for me`).toBe(true)
                            break
                    }
                }
            })
        }
    }
})
