import { HydratedTileBag } from '../components/tileBag.js'
import { generateMarketTile } from '../components/tiles.js'
import { ActionType } from '../definition/actions.js'
import { HydratedDrawTile } from './drawTile.js'
import { ActionSource, getPrng } from '@tabletop/common'
import { v4 as uuid } from 'uuid'
import { generateTestState } from '../util/testHelper.js'

describe('drawTile', () => {
    it('updates state correctly', () => {
        const state = generateTestState()
        const tileBag = HydratedTileBag.generate(1, 0, 0, 0, 0, getPrng())
        expect(state.tileBag.isEmpty()).toBe(false)
        state.tileBag = tileBag
        const action = new HydratedDrawTile({
            type: ActionType.DrawTile,
            source: ActionSource.User,
            index: 0,
            id: uuid(),
            gameId: uuid(),
            playerId: uuid(),
            revealsInfo: true
        })
        action.apply(state)
        expect(state.tileBag.isEmpty()).toBe(true)
        expect(state.chosenTile).toStrictEqual(generateMarketTile())
    })

    it('should fail if empty', () => {
        const state = generateTestState()
        const tileBag = HydratedTileBag.generate(1, 1, 0, 0, 0, getPrng())
        state.tileBag = tileBag
        const action = new HydratedDrawTile({
            type: ActionType.DrawTile,
            source: ActionSource.User,
            index: 0,
            id: uuid(),
            gameId: uuid(),
            playerId: uuid(),
            revealsInfo: true
        })

        action.apply(state)
        action.apply(state)

        expect(() => {
            action.apply(state)
        }).toThrow()
    })
})
