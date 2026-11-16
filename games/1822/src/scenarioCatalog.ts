import * as Type from 'typebox'

// The scenarios of the designer's print-and-play pack (rulebook §6.2.1): what a player choosing
// one is told. Their setups are in scenarios.ts; this module is all the game's configuration, and
// so the site's catalogue, loads.

export const ScenarioId1822 = Type.Union([
    Type.Literal('large-regional'),
    Type.Literal('medium-regional'),
    Type.Literal('small-regional'),
    Type.Literal('medium-game'),
    Type.Literal('short-game'),
    Type.Literal('mini-game')
])
export type ScenarioId1822 = Type.Static<typeof ScenarioId1822>
export const ScenarioIds1822: readonly ScenarioId1822[] = ScenarioId1822.anyOf.map(
    (literal) => literal.const
)

/** A scenario as a player choosing it sees it. */
export type ScenarioEntry1822 = {
    id: ScenarioId1822
    name: string
    /** What the scenario is, in a line. */
    summary: string
}

export const ScenarioCatalog1822: readonly ScenarioEntry1822[] = [
    {
        id: 'large-regional',
        name: 'Large Regional',
        summary:
            'England and Wales without Scotland and the Borders; a little shorter than the whole game.'
    },
    {
        id: 'medium-regional',
        name: 'Medium Regional',
        summary:
            'The Midlands, the south and Wales, without the north and the southwest; quick, and good with fewer players.'
    },
    {
        id: 'small-regional',
        name: 'Small Regional',
        summary: 'As the Medium Regional without South Wales; quicker and wilder.'
    },
    {
        id: 'medium-game',
        name: 'Medium Game',
        summary: 'The whole map with a few companies removed at random; a little shorter.'
    },
    {
        id: 'short-game',
        name: 'Short Game',
        summary:
            'The whole map with more companies removed at random; for players who know the game.'
    },
    {
        id: 'mini-game',
        name: 'Mini Game',
        summary:
            'The whole map with half the minor companies removed at random; short and volatile.'
    }
]
