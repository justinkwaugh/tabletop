import { assertExists } from '@tabletop/common'
import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { Phases1850 } from './trains.js'

export const GreatRiverPrivateId = 'GRSC'
export const CreditMobilierPrivateId = 'CM'
export const BridgePrivateId = 'MRBC'
export const GantPrivateId = 'GBCC'
export const MesabiPrivateId = 'MMC'
export const LandGrantPrivateId = 'WLGC'
export const RockIslandPrivateId = 'MMR'
/** St. Louis, the one hex the Bridge Company reserves and lays (§15.1). */
export const BridgeLocationId = 'L13'

// The seven private companies, offered in this order (§3.1, §15.2).
export const PrivateCatalog1850 = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: GreatRiverPrivateId,
                name: 'Great River Shipping Company',
                faceValue: 20,
                revenue: 5,
                description: 'No special abilities. Closes with the first 5-train.'
            },
            {
                id: CreditMobilierPrivateId,
                name: 'Crédit Mobilier',
                faceValue: 40,
                revenue: 10,
                description:
                    'The Union Pacific may pay up to triple its price. Owned by a company, its income goes to that company’s president, and the company may once lay an extra yellow tile west of the Mississippi. Survives the first 5-train without income if the lay is unused; closes with the first 6-train.'
            },
            {
                id: BridgePrivateId,
                name: 'Mississippi River Bridge Company',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: [BridgeLocationId], until: 'company-owned' },
                description: `No track in ${place(BridgeLocationId)} while a player owns it. Its owning company may once lay a yellow tile there free, besides and before its ordinary lay, and may not upgrade that tile the same turn. Companies may buy it before the first 3-train for up to face value. Closes with the first 5-train.`
            },
            {
                id: GantPrivateId,
                name: 'Gant Brothers Construction Company',
                faceValue: 50,
                revenue: 10,
                description:
                    'Its owning company may buy an extra yellow lay each turn for $30, plus any terrain, after its ordinary lay. Survives the first 5-train without income; closes with the first 6-train.'
            },
            {
                id: MesabiPrivateId,
                name: 'Mesabi Mining Company',
                faceValue: 80,
                revenue: 15,
                description: `Comes with a token for ${place('A10')}, which its owning company keeps. No one may buy a token until a company owns this private or it closes; while a company owns it, that company receives half of each $80. Companies may buy it before the first 3-train for up to face value. Closes with the first 5-train.`
            },
            {
                id: LandGrantPrivateId,
                name: 'Western Land Grant Company',
                faceValue: 90,
                revenue: 20,
                description:
                    'Its owning company may lay one extra yellow tile a turn, three in all, after its ordinary lay: one anywhere and two west of the Mississippi. Survives the first 5-train without income if a lay is unused; closes with the first 6-train.'
            },
            {
                id: RockIslandPrivateId,
                name: 'Mississippi and Missouri Railroad',
                faceValue: 160,
                revenue: 20,
                blocks: { locationIds: ['I12'], until: 'company-owned' },
                description: `Comes with a share of the Chicago, Rock Island & Pacific Railway. No track in ${place('I12')} while a player owns it. Closes with the first 5-train.`
            }
        ]
    },
    Phases1850
)
export const Privates1850 = PrivateCatalog1850.privates

export function privateDescription(privateCompanyId: string): string {
    const { description } = PrivateCatalog1850.definition(privateCompanyId)
    assertExists(description, 'Every 1850 private has a description')
    return description
}
