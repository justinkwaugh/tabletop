import { describe, expect, it } from 'vitest'
import { Side, objectiveHolds } from '@tabletop/napoleons-triumph'
import { TestGame, cavalry, frenchTurn, infantry } from '@tabletop/napoleons-triumph/testing'
import { armyObjectives } from './armyObjectives.js'

const RED_AND_BLACK_STARS = 126
const THREE_STARS = 128
const BLUE_STAR = 62

function seenBy(game: TestGame, viewerSide: Side, armySide: Side) {
    const state = game.seenBy(viewerSide)
    const holds = [Side.French, Side.Allied].flatMap((side) =>
        objectiveHolds(state, game.playerOf(side))
    )
    return armyObjectives(state, game.playerOf(armySide), holds)
}

const position = () =>
    frenchTurn([
        {
            id: 'F01',
            side: Side.French,
            face: infantry(3),
            locale: RED_AND_BLACK_STARS,
            commanderId: 'lannes'
        },
        {
            id: 'F02',
            side: Side.French,
            face: cavalry(3),
            locale: THREE_STARS,
            commanderId: 'murat'
        },
        {
            id: 'A01',
            side: Side.Allied,
            face: infantry(2),
            locale: BLUE_STAR,
            commanderId: 'bagration'
        }
    ])

describe('the objective stars line of the armies panel', () => {
    it('fills the stars an army holds and leaves the rest as printed', () => {
        expect(seenBy(position(), Side.French, Side.French)).toEqual({
            stars: [
                { star: 'Green', hold: undefined, explanation: 'No green star held' },
                { star: 'Red', hold: 'held', explanation: 'Red star held at locale 126' },
                { star: 'Black', hold: 'held', explanation: 'Black star held at locale 126' }
            ],
            terms: 'Any one stops the Allies winning'
        })
    })

    it('shows a hold the viewer cannot confirm as possible', () => {
        expect(seenBy(position(), Side.French, Side.Allied).stars).toEqual([
            {
                star: 'Blue',
                hold: 'possible',
                explanation: 'Blue star perhaps held at locale 62: the units there are face-down'
            }
        ])
        expect(seenBy(position(), Side.Allied, Side.Allied).stars[0].hold).toBe('held')
    })

    it('gives the terms that apply once French reinforcements have come on', () => {
        const game = position()
        game.arrange((state) => {
            state.frenchReinforcementsEntered = true
        })
        expect(seenBy(game, Side.French, Side.French).terms).toBe(
            'All three win if the Allies hold none'
        )
        expect(seenBy(game, Side.French, Side.Allied).terms).toBe('One stops the French winning')
    })
})
