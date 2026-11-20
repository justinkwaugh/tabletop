import { titleNames } from '@tabletop/18xx'
import { ForeignInvestors1880, Majors1880, Privates1880 } from './companies.js'

/** The bank's shares on sale: there is no bank pool, sold shares return here (§XII). */
export const BankPoolId1880 = 'bank'
/** Each major's second five shares, on sale from the first 3-train (§XI, §XII). */
export const ReservePoolId1880 = 'reserve'
/** Route bonuses and charges (§X Calculating Income). */
export const TransSiberianBonusId = 'trans-siberian'
export const FerryChargeId = 'ferry'
export const TaiwanBonusId = 'taiwan'

const PoolNames: Readonly<Record<string, string>> = {
    [BankPoolId1880]: 'Bank',
    [ReservePoolId1880]: 'Reserved'
}

export const Names1880 = titleNames(
    Object.fromEntries([
        ...Majors1880.map((company) => [company.id, company.name]),
        ...Privates1880.map((company) => [company.id, company.name]),
        ...ForeignInvestors1880.map((investor) => [investor.id, investor.name])
    ]),
    (poolId) => PoolNames[poolId],
    {
        [TransSiberianBonusId]: 'Trans-Siberian',
        [FerryChargeId]: 'Ferry',
        [TaiwanBonusId]: 'Taiwan Western Line'
    }
)
