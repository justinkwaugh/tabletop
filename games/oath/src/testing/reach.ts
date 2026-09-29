import { Color } from '@tabletop/common'
import { cardDefinition } from '../data/cardRegistry.js'
import { MachineState } from '../definition/states.js'
import { openTurn, testPlayer, testState } from './fixture.js'
import { adviser } from './tables.js'

/** R-7.1.1 — the ways a card comes into a player's reach. */
export type ReachRoute = 'adviser' | 'own-site' | 'ruled-elsewhere' | 'relic'

/** 'me' at c1 holds the card by `route`; the fixture pays any printed cost, so a miss is one of reach. */
export function reachTable(
    cardId: string,
    route: ReachRoute | 'foreign',
    machineState = MachineState.ActPhase,
    ruleOwnSite = false
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 6,
                supply: 6,
                warbandsOnBoard: { [Color.Red]: 3 },
                warbandsInPersonalBank: { [Color.Red]: 6 },
                advisers: route === 'adviser' ? [adviser(cardId)] : [],
                relicIds: route === 'relic' ? [cardId] : []
            }),
            testPlayer({
                playerId: 'foe',
                color: Color.Blue,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 4,
                warbandsOnBoard: { [Color.Blue]: 2 }
            })
        ],
        {
            machineState,
            denizensBySite: {
                c1: route === 'own-site' ? [cardId] : [],
                c2: route === 'ruled-elsewhere' ? [cardId] : [],
                p1: route === 'foreign' ? [cardId] : [],
                h1: []
            },
            // R-7.5.1, R-7.1.4 — a battle plan or a site's persistent power needs rule, not access.
            warbandsBySite: {
                ...(ruleOwnSite ? { c1: { [Color.Red]: 1 } } : {}),
                c2: { [Color.Red]: 2 },
                p1: { [Color.Blue]: 3 }
            },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, 'me')
    return s
}

/** R-7.1.1 — the routes a card can come by: its placement decides. */
export function routesFor(cardId: string): ReachRoute[] {
    if (cardId.startsWith('relic.')) return ['relic']
    const placement = cardDefinition(cardId)?.placement
    if (placement === 'adviser') return ['adviser']
    if (placement === 'site') return ['own-site', 'ruled-elsewhere']
    return ['adviser', 'own-site', 'ruled-elsewhere']
}

export function listed(cardId: string, powers: readonly { cardId: string }[]): boolean {
    return powers.some((power) => power.cardId === cardId)
}
