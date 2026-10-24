import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    CURRENT_OATH_REVISION,
    PowerChoiceKind,
    PowerTiming,
    allPowers,
    choiceSpecsAt,
    type CardPower,
    type ChoiceSpec
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { isPowerMoves } from './powerMoves.js'
import { pickerWords } from './powerPickerWords.js'

/** Every choice every printed power declares, under each revision a game may be played at. */
function declaredChoices(): { power: CardPower; specs: ChoiceSpec[] }[] {
    const seen: { power: CardPower; specs: ChoiceSpec[] }[] = []
    for (let revision = 0; revision <= CURRENT_OATH_REVISION; revision += 1) {
        const state = testState(
            [testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1' })],
            {
                oathRevision: revision
            }
        )
        for (const power of allPowers()) {
            seen.push({ power, specs: choiceSpecsAt(state, power) })
        }
    }
    return seen
}

const name = (power: CardPower, spec: number) =>
    `${power.cardId}#${power.powerIndex} choice ${spec}`

/**
 * R-7.1.3 — a power's picker draws each kind of choice its own way: warbands as rows of pieces or
 * a place's button, cards, relics and facedown advisers as cards, players as chips, piles as rows,
 * banks, counts, exchanges and bargains by their own pickers, a "may" and an "or" as answers. A
 * site and a yes have no card to stand for them, so these say each is drawn some other way too,
 * and the picker needs no generic dropdown for any choice.
 */
describe('R-7.1.3 — every choice a power declares has a picker of its own', () => {
    const declared = declaredChoices()

    it('a site, picked alone: on the lit map (Use a power, with its words), under its card, or as a move’s To', () => {
        const sites = declared.flatMap(({ power, specs }) =>
            specs.flatMap((spec, i) =>
                spec.kind === PowerChoiceKind.Site && spec.max <= 1 ? [{ power, specs, i }] : []
            )
        )
        expect(sites.length, 'some power picks a site').toBeGreaterThan(0)
        const undrawn = sites.flatMap(({ power, specs, i }) => {
            const words = pickerWords(power.cardId)
            const onTheMap = words.site !== undefined && power.timing === PowerTiming.Action
            const moves = isPowerMoves(specs.map((spec) => ({ spec, options: [] })))
            return onTheMap || words.siteButtons || moves ? [] : [name(power, i)]
        })
        expect([...new Set(undrawn)]).toEqual([])
    })

    it('a yes: a "may" the card offers, or one branch of an "or", never a yes it needs alone', () => {
        const needed = declared.flatMap(({ power, specs }) =>
            specs.flatMap((spec, i) =>
                spec.kind === PowerChoiceKind.Yes && spec.min > 0 && !spec.or
                    ? [name(power, i)]
                    : []
            )
        )
        expect([...new Set(needed)]).toEqual([])
    })
})
