import { assertExists } from '@tabletop/common'
import {
    TheOldPrinceMap,
    TheOldPrinceTileSet,
    TheOldPrinceTitleRules
} from '@tabletop/the-old-prince'
import { TheOldPrinceScenarios } from '@tabletop/the-old-prince/scenarios'
import { UiDefinition as TheOldPrinceUi } from '@tabletop/the-old-prince-ui'
import {
    Shikoku1889BeginnerTileSet,
    Shikoku1889Map,
    Shikoku1889TileSet,
    Shikoku1889TitleRules
} from '@tabletop/shikoku-1889'
import { Shikoku1889Scenarios } from '@tabletop/shikoku-1889/scenarios'
import { UiDefinition as Shikoku1889Ui } from '@tabletop/shikoku-1889-ui'
import { EighteenThirtyMap, EighteenThirtyTileSet, EighteenThirtyTitleRules } from '@tabletop/1830'
import { EighteenThirtyScenarios } from '@tabletop/1830/scenarios'
import { UiDefinition as EighteenThirtyUi, EighteenThirtyMapView } from '@tabletop/1830-ui'
import {
    EighteenSeventeenMap,
    EighteenSeventeenTileSet,
    EighteenSeventeenTitleRules
} from '@tabletop/1817'
import { EighteenSeventeenScenarios } from '@tabletop/1817/scenarios'
import { UiDefinition as EighteenSeventeenUi, EighteenSeventeenMapView } from '@tabletop/1817-ui'
import type { EighteenXXTitleRules, RailwayMap, TileRotation, TileSet } from '@tabletop/18xx'
import type { ScenarioDefinition, ScenarioPosition } from '@tabletop/18xx/scenarios'
import type { Component } from 'svelte'
import { scenarioHost, type ScenarioHostProps } from './scenarios/uiDefinitions.js'
import type { TileLayout } from '@tabletop/18xx-ui'

export type FinishedGameFixture = {
    game: unknown
    initialState: unknown
    actions: readonly unknown[]
    finalWealth: Readonly<Record<string, number>>
}

/** Everything the playground needs to host one 18xx title. */
export type PlaygroundTitle = {
    /** Short label used by the harness selectors. */
    key: string
    name: string
    rules: Omit<
        EighteenXXTitleRules,
        'state' | 'createOpening' | 'decisionHandlers' | 'titleStateHandlers'
    >
    scenarios: ScenarioDefinition
    host: Component<ScenarioHostProps>
    map: RailwayMap
    /** Node positions for printed multi-node hexes, keyed by location. */
    mapLayouts?: Readonly<Record<string, TileLayout>>
    /** A city where the maps page demonstrates a placed tile, token and route. */
    mapExample: {
        locationId: string
        definitionId: string
        rotation: TileRotation
        label: string
    }
    /** Tile sets offered by the tile library, keyed by collection name. */
    tileSets: Readonly<Record<string, TileSet>>
    /** Scenario positions only this title offers, beyond the shared ones. */
    positions: readonly ScenarioPosition[]
    finishedGame?: () => Promise<{ default: FinishedGameFixture }>
}

export const PlaygroundTitles: readonly PlaygroundTitle[] = [
    {
        key: 'TOP',
        name: 'The Old Prince 1871',
        rules: TheOldPrinceTitleRules,
        scenarios: TheOldPrinceScenarios,
        host: scenarioHost(TheOldPrinceUi, TheOldPrinceScenarios),
        map: TheOldPrinceMap,
        mapExample: { locationId: 'K19', definitionId: '18xx:5', rotation: 0, label: 'CB' },
        tileSets: { 'The Old Prince 1871': TheOldPrinceTileSet },
        positions: ['split', 'funding-chain'],
        finishedGame: () => import('./demo/fixtures/top-finished.json')
    },
    {
        key: '1889',
        name: 'Shikoku 1889',
        rules: Shikoku1889TitleRules,
        scenarios: Shikoku1889Scenarios,
        host: scenarioHost(Shikoku1889Ui, Shikoku1889Scenarios),
        map: Shikoku1889Map,
        mapExample: { locationId: 'I2', definitionId: '18xx:5', rotation: 2, label: 'SR' },
        tileSets: {
            'Shikoku 1889': Shikoku1889TileSet,
            'Shikoku 1889 beginner': Shikoku1889BeginnerTileSet
        },
        positions: ['diesel'],
        finishedGame: () => import('./demo/fixtures/1889-finished.json')
    },
    {
        key: '1830',
        name: '1830',
        rules: EighteenThirtyTitleRules,
        scenarios: EighteenThirtyScenarios,
        host: scenarioHost(EighteenThirtyUi, EighteenThirtyScenarios),
        map: EighteenThirtyMap,
        mapLayouts: EighteenThirtyMapView.layouts,
        mapExample: { locationId: 'H10', definitionId: '18xx:57', rotation: 1, label: 'PRR' },
        tileSets: { '1830': EighteenThirtyTileSet },
        positions: ['diesel'],
        finishedGame: () => import('./demo/fixtures/1830-finished.json')
    },
    {
        key: '1817',
        name: '1817',
        rules: EighteenSeventeenTitleRules,
        scenarios: EighteenSeventeenScenarios,
        host: scenarioHost(EighteenSeventeenUi, EighteenSeventeenScenarios),
        map: EighteenSeventeenMap,
        mapLayouts: EighteenSeventeenMapView.layouts,
        mapExample: { locationId: 'F13', definitionId: '18xx:57', rotation: 0, label: 'PLE' },
        tileSets: { '1817': EighteenSeventeenTileSet },
        positions: ['optional-opening', 'company-powers', 'shorts'],
        finishedGame: () => import('./demo/fixtures/1817-finished.json')
    }
]

export function playgroundTitle(key: string): PlaygroundTitle {
    const title = PlaygroundTitles.find((candidate) => candidate.key === key)
    assertExists(title, `Unknown playground title ${key}`)
    return title
}

export function playgroundTitleForType(typeId: string): PlaygroundTitle {
    const title = PlaygroundTitles.find((candidate) => candidate.scenarios.info.id === typeId)
    assertExists(title, `No playground title for ${typeId}`)
    return title
}
