import { MarketId } from './potatoes.js'

// The twenty "Nachrichtenkarten". Where the English translation sheet disagrees with the German
// cards, the German cards govern (the fungus card cuts Amalie-Bio by 3, not 1).
export enum MessageId {
    FatteningPotatoes = 'FatteningPotatoes',
    EcoSurvey = 'EcoSurvey',
    ReactorAccident = 'ReactorAccident',
    EcoSurveyAndBlight = 'EcoSurveyAndBlight',
    RainySummer = 'RainySummer',
    PotatoBlight = 'PotatoBlight',
    SubsidiesAndBeetles = 'SubsidiesAndBeetles',
    SubsidiesAndGoodWeather = 'SubsidiesAndGoodWeather',
    PotatoBeetles = 'PotatoBeetles',
    AgricultureContest = 'AgricultureContest',
    Drought = 'Drought',
    SubsidiesAndRain = 'SubsidiesAndRain',
    EnvironmentContest = 'EnvironmentContest',
    QuietYear = 'QuietYear',
    Subsidies = 'Subsidies',
    UneventfulYear = 'UneventfulYear',
    PotatoVirus = 'PotatoVirus',
    TradeAgreement = 'TradeAgreement',
    GoodWeather = 'GoodWeather',
    EcoSurveyAndDrySummer = 'EcoSurveyAndDrySummer'
}

export const MESSAGE_IDS = Object.values(MessageId)

export enum YieldScope {
    Unsprayed = 'Unsprayed',
    Unfertilized = 'Unfertilized',
    AllFields = 'AllFields'
}

export enum ContestAward {
    MostSacks = 'MostSacks',
    MostBioSacks = 'MostBioSacks'
}

export const CONTEST_PRIZE = 240
export const IRRIGATION_COST_PER_FIELD = 100

export type MarketChanges = Partial<Record<MarketId, number>>

export type MessageEffect =
    | { kind: 'Demand'; changes: MarketChanges }
    | { kind: 'Price'; steps: number }
    | { kind: 'WormLoss' }
    | { kind: 'Yield'; scope: YieldScope; changes: MarketChanges }
    | { kind: 'Irrigation' }
    | { kind: 'Contest'; award: ContestAward }

const BIO_UP_NORM_DOWN: MarketChanges = {
    [MarketId.AmalieBio]: 1,
    [MarketId.BiolaBio]: 1,
    [MarketId.ChrisBio]: 1,
    [MarketId.AmalieNorm]: -1,
    [MarketId.BiolaNorm]: -1,
    [MarketId.ChrisNorm]: -1
}

const BEETLE_DAMAGE: MarketChanges = {
    [MarketId.AmalieNorm]: -2,
    [MarketId.BiolaNorm]: -1,
    [MarketId.ChrisNorm]: -2
}

const UNFERTILIZED_BIOLA_BONUS: MessageEffect = {
    kind: 'Yield',
    scope: YieldScope.Unfertilized,
    changes: { [MarketId.BiolaNorm]: 1, [MarketId.BiolaBio]: 1 }
}

const SUBSIDIES: MessageEffect = { kind: 'Price', steps: 1 }

export const MESSAGE_EFFECTS: Record<MessageId, readonly MessageEffect[]> = {
    [MessageId.FatteningPotatoes]: [
        { kind: 'Demand', changes: { [MarketId.ChrisBio]: 1, [MarketId.ChrisNorm]: 1 } }
    ],
    [MessageId.EcoSurvey]: [{ kind: 'Demand', changes: BIO_UP_NORM_DOWN }],
    [MessageId.ReactorAccident]: [
        { kind: 'Price', steps: -1 },
        {
            kind: 'Demand',
            changes: { [MarketId.AmalieBio]: 1, [MarketId.BiolaBio]: 1, [MarketId.ChrisBio]: 1 }
        }
    ],
    [MessageId.EcoSurveyAndBlight]: [
        { kind: 'Demand', changes: BIO_UP_NORM_DOWN },
        {
            kind: 'Yield',
            scope: YieldScope.Unsprayed,
            changes: {
                [MarketId.AmalieNorm]: -3,
                [MarketId.AmalieBio]: -3,
                [MarketId.BiolaNorm]: -2,
                [MarketId.BiolaBio]: -2,
                [MarketId.ChrisNorm]: -1,
                [MarketId.ChrisBio]: -1
            }
        }
    ],
    [MessageId.RainySummer]: [{ kind: 'WormLoss' }],
    [MessageId.PotatoBlight]: [
        {
            kind: 'Yield',
            scope: YieldScope.Unsprayed,
            changes: {
                [MarketId.AmalieNorm]: -3,
                [MarketId.AmalieBio]: -1,
                [MarketId.BiolaNorm]: -2,
                [MarketId.BiolaBio]: -2,
                [MarketId.ChrisNorm]: -1,
                [MarketId.ChrisBio]: -1
            }
        }
    ],
    [MessageId.SubsidiesAndBeetles]: [
        SUBSIDIES,
        { kind: 'Yield', scope: YieldScope.Unsprayed, changes: BEETLE_DAMAGE }
    ],
    [MessageId.SubsidiesAndGoodWeather]: [SUBSIDIES, UNFERTILIZED_BIOLA_BONUS],
    [MessageId.PotatoBeetles]: [
        {
            kind: 'Yield',
            scope: YieldScope.Unsprayed,
            changes: { ...BEETLE_DAMAGE, [MarketId.AmalieBio]: -1 }
        }
    ],
    [MessageId.AgricultureContest]: [{ kind: 'Contest', award: ContestAward.MostSacks }],
    [MessageId.Drought]: [
        { kind: 'Irrigation' },
        { kind: 'Yield', scope: YieldScope.AllFields, changes: { [MarketId.AmalieNorm]: -1 } }
    ],
    [MessageId.SubsidiesAndRain]: [SUBSIDIES, { kind: 'WormLoss' }],
    [MessageId.EnvironmentContest]: [{ kind: 'Contest', award: ContestAward.MostBioSacks }],
    [MessageId.QuietYear]: [],
    [MessageId.Subsidies]: [SUBSIDIES],
    [MessageId.UneventfulYear]: [],
    [MessageId.PotatoVirus]: [
        {
            kind: 'Yield',
            scope: YieldScope.AllFields,
            changes: {
                [MarketId.AmalieNorm]: -3,
                [MarketId.AmalieBio]: -1,
                [MarketId.BiolaNorm]: -2,
                [MarketId.BiolaBio]: -1,
                [MarketId.ChrisNorm]: -1,
                [MarketId.ChrisBio]: -1
            }
        }
    ],
    [MessageId.TradeAgreement]: [
        { kind: 'Demand', changes: { [MarketId.AmalieNorm]: -1, [MarketId.BiolaBio]: -1 } }
    ],
    [MessageId.GoodWeather]: [UNFERTILIZED_BIOLA_BONUS],
    [MessageId.EcoSurveyAndDrySummer]: [
        { kind: 'Demand', changes: BIO_UP_NORM_DOWN },
        { kind: 'Irrigation' },
        {
            kind: 'Yield',
            scope: YieldScope.AllFields,
            changes: { [MarketId.AmalieNorm]: -1, [MarketId.AmalieBio]: -1 }
        }
    ]
}

export function contestAward(messageId: MessageId): ContestAward | undefined {
    for (const effect of MESSAGE_EFFECTS[messageId]) {
        if (effect.kind === 'Contest') return effect.award
    }
    return undefined
}

// The die picks a message space: "1-2-3", "4-5" or "6".
export enum MessageSpaceId {
    OneToThree = 'OneToThree',
    FourFive = 'FourFive',
    Six = 'Six'
}

export const MESSAGE_SPACE_FACES: Record<MessageSpaceId, readonly number[]> = {
    [MessageSpaceId.OneToThree]: [1, 2, 3],
    [MessageSpaceId.FourFive]: [4, 5],
    [MessageSpaceId.Six]: [6]
}

export const MESSAGE_SPACE_IDS: readonly MessageSpaceId[] = [
    MessageSpaceId.OneToThree,
    MessageSpaceId.FourFive,
    MessageSpaceId.Six
]

export function spaceForRoll(roll: number): MessageSpaceId {
    const space = MESSAGE_SPACE_IDS.find((candidate) =>
        MESSAGE_SPACE_FACES[candidate].includes(roll)
    )
    if (!space) {
        throw Error(`A die cannot roll ${roll}`)
    }
    return space
}
