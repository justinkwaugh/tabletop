import type { GuildId } from './components.js'
import type { ProvisionalEntry } from './provisional.js'

/** R-4.6.2 */
export type CharityId = 'guild.farmer.purse' | 'guild.monk.coffer'

const Charity = {
    farmer: 'guild.monk.coffer',
    merchant: 'guild.monk.coffer',
    alchemist: 'guild.monk.coffer',
    knight: 'guild.farmer.purse',
    noble: 'guild.farmer.purse',
    monk: 'guild.farmer.purse'
} as const satisfies Record<GuildId, CharityId>

/** R-1.4-H3, R-4.6-H3 */
export const ProvisionalGuilds = {
    rosaryCapacity: {
        componentId: 'guild.monk.rosary',
        value: "the rosary's capacity",
        placeholder: 'unlimited',
        settledBy: 'the printed board or a designer ruling',
        ruling: 'R-1.4-H3',
        dataBlockedIn: ['guildData.spec.ts']
    },
    chickenSpaces: {
        componentId: 'guild.farmer.chicken.*',
        value: 'the chicken spaces, and which takes the setup bead',
        placeholder: { spaces: 4, setupBeadSpace: 'guild.farmer.chicken.1' },
        settledBy: 'the printed board or a designer ruling',
        ruling: 'R-1.4-H3',
        dataBlockedIn: ['guildData.spec.ts', 'initializer.spec.ts']
    },
    charity: {
        componentId: 'guild.*',
        value: "which charity receives each guild's apprentice share",
        placeholder: Charity,
        settledBy: "the designer's ruling",
        ruling: 'R-4.6-H3',
        dataBlockedIn: ['guildData.spec.ts']
    }
} as const satisfies Record<string, ProvisionalEntry>
