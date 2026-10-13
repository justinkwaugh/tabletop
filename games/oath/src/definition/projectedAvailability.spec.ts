import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { MachineState } from './states.js'
import { cardDefinition, cardIdsOfKind } from '../data/cardRegistry.js'
import { cardPowers, PowerTiming } from '../data/cardPowers.js'
import { CardKind, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'
import { hasEffect } from '../powers/registry.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { legalPowers } from '../util/powerDoorway.js'
import '../powers/index.js'

const SEATS = ['me', 'foe', 'chan']
const game = { ...testGame(SEATS), hotseat: false, protectedInformation: true as const }

/**
 * Me to act, with the card held or at my site, and enough favor and secrets for any card's cost (the
 * dearest takes two secrets); the foe holds a facedown adviser and the vault holds facedown relics, so
 * each view lacks something the server has.
 */
function table(machineState: MachineState, cardId: string, at: 'held' | 'site') {
    const held =
        at === 'site'
            ? {}
            : cardId.startsWith('relic.')
              ? { relicIds: ['relic.cup-of-plenty', cardId] }
              : { advisers: [{ cardId, faceUp: true }] }
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 6, secrets: 3, supply: 6, warbandsOnBoard: { me: 3 }, warbandsInPersonalBank: { me: 6 }, relicIds: ['relic.cup-of-plenty'], ...held }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 3, supply: 4, warbandsOnBoard: { foe: 2 }, warbandsInPersonalBank: { foe: 5 }, advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }], relicIds: ['relic.map'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 3, secrets: 3, supply: 4, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: at === 'site' ? [cardId] : ['denizen.hearth.storyteller'], c2: ['denizen.beast.wolves'], p1: ['denizen.arcane.tutor'], h1: [] },
            warbandsBySite: { c1: { me: 2, foe: 1 }, c2: { me: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }],
            vault: testVaultWithRelics({ 'c1-r1': 'relic.bandit-crown', 'reliquary.0': 'relic.book-of-records', 'reliquary.1': 'relic.cracked-horn' })
        }
    )
    const d = s.dehydrate()
    d.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: SEATS, turnCounts: { me: 1, foe: 0, chan: 0 } }
    d.activePlayerIds = ['me']
    return d
}

const ACTED: readonly PowerTiming[] = [PowerTiming.Action, PowerTiming.Rest]
const CARDS = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)].filter((cardId) =>
    cardPowers(cardId).some((power) => hasEffect(power) && ACTED.includes(power.timing))
)

// The table asks for each seat's actions on that seat's own view, where host-only values and others'
// hidden values cannot be read; an availability check that reads one empties the seat's whole list.
describe("every Action and Rest power leaves each seat's offer the same on its own view as on the server", () => {
    it('walks every built card with such a power, the two that judge a Campaign before it is declared among them', () => {
        expect(CARDS.length).toBeGreaterThan(50)
        expect(CARDS).toEqual(expect.arrayContaining(['denizen.beast.wild-allies', 'denizen.order.captains']))
    })

    for (const cardId of CARDS) {
        const name = cardDefinition(cardId)?.name ?? cardId
        const places = cardId.startsWith('relic.') ? (['held'] as const) : (['held', 'site'] as const)
        for (const at of places) {
            it(`${name} (${at})`, () => {
                for (const phase of [MachineState.ActPhase, MachineState.RestPhase]) {
                    const state = table(phase, cardId, at)
                    // A power the server skips (unaffordable, out of reach) never runs its checks,
                    // so each must be offered there before the views are compared.
                    const timing = phase === MachineState.ActPhase ? PowerTiming.Action : PowerTiming.Rest
                    const offered = legalPowers(new HydratedOathGameState(state), 'me', timing)
                    for (const power of cardPowers(cardId)) {
                        if (!hasEffect(power) || power.timing !== timing) continue
                        expect(
                            offered.some((use) => use.cardId === cardId && use.powerIndex === power.powerIndex),
                            `${phase}: power ${power.powerIndex} offered on the server`
                        ).toBe(true)
                    }
                    for (const playerId of SEATS) {
                        const view: Visibility.Perspective = { kind: 'player', playerId }
                        const server = engine.getValidActionTypesForPlayer(game, state, playerId)
                        const own = engine.getValidActionTypesForPlayer(game, served(state, view), playerId, { perspective: view })
                        expect(own, `${phase}, ${playerId}`).toEqual(server)
                    }
                }
            })
        }
    }
})
