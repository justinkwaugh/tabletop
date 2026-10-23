import { PrivateCatalog } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'

export const TheOldPrincePrivateCatalog = new PrivateCatalog(
    {
        closurePhaseId: '4+',
        privates: [
            { id: 'MC', name: 'Merchants and Co.', faceValue: 40, revenue: 5, sale: 'never' },
            { id: 'VR', name: 'Vernon River Bridge', faceValue: 40, revenue: 5, sale: 'never' },
            {
                id: 'IB',
                name: 'Ice Boats',
                faceValue: 40,
                revenue: 5,
                sale: 'never',
                description:
                    'Exchange during your stock turn for a Bank share in a started railway other than the Mainline or Shortline.\n\nCloses unused at 4+.'
            },
            {
                id: 'RA',
                name: 'Royal Agricultural Society',
                faceValue: 110,
                revenue: 10,
                sale: 'never'
            },
            { id: 'RF', name: 'Railcar Ferry', faceValue: 120, revenue: 15, sale: 'never' },
            { id: 'SB', name: 'Shipbuilding', faceValue: 90, revenue: 15, sale: 'never' },
            {
                id: 'HS',
                name: 'Hunslet Steam Engine',
                faceValue: 110,
                revenue: 20,
                sale: { minimum: 1, maximum: 200 },
                description:
                    'From 4H, may be sold to a railway other than PEIR for $1–200. Its railway may close it to buy one depot train during its turn, paying the normal price.\n\nCloses unused at 4+.'
            },
            { id: 'MLC', name: 'Mainline Concession', faceValue: 160, revenue: 20, sale: 'never' },
            {
                id: 'SBC',
                name: 'Schreiber and Burpee Construction',
                faceValue: 100,
                revenue: 30,
                sale: 'never',
                description:
                    'The owning player’s railways may lay the single straight yellow tile using ordinary track rules and costs.\n\nCloses at 4+; the unused tile is removed.'
            },
            { id: 'SLC', name: 'Shortline Concession', faceValue: 160, revenue: 30, sale: 'never' },
            {
                id: 'UB',
                name: 'Union Bank',
                faceValue: 120,
                revenue: 0,
                closure: 'never',
                sale: 'never',
                description:
                    'Holds its own cash and shares for its owner. Dividends on its shares go to Union Bank.\n\n' +
                    'Once per stock round, its owner may buy a share or start a company for Union Bank instead of themselves. Union Bank pays first; its owner may cover any shortfall.\n\n' +
                    'May hold presidencies; its owner makes those companies’ decisions. Never sells shares voluntarily.\n\n' +
                    'When one of its companies must buy a train, Union Bank pays before its owner, selling shares if required.\n\n' +
                    'Never closes. Its cash and share value count toward its owner’s final wealth.'
            },
            {
                id: 'KM',
                name: 'The King’s Mail',
                faceValue: 0,
                revenue: 80,
                sale: 'never',
                description: 'Pays PEIR each operating round.\n\nCloses at 4+ or when PEIR closes.'
            }
        ]
    },
    TheOldPrincePhases
)
export const TheOldPrincePrivates = TheOldPrincePrivateCatalog.privates
export const TheOldPrinceKingsMail = TheOldPrincePrivateCatalog.definition('KM')
