import * as Type from 'typebox'

import { Era } from '../definition/eras.js'
import { Good } from '../definition/goods.js'
import { CompanyType } from '../definition/companyType.js'

export type Deed = Type.Static<typeof Deed>
export const Deed = Type.Object({
    id: Type.String(),
    type: Type.Enum(CompanyType),
    era: Type.Enum(Era),
    region: Type.String()
})

export type ProductionDeed = Type.Static<typeof ProductionDeed>
export const ProductionDeed = Type.Evaluate(
    Type.Intersect([
        Deed,
        Type.Object({
            type: Type.Literal(CompanyType.Production),
            good: Type.Enum(Good)
        })
    ])
)

const ShippingSizes = Type.Partial(
    Type.Object({
        [Era.A]: Type.Number(),
        [Era.B]: Type.Number(),
        [Era.C]: Type.Number()
    })
)

export type ShippingDeed = Type.Static<typeof ShippingDeed>
export const ShippingDeed = Type.Evaluate(
    Type.Intersect([
        Deed,
        Type.Object({
            type: Type.Literal(CompanyType.Shipping),
            sizes: ShippingSizes
        })
    ])
)

export type AnyDeed = Type.Static<typeof AnyDeed>
export const AnyDeed = Type.Union([ProductionDeed, ShippingDeed])

export const Deeds: AnyDeed[] = [
    { id: 'D01', type: CompanyType.Production, era: Era.A, region: 'R26', good: Good.Spice },
    { id: 'D02', type: CompanyType.Production, era: Era.A, region: 'R24', good: Good.Spice },
    { id: 'D03', type: CompanyType.Production, era: Era.A, region: 'R18', good: Good.Rice },
    { id: 'D04', type: CompanyType.Production, era: Era.A, region: 'R21', good: Good.Rice },
    {
        id: 'D05',
        type: CompanyType.Shipping,
        era: Era.A,
        region: 'R20',
        sizes: { [Era.A]: 2, [Era.B]: 3, [Era.C]: 3 }
    },
    {
        id: 'D06',
        type: CompanyType.Shipping,
        era: Era.A,
        region: 'R08',
        sizes: { [Era.A]: 2, [Era.B]: 3, [Era.C]: 4 }
    },
    {
        id: 'D07',
        type: CompanyType.Shipping,
        era: Era.A,
        region: 'R14',
        sizes: { [Era.A]: 3, [Era.B]: 3, [Era.C]: 4 }
    },
    {
        id: 'D08',
        type: CompanyType.Shipping,
        era: Era.A,
        region: 'R26',
        sizes: { [Era.A]: 3, [Era.B]: 4, [Era.C]: 5 }
    },
    { id: 'D09', type: CompanyType.Production, era: Era.B, region: 'R01', good: Good.Rice },
    { id: 'D10', type: CompanyType.Production, era: Era.B, region: 'R11', good: Good.Rice },
    { id: 'D11', type: CompanyType.Production, era: Era.B, region: 'R04', good: Good.Rubber },
    { id: 'D12', type: CompanyType.Production, era: Era.B, region: 'R03', good: Good.Rubber },
    { id: 'D13', type: CompanyType.Production, era: Era.B, region: 'R10', good: Good.Rubber },
    { id: 'D14', type: CompanyType.Production, era: Era.B, region: 'R16', good: Good.Spice },
    { id: 'D15', type: CompanyType.Production, era: Era.B, region: 'R19', good: Good.Spice },
    {
        id: 'D16',
        type: CompanyType.Shipping,
        era: Era.B,
        region: 'R02',
        sizes: { [Era.B]: 4, [Era.C]: 5 }
    },
    {
        id: 'D17',
        type: CompanyType.Shipping,
        era: Era.B,
        region: 'R18',
        sizes: { [Era.B]: 4, [Era.C]: 5 }
    },
    { id: 'D18', type: CompanyType.Production, era: Era.C, region: 'R15', good: Good.Rice },
    { id: 'D19', type: CompanyType.Production, era: Era.C, region: 'R07', good: Good.Spice },
    { id: 'D20', type: CompanyType.Production, era: Era.C, region: 'R27', good: Good.Rubber },
    { id: 'D21', type: CompanyType.Production, era: Era.C, region: 'R13', good: Good.Oil },
    { id: 'D22', type: CompanyType.Production, era: Era.C, region: 'R09', good: Good.Oil },
    { id: 'D23', type: CompanyType.Production, era: Era.C, region: 'R24', good: Good.Oil },
    { id: 'D24', type: CompanyType.Production, era: Era.C, region: 'R27', good: Good.Oil }
]
