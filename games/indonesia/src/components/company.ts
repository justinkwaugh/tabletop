import * as Type from 'typebox'
import { Good } from '../definition/goods.js'
import { Deed } from './deed.js'
import { CompanyType } from '../definition/companyType.js'

export type Company = Type.Static<typeof Company>
export const Company = Type.Object({
    type: Type.Enum(CompanyType),
    deeds: Type.Array(Deed),
    owner: Type.String()
})

export type ProductionCompany = Type.Static<typeof ProductionCompany>
export const ProductionCompany = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Company, ['type']),
        Type.Object({
            type: Type.Literal(CompanyType.Production),
            good: Type.Enum(Good)
        })
    ])
)

export type ShippingCompany = Type.Static<typeof ShippingCompany>
export const ShippingCompany = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Company, ['type']),
        Type.Object({
            type: Type.Literal(CompanyType.Shipping)
        })
    ])
)
