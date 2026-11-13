import { PrivateCatalog, placeReference as place } from '@tabletop/18xx'
import { AcirealeLocationId } from './map.js'
import { EarthquakePhaseId, Phases1849 } from './trains.js'

export const CorriereEtneePrivateId = 'SCE'
export const IngegneriaPrivateId = 'SIGI'
export const NavalePrivateId = 'CNM'
export const MarittimaPrivateId = 'SMS'
export const RealeSocietaPrivateId = 'RSA'

/** From phase 6 to phase 10 a corporation may buy a private from a player for L. 1 to twice its value (§7.1). */
const toCorporations = (faceValue: number) => ({ minimum: 1, maximum: faceValue * 2 })

// The five private companies, offered P1 to P5 (§7.1, §8). All close at the first 12H (§6).
export const PrivateCatalog1849 = new PrivateCatalog(
    {
        closurePhaseId: EarthquakePhaseId,
        privates: [
            {
                id: CorriereEtneePrivateId,
                name: 'Società Corriere Etnee',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: [AcirealeLocationId], until: 'company-owned' },
                sale: toCorporations(20),
                description: `No track in ${place(AcirealeLocationId)} until a corporation owns it or it closes.`
            },
            {
                id: IngegneriaPrivateId,
                name: 'Studio di Ingegneria Giuseppe Incorpora',
                faceValue: 45,
                revenue: 10,
                sale: toCorporations(45),
                description:
                    'Its owning corporation lays or upgrades standard gauge track on rough, hill and mountain hexes at half cost. Narrow gauge track costs as usual.'
            },
            {
                id: NavalePrivateId,
                name: 'Compagnia Navale Mediterranea',
                faceValue: 75,
                revenue: 15,
                sale: toCorporations(75),
                description:
                    'In its operating turn the owning corporation may close it to put the +L. 20 token on any port, adding L. 20 to that port’s value for the corporation for the rest of the game.'
            },
            {
                id: MarittimaPrivateId,
                name: 'Società Marittima Siciliana',
                faceValue: 110,
                revenue: 20,
                sale: toCorporations(110),
                description:
                    'In its operating turn the owning corporation may close it instead of its tile and token steps, to lay or upgrade a tile and place a station token in any coastal city (all but Caltanissetta and Ragusa), even one it cannot trace a route to.'
            },
            {
                id: RealeSocietaPrivateId,
                name: 'Reale Società d’Affari',
                faceValue: 150,
                revenue: 25,
                sale: 'never',
                description:
                    'Comes with the president’s certificate of the first corporation in order. Never sold to a corporation. Closes when that corporation buys its first train.'
            }
        ]
    },
    Phases1849
)
export const Privates1849 = PrivateCatalog1849.privates
