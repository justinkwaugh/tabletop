import { PrivateCatalog } from '@tabletop/18xx'
import { Shikoku1889Phases } from './trains.js'

export const Shikoku1889PrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: 'TE',
                name: 'Takamatsu Electric Track',
                faceValue: 20,
                revenue: 5,
                blocks: { locationIds: ['K4'], until: 'company-owned' },
                description: 'Closes at phase 5.'
            },
            {
                id: 'MF',
                name: 'Mitsubishi Ferry',
                faceValue: 30,
                revenue: 5,
                description:
                    'Player owner may place the port once on an eligible coastal town, outside a rival railway’s operation. Stays open after use; closes at phase 5.'
            },
            {
                id: 'ER',
                name: 'Ehime Railroad',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: ['C4'], until: 'company-owned' },
                description:
                    'Blocks Ohzu while player-owned. On sale to a railway, the seller may immediately upgrade Ohzu in addition to ordinary construction. Closes at phase 5.'
            },
            {
                id: 'SRR',
                name: 'Sumitomo Besshi Mine Railroad',
                faceValue: 50,
                revenue: 15,
                description:
                    'The owning railway ignores mountain-only terrain costs. Combined river and mountain costs still apply. Closes at phase 5.'
            },
            {
                id: 'DR',
                name: 'Dôgo Railway',
                faceValue: 60,
                revenue: 15,
                description:
                    'The owning player may exchange for a 10% Iyo IPO share, including during another player’s turn. Does not consume a purchase or change passes. Closes at phase 5.'
            },
            {
                id: 'PR',
                name: 'Pilgrimage Railway',
                faceValue: 80,
                revenue: 20,
                description: 'Closes at phase 5.'
            },
            {
                id: 'UTF',
                name: 'Uno-Takamatsu Ferry',
                faceValue: 150,
                revenue: 30,
                closure: { survivesWhilePlayerOwned: { revenue: 50 } }
            }
        ]
    },
    Shikoku1889Phases
)
export const Shikoku1889Privates = Shikoku1889PrivateCatalog.privates
