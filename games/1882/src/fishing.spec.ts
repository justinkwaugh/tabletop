import { describe, expect, it } from 'vitest'
import { TrainRules1882 } from './trains.js'
import { fishingOnly } from '../test/kit.js'

describe('1882 fishing exit', () => {
    it('lets the president count a route to the fishing exit and fund a train, or not (§11.5, §11.8)', () => {
        const game = fishingOnly()
        expect(TrainRules1882.requiresTrain(game.hydrated, 'CNoR')).toBe(false)
        expect(TrainRules1882.mayRequireTrain?.(game.hydrated, 'CNoR')).toBe(true)
        game.act('FinishTrack', { companyId: 'CNoR' })
        while (game.state.machineState !== 'BuyingTrains')
            game.act(
                game.valid().includes('FinishStations') ? 'FinishStations' : 'FinishOperatingTurn',
                {
                    companyId: 'CNoR'
                }
            )
        const valid = game.valid()
        expect(valid).toContain('FundTrain')
        expect(valid).toContain('FinishOperatingTurn')
    })
})
