import type { SiteDataRecord } from './sites.js'

export default [
    {
        id: 'site.ancient-city',
        name: 'Ancient City',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'order'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'order',
            reward: 'warbands',
            amount: 2
        },
        powerText: '[suit:order] → [warband][warband]'
    },
    {
        id: 'site.barren-coast',
        name: 'Barren Coast',
        cardNumber: null,
        capacity: 1,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'nomad'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'coast',
        homeland: null,
        powerText: '[travel] → [coastSite]: [supply]1'
    },
    {
        id: 'site.buried-giant',
        name: 'Buried Giant',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 1
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'buriedGiant',
        homeland: null,
        powerText: '[travel]: [flipSecretFacedown] → [supply]0'
    },
    {
        id: 'site.charming-valley',
        name: 'Charming Valley',
        cardNumber: null,
        capacity: 3,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'charmingValley',
        homeland: null,
        powerText: '[travel]: [supply]+1'
    },
    {
        id: 'site.deep-woods',
        name: 'Deep Woods',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 2
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'beast',
            reward: 'relic',
            amount: 1
        },
        powerText: '[suit:beast] → [relic]'
    },
    {
        id: 'site.drowned-city',
        name: 'Drowned City',
        cardNumber: null,
        capacity: 0,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnFavor',
            amount: 2
        },
        revealPrompt: {
            favor: 0,
            secrets: 3,
            relics: 2
        },
        powerCategory: 'opportunity',
        homeland: null,
        powerText: '[takeFromSite][secret]'
    },
    {
        id: 'site.fertile-valley',
        name: 'Fertile Valley',
        cardNumber: null,
        capacity: 3,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'hearth',
            reward: 'favor',
            amount: 1
        },
        powerText: '[suit:hearth] → [favor]'
    },
    {
        id: 'site.great-slums',
        name: 'Great Slum',
        cardNumber: null,
        capacity: 3,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'greatSlum',
        homeland: null,
        powerText: '[card] → [discard] / [playOrMoveHere]'
    },
    {
        id: 'site.lush-coast',
        name: 'Lush Coast',
        cardNumber: null,
        capacity: 3,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'coast',
        homeland: null,
        powerText: '[travel] → [coastSite]: [supply]1'
    },
    {
        id: 'site.marshes',
        name: 'Marshes',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 1
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'marshes',
        homeland: null,
        powerText: '[search]: [card]-1'
    },
    {
        id: 'site.mine',
        name: 'Mine',
        cardNumber: null,
        capacity: 1,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'discord'
        },
        revealPrompt: {
            favor: 3,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'opportunity',
        homeland: null,
        powerText: '[takeFromSite][favor]'
    },
    {
        id: 'site.mountain',
        name: 'Mountain',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnFavor',
            amount: 2
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'mountain',
        homeland: null,
        powerText: '−[attackDie]'
    },
    {
        id: 'site.narrow-pass',
        name: 'Narrow Pass',
        cardNumber: null,
        capacity: 1,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'arcane'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'narrowPass',
        homeland: null,
        powerText: '[travel] / [campaign] → [here]'
    },
    {
        id: 'site.plains',
        name: 'Plains',
        cardNumber: null,
        capacity: 3,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'plains',
        homeland: null,
        powerText: '+[attackDie]'
    },
    {
        id: 'site.river',
        name: 'River',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'river',
        homeland: null,
        powerText: '[rule]: [muster]+1'
    },
    {
        id: 'site.rocky-coast',
        name: 'Rocky Coast',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 0
        },
        powerCategory: 'coast',
        homeland: null,
        powerText: '[travel] → [coastSite]: [supply]1'
    },
    {
        id: 'site.salt-flats',
        name: 'Salt Flats',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: null,
        revealPrompt: {
            favor: 2,
            secrets: 1,
            relics: 0
        },
        powerCategory: 'opportunity',
        homeland: null,
        powerText: '[takeFromSite][favor] / [secret]'
    },
    {
        id: 'site.shrouded-wood',
        name: 'Shrouded Wood',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 1
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'shroudedWood',
        homeland: null,
        powerText: '[travel] → ?: [supply]2'
    },
    {
        id: 'site.standing-stones',
        name: 'Standing Stones',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'arcane'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'arcane',
            reward: 'secret',
            amount: 1
        },
        powerText: '[suit:arcane] → [secret]'
    },
    {
        id: 'site.steppe',
        name: 'Steppe',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'nomad'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'nomad',
            reward: 'secret',
            amount: 1
        },
        powerText: '[suit:nomad] → [secret]'
    },
    {
        id: 'site.the-hidden-place',
        name: 'The Hidden Place',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 1
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'hiddenPlace',
        homeland: null,
        powerText: '[travel] / [campaign] → [here]: [flipSecretFacedown]'
    },
    {
        id: 'site.the-tribunal',
        name: 'The Tribunal',
        cardNumber: null,
        capacity: 2,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'placeFavorInBank',
            amount: 3,
            suit: 'order'
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'tribunal',
        homeland: null,
        powerText: '[negotiate]'
    },
    {
        id: 'site.wastes',
        name: 'Wastes',
        cardNumber: null,
        capacity: 1,
        defenseDice: 1,
        bandits: 1,
        recoverCost: {
            kind: 'burnSecrets',
            amount: 2
        },
        revealPrompt: {
            favor: 0,
            secrets: 0,
            relics: 1
        },
        powerCategory: 'homeland',
        homeland: {
            suit: 'discord',
            reward: 'relic',
            amount: 1
        },
        powerText: '[suit:discord] → [relic]'
    }
] satisfies readonly SiteDataRecord[]
