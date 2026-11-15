import { describe, expect, it } from 'vitest'
import { render } from '@react-email/components'
import { TournamentResults } from '@tabletop/email'
import { formatTournamentTiebreaks, tournamentTiebreakDescription } from '@tabletop/common'

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
                    tiebreak: formatTournamentTiebreaks([
                        { completed: 4, tiebreak: -10, ...rows[0] }
                    ])[0],
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

describe('results email share of the winner', () => {
    it('shows a percentage and explains it', async () => {
        const text = await renderedText([{ shareOfWinner: 34_972 }])
        expect(text).toContain('87.43%')
        expect(text).toContain('percentage of the top final score')
    })
})

describe('results email ranked by average place', () => {
    it('shows the average place and explains the ranking', async () => {
        const html = await render(
            TournamentResults({
                tournamentName: 'Mini',
                title: 'Title',
                winners: ['Alice'],
                tiebreakDescription: tournamentTiebreakDescription([{ pointsBehind: 0 }]),
                ranksByAveragePlace: true,
                standings: [
                    {
                        rank: 1,
                        name: 'Alice',
                        wins: 1,
                        score: 1,
                        averagePlace: '1.75',
                        recipient: false
                    },
                    {
                        rank: 2,
                        name: 'Bob',
                        wins: 2,
                        score: 2,
                        averagePlace: '2.25',
                        recipient: true
                    }
                ],
                url: 'https://example.com'
            })
        )
        const text = html.replace(/<[^>]+>/g, ' ')
        expect(text).toContain('Avg place')
        expect(text).toContain('2.25')
        expect(text).toContain('an average place of 2.25')
        expect(text).toContain('Ranked by average place')
    })
})
