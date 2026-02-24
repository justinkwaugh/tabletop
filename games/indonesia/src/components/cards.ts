import * as Type from 'typebox'

import { Era } from '../definition/eras.js'

export type CityCard = Type.Static<typeof CityCard>
export const CityCard = Type.Object({
    id: Type.String(),
    era: Type.Enum(Era),
    regions: Type.Array(Type.String())
})

export const CityCards: CityCard[] = [
    { id: 'A01', era: Era.A, regions: ['R07', 'R18', 'R19'] },
    { id: 'A02', era: Era.A, regions: ['R07', 'R20', 'R14'] },
    { id: 'A03', era: Era.A, regions: ['R19', 'R21', 'R17'] },
    { id: 'A04', era: Era.A, regions: ['R18', 'R14', 'R17'] },
    { id: 'A05', era: Era.A, regions: ['R18', 'R20', 'R21'] },
    { id: 'B01', era: Era.B, regions: ['R02', 'R13', 'R24'] },
    { id: 'B02', era: Era.B, regions: ['R03', 'R08', 'R13'] },
    { id: 'B03', era: Era.B, regions: ['R01', 'R02', 'R06'] },
    { id: 'B04', era: Era.B, regions: ['R03', 'R06', 'R18'] },
    { id: 'B05', era: Era.B, regions: ['R01', 'R08', 'R24'] },
    { id: 'C01', era: Era.C, regions: ['R09', 'R16', 'R27'] },
    { id: 'C02', era: Era.C, regions: ['R18', 'R23', 'R26'] },
    { id: 'C03', era: Era.C, regions: ['R05', 'R16', 'R23'] },
    { id: 'C04', era: Era.C, regions: ['R22', 'R26', 'R27'] },
    { id: 'C05', era: Era.C, regions: ['R05', 'R09', 'R22'] }
]
