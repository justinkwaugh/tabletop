import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, Variety, type FieldHarvest, type Harvest } from '@tabletop/dicke-kartoffeln'
import { describeSystemAction } from './describe.js'

function field(fieldId: number, variety: Variety, organic: boolean, sacks: number): FieldHarvest {
    return {
        fieldId,
        variety,
        fertilized: !organic,
        organic,
        worms: 3,
        chart: sacks,
        adjustment: 0,
        sacks
    }
}

function harvest(fields: FieldHarvest[]): Harvest {
    return {
        id: 'harvest',
        gameId: 'game',
        source: ActionSource.System,
        type: ActionType.Harvest,
        metadata: { farms: [{ playerId: 'p1', fields }] }
    }
}

describe('the harvest description', () => {
    it('breaks the sacks down by potato and quality', () => {
        const action = harvest([
            field(1, Variety.Chris, false, 2),
            field(2, Variety.Amalie, true, 3),
            field(3, Variety.Amalie, true, 1),
            field(4, Variety.Biola, false, 0)
        ])
        expect(describeSystemAction(action)).toEqual([
            [{ playerId: 'p1' }, 'harvested 6 sacks: 4 Amalie-Bio, 2 Chris-Norm']
        ])
    })

    it('leaves the breakdown off an empty harvest', () => {
        const action = harvest([field(1, Variety.Biola, false, 0)])
        expect(describeSystemAction(action)).toEqual([[{ playerId: 'p1' }, 'harvested 0 sacks']])
    })
})
