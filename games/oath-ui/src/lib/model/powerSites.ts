import {
    HydratedUseActionPower,
    PowerChoiceKind,
    type HydratedOathGameState,
    type LegalChoice,
    type LegalPowerUse,
    type PowerChoice
} from '@tabletop/oath'
import {
    NO_OPTION,
    allowsSeveral,
    optionIndexOf,
    picksComplete,
    powerChoicesFrom,
    withOptionPick,
    type PowerChoicePicks
} from './powerChoices.js'

/**
 * A power's site, picked on the lit map: the sites the engine accepts for it with the power's
 * other picks, and the one it holds.
 */
export type PowerSiteRow = {
    /** The spec the site answers. */
    spec: number
    /** The picks before it are made, so its sites may be lit. */
    ready: boolean
    /** Every site the engine accepts here, given the power's other picks, in option order. */
    sites: string[]
    picked: string | undefined
    /** One legal site for a required pick: made from the start, and no part of the shared pick. */
    made: boolean
}

function siteOf(option: PowerChoice | undefined): string | undefined {
    return option?.kind === PowerChoiceKind.Site ? option.siteId : undefined
}

/** A single pick drawn by its option index (not a warband grid, a count or an exchange's terms). */
function picksAnOption(legal: LegalChoice): boolean {
    return (
        !allowsSeveral(legal) &&
        legal.spec.kind !== PowerChoiceKind.Warbands &&
        legal.spec.kind !== PowerChoiceKind.Count &&
        legal.spec.kind !== PowerChoiceKind.Exchange
    )
}

/** The specs a power answers with one site. */
export function siteSpecs(power: LegalPowerUse): number[] {
    return power.choices.flatMap((legal, spec) =>
        legal.spec.kind === PowerChoiceKind.Site && picksAnOption(legal) ? [spec] : []
    )
}

/**
 * The ways the picks after `spec` may still be made: an open single pick is tried as each of its
 * options, and left empty where it may be (Resettle names the Great Slum's card to discard first
 * after its site, so a full Great Slum is a site it can still take).
 */
function laterWays(
    choices: readonly LegalChoice[],
    spec: number,
    picks: PowerChoicePicks
): PowerChoicePicks[] {
    return choices.reduce<PowerChoicePicks[]>(
        (ways, legal, index) => {
            if (index <= spec || !picksAnOption(legal)) return ways
            return ways.flatMap((way) => {
                if (optionIndexOf(legal, index, way) !== NO_OPTION) return [way]
                const named = legal.options.map((_, option) =>
                    withOptionPick(way, legal, index, option)
                )
                return legal.spec.min === 0 ? [way, ...named] : named
            })
        },
        [picks]
    )
}

/** R-7.1.3 — every site at `spec` the engine would accept, the power's other picks held. */
function acceptedSites(
    state: HydratedOathGameState,
    playerId: string,
    power: LegalPowerUse,
    spec: number,
    picks: PowerChoicePicks
): string[] {
    const legal = power.choices[spec]
    if (!legal) return []
    return legal.options.flatMap((option, index) => {
        const siteId = siteOf(option)
        if (siteId === undefined) return []
        const accepted = laterWays(
            power.choices,
            spec,
            withOptionPick(picks, legal, spec, index)
        ).some(
            (way) =>
                HydratedUseActionPower.reasonCannotUse(
                    state,
                    playerId,
                    power.cardId,
                    power.powerIndex,
                    powerChoicesFrom(power.choices, way)
                ) === undefined
        )
        return accepted ? [siteId] : []
    })
}

function withSite(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    spec: number,
    siteId: string | undefined
): PowerChoicePicks {
    const index = legal.options.findIndex((option) => siteOf(option) === siteId)
    if (siteId !== undefined && index >= 0) return withOptionPick(picks, legal, spec, index)
    if (!(spec in picks.option)) return picks
    const option = Object.fromEntries(
        Object.entries(picks.option).filter(([key]) => Number(key) !== spec)
    )
    return { ...picks, option }
}

/**
 * The power's site rows, and its picks as they are read back: a site is kept only while the
 * engine accepts it with the other picks, and a required site with one legal value is made.
 */
export function powerSiteRows(
    state: HydratedOathGameState,
    playerId: string,
    power: LegalPowerUse,
    stored: PowerChoicePicks
): { rows: PowerSiteRow[]; picks: PowerChoicePicks } {
    let picks = stored
    const rows = siteSpecs(power).map((spec) => {
        const legal = power.choices[spec]
        const ready = picksComplete(power.choices.slice(0, spec), picks)
        const sites = ready ? acceptedSites(state, playerId, power, spec, picks) : []
        const held = siteOf(legal.options[picks.option[spec] ?? NO_OPTION])
        const made = legal.spec.min > 0 && sites.length === 1
        const picked =
            held !== undefined && sites.includes(held) ? held : made ? sites[0] : undefined
        picks = withSite(picks, legal, spec, picked)
        return { spec, ready, sites, picked, made }
    })
    return { rows, picks }
}

/** One site on the shared map pick: the words of every row a tap there would fill. */
export type PowerMapSite = { siteId: string; words: string[] }

/** The site rows the shared pick serves: open to a pick, and not made from the start. */
export function openOnMap(row: PowerSiteRow): boolean {
    return row.ready && !row.made && row.sites.length > 0
}

/** The union of the open rows' sites, each naming the rows it serves once, in the rows' order. */
export function sitesOnMap(rows: readonly { row: PowerSiteRow; words: string }[]): PowerMapSite[] {
    const bySite = new Map<string, string[]>()
    for (const { row, words } of rows) {
        if (!openOnMap(row)) continue
        for (const siteId of row.sites) {
            const named = bySite.get(siteId) ?? []
            if (!named.includes(words)) named.push(words)
            bySite.set(siteId, named)
        }
    }
    return [...bySite].map(([siteId, words]) => ({ siteId, words }))
}

/**
 * A tap on a lit site: every open row that offers it takes it, and every other open row lets
 * its site go, so the panel holds one ring.
 */
export function withMapTap(
    power: LegalPowerUse,
    rows: readonly PowerSiteRow[],
    picks: PowerChoicePicks,
    siteId: string
): PowerChoicePicks {
    return rows.reduce((next, row) => {
        if (!openOnMap(row)) return next
        const legal = power.choices[row.spec]
        if (!legal) return next
        return withSite(next, legal, row.spec, row.sites.includes(siteId) ? siteId : undefined)
    }, picks)
}
