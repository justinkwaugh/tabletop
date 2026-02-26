import * as Type from 'typebox'
import { Good } from '../definition/goods.js'
import { AnyDeed } from './deed.js'
import { CompanyType } from '../definition/companyType.js'

export type BaseCompany = Type.Static<typeof BaseCompany>
export const BaseCompany = Type.Object({
    id: Type.String(),
    type: Type.Enum(CompanyType),
    deeds: Type.Array(AnyDeed),
    owner: Type.String()
})

export type ProductionCompany = Type.Static<typeof ProductionCompany>
export const ProductionCompany = Type.Object({
    ...BaseCompany.properties,
    type: Type.Literal(CompanyType.Production),
    good: Type.Enum(Good)
})

export function isProductionCompany(company: Company | undefined): company is ProductionCompany {
    if (!company) {
        return false
    }
    return company.type === CompanyType.Production
}

export type ShippingCompany = Type.Static<typeof ShippingCompany>
export const ShippingCompany = Type.Object({
    ...BaseCompany.properties,
    type: Type.Literal(CompanyType.Shipping)
})

export function isShippingCompany(company: Company | undefined): company is ShippingCompany {
    if (!company) {
        return false
    }
    return company.type === CompanyType.Shipping
}

export type Company = Type.Static<typeof Company>
export const Company = Type.Union([ProductionCompany, ShippingCompany])
