import { companyNameVariants } from '@tabletop/18xx-ui'
import { ConcessionIds1822, Majors1822, Minors1822, Names1822, Privates1822 } from '@tabletop/1822'

// Initials as the charters and certificates print them (Tables 3, 4 and 6). A minor company is
// known by its number, and a private company by its number too, as players call them.
export const CompanyNames1822 = companyNameVariants(Names1822, {
    ...Object.fromEntries(
        Majors1822.map((major) => [major.id, { initials: major.initials, short: major.initials }])
    ),
    ...Object.fromEntries(
        Minors1822.map((minor) => [
            minor.id,
            { initials: minor.id, short: `${minor.id} ${minor.initials}` }
        ])
    ),
    ...Object.fromEntries(
        Privates1822.map((company) => [
            company.id,
            { initials: company.id, short: `${company.id} ${company.power}` }
        ])
    ),
    ...Object.fromEntries(
        ConcessionIds1822.map((id) => [
            id,
            { initials: id.replace('C-', 'C:'), short: `${id.slice(2)} concession` }
        ])
    )
})

/** The charter colours (Table 6). */
export const CompanyColors1822: Readonly<Record<string, string>> = Object.fromEntries(
    Majors1822.map((major) => [major.id, major.color])
)

/** The pale disc every minor company's numbered token is printed on. */
export const MinorColor1822 = '#f3ead6'
