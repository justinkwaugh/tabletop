import { describe, expect, it } from 'vitest'
import { render } from '@react-email/components'
import { TournamentResults } from '@tabletop/email'
import { rankedTiebreak, tournamentTiebreakDescription } from '@tabletop/common'

async function renderedText(rows: Parameters<typeof tournamentTiebreakDescription>[0]) {
    const html = await render(
        TournamentResults({
            tournamentName: 'Mini',
            title: 'Title',
            winners: ['Alice'],
            tiebreakDescription: tournamentTiebreakDescription(rows),
            standings: [
                {
                    rank: 1,
                    name: 'Alice',
                    wins: 1,
                    score: 1,
                    tiebreak: rankedTiebreak({ completed: 4, tiebreak: -10, ...rows[0] }),
                    recipient: true
                }
            ],
            url: 'https://example.com'
        })
    )
    return html.replace(/<[^>]+>/g, ' ').replaceAll('&#x27;', "'")
}

describe('results email tiebreak', () => {
    it('explains and shows the combined value for points behind', async () => {
        const text = await renderedText([{ pointsBehind: 7 }])
        expect(text).toContain('-1.775')
        expect(text).toContain('average points behind the top score')
    })

    it('keeps the totals wording for other titles', async () => {
        const text = await renderedText([{}])
        expect(text).toContain('-10')
        expect(text).toContain("sum of each player's final scores")
    })
})
