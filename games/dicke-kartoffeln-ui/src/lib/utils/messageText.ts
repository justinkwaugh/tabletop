import { MessageId } from '@tabletop/dicke-kartoffeln'

export type MessageText = {
    effect: readonly string[]
    headline: string
}

const BIO_DEMAND =
    'Demand for Bio potatoes rises 1 row each; demand for Norm potatoes falls 1 row each.'
const NOTHING = 'Nothing happened this year.'

// English wording of the twenty message cards; where the printed translation strays from the
// German cards, this follows the German.
export const MESSAGE_TEXT: Record<MessageId, MessageText> = {
    [MessageId.FatteningPotatoes]: {
        headline: 'Pig farms want potatoes',
        effect: ['Demand for Chris-Bio and Chris-Norm rises 1 row.']
    },
    [MessageId.EcoSurvey]: {
        headline: 'Green awareness grows',
        effect: [BIO_DEMAND]
    },
    [MessageId.ReactorAccident]: {
        headline: 'Reactor accident',
        effect: [
            'All prices fall by 20 marks.',
            'Demand for organically grown potatoes rises 1 row each.'
        ]
    },
    [MessageId.EcoSurveyAndBlight]: {
        headline: 'Green awareness & blight',
        effect: [
            BIO_DEMAND,
            'Unsprayed fields yield: Amalie-Norm −3, Amalie-Bio −3, Biola-Norm −2, Biola-Bio −2, Chris-Norm −1, Chris-Bio −1.'
        ]
    },
    [MessageId.RainySummer]: {
        headline: 'Rainy summer',
        effect: [
            'Every field loses 1 worm.',
            'Fertilized fields left with fewer than 4 worms lose their fertilizer.'
        ]
    },
    [MessageId.PotatoBlight]: {
        headline: 'Potato blight',
        effect: [
            'Unsprayed fields yield: Amalie-Norm −3, Amalie-Bio −1, Biola-Norm −2, Biola-Bio −2, Chris-Norm −1, Chris-Bio −1.'
        ]
    },
    [MessageId.SubsidiesAndBeetles]: {
        headline: 'Subsidies & beetles',
        effect: [
            'All prices rise by 20 marks.',
            'Unsprayed fields yield: Amalie-Norm −2, Biola-Norm −1, Chris-Norm −2. Bio varieties are unaffected.'
        ]
    },
    [MessageId.SubsidiesAndGoodWeather]: {
        headline: 'Subsidies & sunshine',
        effect: ['All prices rise by 20 marks.', 'Unfertilized Biola yields 1 more sack.']
    },
    [MessageId.PotatoBeetles]: {
        headline: 'Colorado beetles',
        effect: [
            'Unsprayed fields yield: Amalie-Norm −2, Biola-Norm −1, Chris-Norm −2, Amalie-Bio −1. The other Bio varieties are unaffected.'
        ]
    },
    [MessageId.AgricultureContest]: {
        headline: 'Agriculture prize',
        effect: [
            'Whoever sells the most potato sacks next year wins a 240 mark prize; equal sellers share it.',
            'Rolled in the first or the last year: read the next message instead.'
        ]
    },
    [MessageId.Drought]: {
        headline: 'Drought',
        effect: [
            'Watering costs 100 marks for each sown field, paid with the harvest.',
            'Every Amalie-Norm yield is 1 lower this year.'
        ]
    },
    [MessageId.SubsidiesAndRain]: {
        headline: 'Subsidies & rain',
        effect: [
            'All prices rise by 20 marks.',
            'Every field loses 1 worm. Fertilized fields left with fewer than 4 worms lose their fertilizer at once.'
        ]
    },
    [MessageId.EnvironmentContest]: {
        headline: 'Environment prize',
        effect: [
            'Whoever sells the most organic potato sacks next year wins a 240 mark prize; equal sellers share it.',
            'Rolled in the first or the last year: read the next message instead.'
        ]
    },
    [MessageId.QuietYear]: { headline: 'A quiet year', effect: [NOTHING] },
    [MessageId.Subsidies]: {
        headline: 'EC subsidies',
        effect: ['All prices rise by 20 marks.']
    },
    [MessageId.UneventfulYear]: { headline: 'A quiet year', effect: [NOTHING] },
    [MessageId.PotatoVirus]: {
        headline: 'Potato virus',
        effect: [
            'All fields yield: Amalie-Norm −3, Amalie-Bio −1, Biola-Norm −2, Biola-Bio −1, Chris-Norm −1, Chris-Bio −1.'
        ]
    },
    [MessageId.TradeAgreement]: {
        headline: 'US trade agreement',
        effect: ['Demand for Amalie-Norm and Biola-Bio falls 1 row.']
    },
    [MessageId.GoodWeather]: {
        headline: 'Good weather',
        effect: ['Unfertilized Biola yields 1 more sack.']
    },
    [MessageId.EcoSurveyAndDrySummer]: {
        headline: 'Green awareness & dry summer',
        effect: [
            BIO_DEMAND,
            'Watering costs 100 marks for each sown field.',
            'Every Amalie yield is 1 lower this round.'
        ]
    }
}
