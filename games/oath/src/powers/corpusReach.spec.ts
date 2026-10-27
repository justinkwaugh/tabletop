import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { cardDefinition, cardIdsOfKind } from '../data/cardRegistry.js'
import {
    BattlePlanSide,
    cardPowers,
    EdificeFace,
    PowerTiming,
    type CardPower,
    type PowerUseKey
} from '../data/cardPowers.js'
import { edificeName } from '../data/edifices.js'
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
import { partiesSuspendingNobody } from '../testing/fixture.js'

const CARDS = [
    ...cardIdsOfKind(CardKind.Denizen),
    ...cardIdsOfKind(CardKind.Relic),
    ...cardIdsOfKind(CardKind.Edifice)
].filter((id) => cardPowers(id).some((p) => hasEffect(p)))

/** R-2.9 — an edifice's power is listed with its own side up, and by its index: both Forge sides are Actions. */
function listedPower(power: CardPower, powers: readonly PowerUseKey[]): boolean {
    return power.face === undefined
        ? listed(power.cardId, powers)
        : powers.some((p) => p.cardId === power.cardId && p.powerIndex === power.powerIndex)
}

describe('every built card is in reach by every route', () => {
    it('walks the edifices, both sides of each built one', () => {
        const sides = CARDS.flatMap((cardId) =>
            cardPowers(cardId).filter((p) => p.face !== undefined && hasEffect(p))
        )
        expect(sides.map((p) => [p.cardId, p.face])).toEqual(
            expect.arrayContaining([
                ['edifice.hearth.hall-of-debate', EdificeFace.Intact],
                ['edifice.hearth.hall-of-debate', EdificeFace.Ruined],
                ['edifice.nomad.ancient-forge', EdificeFace.Intact],
                ['edifice.nomad.ancient-forge', EdificeFace.Ruined],
                ['edifice.order.sprawling-rampart', EdificeFace.Intact],
                ['edifice.order.sprawling-rampart', EdificeFace.Ruined]
            ])
        )
    })

    for (const cardId of CARDS) {
        for (const power of cardPowers(cardId)) {
            if (!hasEffect(power)) continue
            if (
                ![
                    PowerTiming.Modifier,
                    PowerTiming.Action,
                    PowerTiming.Rest,
                    PowerTiming.BattlePlan,
                    PowerTiming.Persistent
                ].includes(power.timing)
            )
                continue
            const name =
                power.face === undefined
                    ? (cardDefinition(cardId)?.name ?? cardId)
                    : edificeName(cardId, power.face === EdificeFace.Ruined)
            it(`${name} (${power.timing}${power.modifiesAction ? ':' + power.modifiesAction : ''})`, () => {
                for (const route of routesFor(cardId)) {
                    const s = reachTable(
                        cardId,
                        route,
                        power.timing === PowerTiming.Rest
                            ? MachineState.RestPhase
                            : MachineState.ActPhase,
                        power.timing === PowerTiming.BattlePlan ||
                            power.timing === PowerTiming.Persistent
                    )
                    if (power.face === EdificeFace.Ruined) s.setEdificeRuined(cardId, true)
                    switch (power.timing) {
                        case PowerTiming.Modifier: {
                            const action = power.modifiesAction
                            assertExists(action, 'a Modifier power names the action it modifies')
                            const list = [
                                ...usableModifiers(s, 'me', action),
                                ...mandatoryModifiers(s, 'me', action).map((m) => m.power)
                            ]
                            expect(listedPower(power, list), `${route}: listed for ${action}`).toBe(
                                true
                            )
                            break
                        }
                        case PowerTiming.Action:
                            expect(
                                listedPower(power, legalPowers(s, 'me', PowerTiming.Action)),
                                `${route}: offered as an Action power`
                            ).toBe(true)
                            break
                        case PowerTiming.Rest:
                            expect(
                                listedPower(power, HydratedUseRestPower.legalRestPowers(s, 'me')),
                                `${route}: offered as a Rest power`
                            ).toBe(true)
                            break
                        case PowerTiming.BattlePlan: {
                            const side =
                                power.battlePlanSide === BattlePlanSide.Defender
                                    ? BattlePlanSide.Defender
                                    : BattlePlanSide.Attacker
                            expect(
                                listedPower(
                                    power,
                                    usableBattlePlans(
                                        s,
                                        'me',
                                        side,
                                        partiesSuspendingNobody(s, 'me')
                                    )
                                ),
                                `${route}: offered as a battle plan`
                            ).toBe(true)
                            break
                        }
                        case PowerTiming.Persistent:
                            expect(
                                persistentsInPlay(s).some(
                                    (p) =>
                                        p.ctx.cardId === cardId &&
                                        p.ctx.power.powerIndex === power.powerIndex &&
                                        p.ctx.ownerIds.includes('me')
                                ),
                                `${route}: in play for me`
                            ).toBe(true)
                            break
                    }
                }
            })
        }
    }
})
