import { Banner, worldDeckSearchCost } from '@tabletop/oath'
import { bannerName, cardName } from './names.js'
import { nextWinBeforePhrase, nextWinPhrase } from './nextWin.js'
import type { NewsRow, TitleGoal } from './sinceLastTurn.js'

/** A run of a row's line: seats are named by id, each drawn as its chip; a banner's name is strong. */
export interface WordRun {
    text: string
    strong?: boolean
}

/** A row's words: the line, then the muted "how" and its rose part. Seats are named by id. */
export interface NewsWords {
    label?: string
    line: WordRun[]
    how?: string
    danger?: string
}

const GOALS: Record<TitleGoal, string> = {
    peoplesFavor: 'Holds the People’s Favor',
    darkestSecret: 'Holds the Darkest Secret',
    mostSites: 'Rules the most sites',
    empireSites: 'The Empire rules the most sites',
    mostRelicsAndBanners: 'Holds the most relics and banners'
}

/** R-2.11.b — on a tie only a count can be tied, so the goal is said as the count. */
const TIED_GOALS: Record<TitleGoal, string> = {
    peoplesFavor: 'The People’s Favor',
    darkestSecret: 'The Darkest Secret',
    mostSites: 'Most sites',
    empireSites: 'Most sites',
    mostRelicsAndBanners: 'Most relics and banners'
}

function joined(parts: (string | undefined)[]): string | undefined {
    const present = parts.filter((part): part is string => part !== undefined)
    return present.length > 0 ? present.join(' · ') : undefined
}

function seats(ids: readonly string[]): string {
    return ids.length <= 2 ? ids.join(' and ') : `${ids.slice(0, -1).join(', ')} and ${ids.at(-1)}`
}

/** The words of one row, in the viewer's person: "you" is the viewer's own chip. */
export function newsWords(row: NewsRow, viewerId: string | undefined): NewsWords {
    switch (row.kind) {
        case 'vision': {
            const has = row.drawerId === viewerId ? 'have' : 'has'
            // R-2.1.6 — the track's price for a world-deck Search after this draw.
            const cost =
                row.visionsDrawn === undefined
                    ? undefined
                    : `the Search now costs ${worldDeckSearchCost(row.visionsDrawn)} Supply`
            const source = row.powerCardId
                ? `With ${cardName(row.powerCardId)}`
                : 'World-deck Search'
            return {
                line: [{ text: `${row.drawerId} ${has} seen a Vision` }],
                how: joined([source, cost])
            }
        }
        case 'banner': {
            const name = `the ${bannerName(row.banner)}`
            const line: WordRun[] =
                row.toId === undefined
                    ? [{ text: `${row.fromId ?? 'Nobody'} lost ` }, { text: name, strong: true }]
                    : [
                          { text: `${row.toId} took ` },
                          { text: name, strong: true },
                          ...(row.fromId ? [{ text: ` from ${row.fromId}` }] : [])
                      ]
            return {
                line,
                how: bannerHow(row),
                danger: row.toMob ? 'now on its Mob side' : undefined
            }
        }
        case 'title': {
            if (row.toId === undefined) {
                return {
                    line: [{ text: `${row.fromId ?? 'Nobody'} lost the Oathkeeper title` }],
                    how: 'Nobody holds it'
                }
            }
            const from = row.fromId ? ` from ${row.fromId}` : ''
            const goal =
                row.goal === undefined
                    ? undefined
                    : row.tie
                      ? `${TIED_GOALS[row.goal]}, tied with ${seats(row.tie.tiedWithIds)} · ${row.tie.chooserId} chose`
                      : GOALS[row.goal]
            return {
                line: [{ text: `${row.toId} took the Oathkeeper title${from}` }],
                how: joined([goal, row.sideAgain ? 'Oathkeeper side again' : undefined])
            }
        }
        case 'usurper': {
            const isViewer = row.playerId === viewerId
            return {
                line: [{ text: `${row.playerId} ${isViewer ? 'are' : 'is'} now the Usurper` }],
                how: isViewer
                    ? 'Flipped at your Wake · you win at the next if you keep it'
                    : 'Flipped at their Wake · wins at the next if they keep it'
            }
        }
        case 'citizen':
            return {
                line: [{ text: `${row.playerId} became a Citizen` }],
                how:
                    row.how?.kind === 'offer'
                        ? `Accepted ${row.how.offererId}’s offer`
                        : row.how?.kind === 'card'
                          ? `With ${cardName(row.how.cardId)}`
                          : undefined
            }
        case 'exile':
            return {
                line: [{ text: `${row.playerId} became an Exile` }],
                how:
                    row.how?.kind === 'exiled'
                        ? `Exiled by ${row.how.byId} · got ${row.how.favor} favor`
                        : row.how?.kind === 'self'
                          ? `Self-exile · ${row.how.favor} favor${row.how.toId ? ` to ${row.how.toId}` : ''}`
                          : undefined
            }
        case 'nextWin': {
            const now = row.now
            const before = row.before
            return {
                label: 'Next to win',
                line: [
                    {
                        text: now
                            ? `${now.playerId} ${nextWinPhrase(now, now.playerId === viewerId)}`
                            : 'Nobody is set to win as the table stands'
                    }
                ],
                how: before
                    ? `Before: ${before.playerId}, ${nextWinBeforePhrase(before, before.playerId === viewerId)}`
                    : 'Before: nobody was set to win'
            }
        }
    }
}

function bannerHow(row: Extract<NewsRow, { kind: 'banner' }>): string | undefined {
    switch (row.how?.kind) {
        case undefined:
            return undefined
        case 'recovered': {
            // R-5.4.2 — the People's Favor is bought with favor, the Darkest Secret with secrets.
            const paid = row.how.paid
            const tokens =
                row.banner === Banner.PeoplesFavor ? 'favor' : paid === 1 ? 'secret' : 'secrets'
            return `Recovered for ${paid} ${tokens}`
        }
        case 'seized':
            return 'Seized in a Campaign'
        case 'conspiracy':
            return 'Taken with the Conspiracy'
        case 'card':
            return `Given with ${cardName(row.how.cardId)}`
        case 'offer':
            return `Given in ${row.how.offererId}’s offer`
    }
}
