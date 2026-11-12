import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { card, player } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { cardPower, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { offeredChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'
import './index.js'

// Assassin: "Action: Discard a faceup adviser of a player whose pawn is at your site." Its card is
// picked after its player, so it offers only that player's faceup advisers a discard can take
// (R-7.2.2: a locked adviser cannot be discarded), and a player with none is not offered.

const ASSASSIN = 'denizen.discord.assassin'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const TENTS = 'denizen.nomad.tents'
const FAITHFUL_FRIEND = 'denizen.nomad.faithful-friend'

const DANA = 'dana'
const POWER = powerIndexOf(ASSASSIN, PowerTiming.Action)

/** An adviser as the fixture and `setAdvisers` both take it. */
type Row = { cardId: string; faceUp: boolean }

const up = (cardId: string): Row => ({ cardId, faceUp: true })
const down = (cardId: string): Row => ({ cardId, faceUp: false })

/** Dana at c1 with Assassin; Rhys at c1, and the Chancellor too when `chancellor` is given. */
function table(rhys: Row[], chancellor?: Row[]): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                advisers: [up(ASSASSIN)]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c1', advisers: rhys })
        ]),
        {
            oathRevision: CURRENT_OATH_REVISION,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } }
        }
    )
    const chancellorState = s.getPlayerState('chancellor')
    if (chancellor) {
        chancellorState.siteId = 'c1'
        chancellorState.setAdvisers(chancellor)
    } else {
        chancellorState.siteId = 'c2'
    }
    openTurn(s, DANA)
    return s
}

function printed() {
    const power = cardPower(ASSASSIN, POWER)
    if (!power) throw Error(`${ASSASSIN} prints no Action power`)
    return power
}

/** The players Assassin offers. */
function offeredPlayers(s: HydratedOathGameState): string[] {
    const [players] = offeredChoices(s, DANA, printed())
    return players.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Player ? [option.playerId] : []
    )
}

/** The cards Assassin offers once `target` is picked. */
function offeredCardsFor(s: HydratedOathGameState, target: string): string[] {
    const [, cards] = offeredChoices(s, DANA, printed(), undefined, [player(target)])
    return cards.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

/** Every player and card pair Assassin offers, each card read after its player. */
function offeredPairs(s: HydratedOathGameState): [string, string][] {
    return offeredPlayers(s).flatMap((who) =>
        offeredCardsFor(s, who).map((what): [string, string] => [who, what])
    )
}

const reasonFor = (s: HydratedOathGameState, choices: PowerChoice[]) =>
    HydratedUseActionPower.reasonCannotUse(s, DANA, ASSASSIN, POWER, choices)

describe("Assassin offers only the picked player's faceup advisers", () => {
    it('two other players at the site: every pair offered is accepted, and the mismatched pairs are not offered', () => {
        const s = table([up(WOLVES)], [up(SCOUTS)])
        expect(offeredPlayers(s)).toEqual(['rhys', 'chancellor'])
        expect(offeredPairs(s)).toEqual([
            ['rhys', WOLVES],
            ['chancellor', SCOUTS]
        ])
        for (const [who, what] of offeredPairs(s)) {
            expect(reasonFor(s, [player(who), card(what)])).toBeUndefined()
        }
        expect(offeredCardsFor(s, 'rhys')).not.toContain(SCOUTS)
        expect(offeredCardsFor(s, 'chancellor')).not.toContain(WOLVES)
        expect(reasonFor(s, [player('rhys'), card(SCOUTS)])).toMatch(/not among the options/)
        expect(reasonFor(s, [player('chancellor'), card(WOLVES)])).toMatch(/not among the options/)
    })

    it('a player whose only faceup adviser is locked is not offered, nor one with only facedown advisers', () => {
        for (const chancellor of [[up(FAITHFUL_FRIEND)], [down(SCOUTS)], []]) {
            const s = table([up(WOLVES)], chancellor)
            expect(offeredPlayers(s)).toEqual(['rhys'])
            expect(offeredPairs(s)).toEqual([['rhys', WOLVES]])
            expect(reasonFor(s, [player('chancellor'), card(FAITHFUL_FRIEND)])).toMatch(
                /not among the options/
            )
        }
    })

    it('one player at the site: as before, their faceup advisers that can be discarded', () => {
        const s = table([up(WOLVES), down(TENTS), up(SCOUTS), up(FAITHFUL_FRIEND)])
        expect(offeredPlayers(s)).toEqual(['rhys'])
        const [, cards] = offeredChoices(s, DANA, printed())
        expect(cards.options).toEqual([card(WOLVES), card(SCOUTS)])
        expect(offeredCardsFor(s, 'rhys')).toEqual([WOLVES, SCOUTS])
        expect(reasonFor(s, [player('rhys'), card(SCOUTS)])).toBeUndefined()
        expect(reasonFor(s, [player('rhys'), card(TENTS)])).toMatch(/not among the options/)
    })
})

describe("on Dana's own view", () => {
    const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it('the same players, cards and answers, with the state neither copied nor changed', () => {
        for (const s of [
            table([up(WOLVES), down(TENTS)], [up(SCOUTS)]),
            table([up(WOLVES)], [up(FAITHFUL_FRIEND)]),
            table([up(WOLVES), up(SCOUTS)])
        ]) {
            s.getPlayerState('rhys').handIds = [TENTS]
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = ownView(s)
            expect(offeredPlayers(view)).toEqual(offeredPlayers(s))
            expect(offeredPairs(view)).toEqual(offeredPairs(s))
            for (const who of ['rhys', 'chancellor']) {
                for (const what of [WOLVES, SCOUTS, FAITHFUL_FRIEND]) {
                    const choices = [player(who), card(what)]
                    expect(reasonFor(view, choices)).toBe(reasonFor(s, choices))
                }
            }
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
