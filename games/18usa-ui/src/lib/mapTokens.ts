import {
    BridgeMarker,
    CoalMarker,
    EighteenUSACorporations,
    EighteenUSAPhases,
    ExpressFreightMarker,
    GreatNorthernBorderIds,
    GreatNorthernId,
    ImportExportHubToken,
    ImportExportMarker,
    OilMarker,
    OreMarker,
    ResourceTokens,
    BridgeTokenValue,
    RichOreMarker,
    Subsidies,
    subsidy,
    type EighteenUSAState,
    type Subsidy
} from '@tabletop/18usa'
import { assert, assertExists } from '@tabletop/common'
import { privateOwningCompany } from '@tabletop/18xx'
import {
    svgDataUrl,
    svgText,
    tileSymbolMarkup,
    type LocationMarkerArt,
    type MapMarkerArt,
    type StateMarker,
    type TileSymbolName
} from '@tabletop/18xx-ui'

type ResourceSymbol = Extract<TileSymbolName, 'coal' | 'oil' | 'ore' | 'bridge'>
type TokenFace = { fill: string; ink: string; symbol?: ResourceSymbol; lines: readonly string[] }

const ArtRadius = 10.5
const Paper = '#fffdf7'
const SubsidyOrange = '#e98a2f'
const SubsidyInk = '#2a1a0c'
const RaisedPhaseId = '5'

function raisedValue(kind: 'oil' | 'ore'): number {
    const raised = ResourceTokens[kind].raised
    assertExists(raised, `${kind} tokens rise`)
    return raised.value
}
/** What an upgraded ore token pays (§13.3). */
export const RichOreValue = raisedValue('ore')

/** The kinds of token placed on the map during play, with what each is called and drawn as. */
const PlacedTokens: Readonly<
    Record<string, { name: string; symbol: ResourceSymbol; fill: string; value: number }>
> = {
    [CoalMarker]: {
        name: 'Coal token',
        symbol: 'coal',
        fill: '#2b2926',
        value: ResourceTokens.coal.value
    },
    [OilMarker]: {
        name: 'Oil token',
        symbol: 'oil',
        fill: '#1f4e5f',
        value: ResourceTokens.oil.value
    },
    [OreMarker]: {
        name: 'Ore token',
        symbol: 'ore',
        fill: '#94492b',
        value: ResourceTokens.ore.value
    },
    [RichOreMarker]: {
        name: 'Upgraded ore token',
        symbol: 'ore',
        fill: '#94492b',
        value: raisedValue('ore')
    },
    [BridgeMarker]: {
        name: 'Bridge token',
        symbol: 'bridge',
        fill: '#56636e',
        value: BridgeTokenValue
    }
}

const ExpressFreightBonus = 10
const ExpressFreightName = 'Express Freight station'
const ImportExportName = 'Import / Export Hub token'
const ImportExportArt: MapMarkerArt = {
    token: {
        imageUrl: tokenImage({
            fill: '#b8342c',
            ink: Paper,
            lines: [
                ImportExportHubToken.values.slice(0, 2).join('/'),
                ImportExportHubToken.values.slice(2).join('/')
            ]
        }),
        place: 'corner'
    }
}

/** P8's station in a red area, in its company's colours, its bonus on a tab beside it. */
function expressFreightArt(companyId: string | undefined): MapMarkerArt {
    const company = EighteenUSACorporations.find((entry) => entry.id === companyId)
    return {
        token: {
            imageUrl: tokenImage({
                fill: company?.color ?? '#6b6257',
                ink: company?.textColor ?? Paper,
                lines: [company?.abbreviation ?? 'P8']
            }),
            place: 'corner',
            tab: { label: `+${ExpressFreightBonus}`, caption: ExpressFreightName }
        }
    }
}

const subsidyKind = (subsidyId: string) => `subsidy:${subsidyId}`
const cityBonusKind = (subsidyId: string) => `city-bonus:${subsidyId}`
const GreatNorthernMarker = 'great-northern'

function tokenImage({ fill, ink, symbol, lines }: TokenFace): string {
    const r = ArtRadius
    const symbolMarkup = symbol
        ? `<g transform="translate(0 -3.6) scale(0.6)">${tileSymbolMarkup(symbol, ink)}</g>`
        : ''
    const baselines = symbol ? [7.4] : lines.length > 1 ? [-0.6, 6.4] : [2.4]
    const text = lines
        .map(
            (line, index) =>
                `<text y="${baselines[index]}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${line.length > 3 ? 5.6 : 6.6}" font-weight="800" fill="${ink}">${svgText(line)}</text>`
        )
        .join('')
    return svgDataUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r} ${-r} ${r * 2} ${r * 2}">` +
            `<circle r="${r - 0.4}" fill="${fill}" stroke="#1d1b18" stroke-width="0.6"/>` +
            symbolMarkup +
            text +
            '</svg>'
    )
}

function placedTokenArt(kind: string, value: number): MapMarkerArt {
    const token = PlacedTokens[kind]
    return {
        token: {
            imageUrl: tokenImage({
                fill: token.fill,
                ink: Paper,
                symbol: token.symbol,
                lines: [`+${value}`]
            }),
            place: { covers: token.symbol }
        }
    }
}

// The label a subsidy tile prints, in a token's width.
function subsidyLines(offered: Subsidy): readonly string[] {
    switch (offered.effect.kind) {
        case 'none':
            return ['—']
        case 'boomtown':
            return ['Boom', 'town']
        case 'free-station':
            return ['Free', 'Stn']
        case 'resource':
            return ['Res']
        case 'city-bonus':
            return offered.effect.value === offered.effect.fromPhase5Value
                ? [`+${offered.effect.value}`]
                : [`+${offered.effect.value}`, `/${offered.effect.fromPhase5Value}`]
        case 'cash':
            return [`$${offered.effect.amount}`]
    }
}

const subsidyArt = (offered: Subsidy): MapMarkerArt => ({
    token: {
        imageUrl: tokenImage({
            fill: SubsidyOrange,
            ink: SubsidyInk,
            lines: subsidyLines(offered)
        }),
        place: 'corner'
    }
})

function cityBonusArt(subsidyId: string, phaseId: string): MapMarkerArt {
    const effect = subsidy(subsidyId).effect
    assert(effect.kind === 'city-bonus', 'A city bonus is a city-bonus subsidy')
    const value = EighteenUSAPhases.isAtLeast(phaseId, RaisedPhaseId)
        ? effect.fromPhase5Value
        : effect.value
    return {
        token: {
            imageUrl: tokenImage({ fill: SubsidyOrange, ink: SubsidyInk, lines: [`+${value}`] }),
            place: 'corner'
        }
    }
}

const CityBonusSubsidies = Subsidies.filter((entry) => entry.effect.kind === 'city-bonus')

/** What every marker the map prints or the game places is called. */
export const EighteenUSAMarkerNames: Readonly<Record<string, string>> = {
    ...Object.fromEntries(Object.entries(PlacedTokens).map(([kind, { name }]) => [kind, name])),
    [ExpressFreightMarker]: ExpressFreightName,
    [ImportExportMarker]: ImportExportName,
    ...Object.fromEntries(
        Subsidies.map((entry) => [
            subsidyKind(entry.id),
            entry.effect.kind === 'none' ? 'No subsidy' : `${entry.name} subsidy`
        ])
    ),
    ...Object.fromEntries(
        CityBonusSubsidies.map((entry) => [cityBonusKind(entry.id), `${entry.name} city bonus`])
    )
}

const GreatNorthernIcon = tokenImage({ fill: '#87cefa', ink: '#14202b', lines: ['GN'] })

/** The printed resource, bridge and border icons, and every token the game places. */
export const EighteenUSAMarkerArt: Readonly<Record<string, MapMarkerArt>> = {
    coal: { revenueSymbol: 'coal' },
    oil: { revenueSymbol: 'oil' },
    ore: { revenueSymbol: 'ore' },
    bridge: { revenueSymbol: 'bridge' },
    [GreatNorthernMarker]: { token: { imageUrl: GreatNorthernIcon, place: 'corner' } },
    [ExpressFreightMarker]: expressFreightArt(undefined),
    [ImportExportMarker]: ImportExportArt,
    ...Object.fromEntries(
        Object.entries(PlacedTokens).map(([kind, { value }]) => [kind, placedTokenArt(kind, value)])
    ),
    ...Object.fromEntries(Subsidies.map((entry) => [subsidyKind(entry.id), subsidyArt(entry)])),
    ...Object.fromEntries(
        CityBonusSubsidies.map((entry) => [cityBonusKind(entry.id), cityBonusArt(entry.id, '2')])
    )
}

function isEighteenUSAState(state: object): state is EighteenUSAState {
    return 'citySubsidies' in state && 'metropolisIds' in state && 'redAreaTokens' in state
}

/** The subsidies the cities still offer, and the city bonuses companies have taken (§11.6.1). */
export function eighteenUSAStateMarkers(state: object): StateMarker[] {
    assert(isEighteenUSAState(state), 'The map view draws an 18USA state')
    return [
        ...Object.entries(state.citySubsidies).map(([locationId, subsidyId]) => ({
            locationId,
            kind: subsidyKind(subsidyId)
        })),
        ...Object.entries(state.cityBonuses ?? {}).map(([locationId, subsidyId]) => ({
            locationId,
            kind: cityBonusKind(subsidyId)
        }))
    ]
}

/**
 * Art that changes with play: oil tokens and the +10/+20 bonus pay more from phase 5, P8's
 * station shows its company, and the Great Northern's border icons go when P17 is not in the
 * game or has closed.
 */
export function eighteenUSAMarkerArt(state: EighteenUSAState): LocationMarkerArt {
    const art: Record<string, Record<string, MapMarkerArt>> = {}
    const add = (locationId: string, markerId: string, markerArt: MapMarkerArt) => {
        art[locationId] = { ...art[locationId], [markerId]: markerArt }
    }
    if (EighteenUSAPhases.isAtLeast(state.phaseId, RaisedPhaseId))
        for (const marker of state.locationMarkers ?? [])
            if (marker.kind === OilMarker)
                add(marker.locationId, OilMarker, placedTokenArt(OilMarker, raisedValue('oil')))
    for (const marker of state.locationMarkers ?? [])
        if (marker.kind === ExpressFreightMarker)
            add(
                marker.locationId,
                ExpressFreightMarker,
                expressFreightArt(privateOwningCompany(state, marker.privateCompanyId))
            )
    for (const [locationId, subsidyId] of Object.entries(state.cityBonuses ?? {}))
        add(locationId, cityBonusKind(subsidyId), cityBonusArt(subsidyId, state.phaseId))
    const greatNorthernOpen = state.companies.some(
        (company) => company.id === GreatNorthernId && !company.closed
    )
    if (!greatNorthernOpen)
        for (const locationId of GreatNorthernBorderIds)
            add(locationId, GreatNorthernMarker, { hidden: true })
    return art
}
