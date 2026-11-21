import { companyNameVariants, type CompanyNaming } from '@tabletop/18xx-ui'
import {
    EighteenUSACorporations,
    EighteenUSANames,
    EighteenUSAPrivateCatalog,
    SubsidyPrivateIds,
    isSubsidyPrivate
} from '@tabletop/18usa'

const SubsidyNames: Readonly<Record<string, CompanyNaming>> = {
    [SubsidyPrivateIds.boomtown]: { initials: 'Boom', short: 'Boomtown' },
    [SubsidyPrivateIds.freeStation]: { initials: 'Stn', short: 'Free Station' },
    [SubsidyPrivateIds.resource]: { initials: 'Res', short: 'Resource' }
}

// The privates are known by their printed numbers, P1 to P30.
export const EighteenUSACompanyNames = companyNameVariants(
    EighteenUSANames,
    Object.fromEntries([
        ...EighteenUSACorporations.map((company): [string, CompanyNaming] => [
            company.id,
            { initials: company.abbreviation }
        ]),
        ...EighteenUSAPrivateCatalog.privates.map((company): [string, CompanyNaming] => [
            company.id,
            isSubsidyPrivate(company.id) ? SubsidyNames[company.id] : { initials: company.id }
        ])
    ])
)
