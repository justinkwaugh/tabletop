import { describe, expect, it } from 'vitest'
import { trainUpgrades } from './trainRules.js'
import { TrainColorOrder } from './trains.js'

describe('train upgrades (§7.3.7.2)', () => {
    it("lists each train's upgrade costs as the train table prints them (§13.2)", () => {
        const table = Object.fromEntries(
            TrainColorOrder.map((id) => [
                id,
                trainUpgrades(id).map(({ definitionId, price }) => `${definitionId}:${price}`)
            ])
        )
        expect(table).toEqual({
            '2': ['3:80'],
            '3': ['4:240'],
            '4': ['5+1:250'],
            '5+1': ['6:400', 'D:600'],
            '6': ['7:400', 'D:500'],
            '7': ['D:450'],
            D: []
        })
    })
})
