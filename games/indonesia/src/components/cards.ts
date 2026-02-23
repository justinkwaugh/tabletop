import * as Type from 'typebox'

import { Era } from '../definition/eras.js'

export type CityCard = Type.Static<typeof CityCard>
export const CityCard = Type.Object({
    era: Type.Enum(Era),
    regions: Type.Array(Type.String())
})

export const CityCards: CityCard[] = [
    { era: Era.A, regions: ['R07', 'R18', 'R19'] },
    { era: Era.A, regions: ['R07', 'R20', 'R14'] },
    { era: Era.A, regions: ['R19', 'R21', 'R17'] },
    { era: Era.A, regions: ['R18', 'R14', 'R17'] },
    { era: Era.A, regions: ['R18', 'R20', 'R21'] },
    { era: Era.B, regions: ['R02', 'R13', 'R24'] },
    { era: Era.B, regions: ['R03', 'R08', 'R13'] },
    { era: Era.B, regions: ['R01', 'R02', 'R06'] },
    { era: Era.B, regions: ['R03', 'R06', 'R18'] },
    { era: Era.B, regions: ['R01', 'R08', 'R24'] },
    { era: Era.C, regions: ['R09', 'R16', 'R27'] },
    { era: Era.C, regions: ['R18', 'R23', 'R26'] },
    { era: Era.C, regions: ['R05', 'R16', 'R23'] },
    { era: Era.C, regions: ['R22', 'R26', 'R27'] },
    { era: Era.C, regions: ['R05', 'R09', 'R22'] }
]
