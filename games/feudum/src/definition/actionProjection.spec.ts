import { assert, assertExists, Visibility, type GameAction } from '@tabletop/common'
import type * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { isCommitAttack } from '../actions/commitAttack.js'
import { isPlayMandate } from '../actions/playMandate.js'
import { isScoreGame } from '../actions/scoreGame.js'
import { docTableRows, readDoc } from '../testing/docs.js'
import {
    concealedSeals,
    perspectivesOf,
    realGames,
    recordFor,
    sealsNamedIn,
    Spectator,
    tilesNamedIn,
    transitionsOf,
    viewOf,
    withoutConcealed,
    writsNamedIn,
    type Transition
} from '../testing/protected.js'
import type { GameWalk } from '../testing/walk.js'
import { ActionType } from './actions.js'
import { FeudumApiActions } from './apiActions.js'
import { FeudumRuntime } from './runtime.js'

const ACTOR = 'p1'
const OTHER_SEAT = 'p2'

/** `visibility.md`'s Action records: what only the acting seat is told. */
const ActorKnown: Partial<Record<ActionType, readonly string[]>> = {
    [ActionType.FinaliseHand]: ['cards', 'pouchGood'],
    [ActionType.Explore]: ['metadata.drawnWritIds'],
    [ActionType.GuildAction]: ['metadata.drawnWritIds'],
    [ActionType.Feast]: ['metadata.drawnWritIds'],
    [ActionType.PlaceDisc]: ['metadata.drawnWritIds'],
    [ActionType.KeepWrits]: ['keep', 'metadata.returned', 'metadata.drawnWritIds'],
    [ActionType.DiscardWrit]: ['writId']
}

/** The platform's own: a projection recalculates them, so no sample carries them. */
const Patches = ['undoPatch', 'forwardPatch']

const propertyOf = (schema: Type.TSchema, key: string): unknown => Reflect.get(schema, key)

function schemaOf(value: unknown): Type.TSchema {
    assert(typeof value === 'object' && value !== null, 'Not a schema')
    return value
}

interface Sampling {
    /** Which member of every union this sample takes; sampling each index covers every member. */
    readonly variant: number
    /** Every protected field the sample filled in. */
    readonly secured: Set<string>
}

function sampleNumber(schema: Type.TSchema): number {
    const minimum = propertyOf(schema, 'minimum')
    const maximum = propertyOf(schema, 'maximum')
    const least = typeof minimum === 'number' ? Math.max(minimum, 1) : 1
    return typeof maximum === 'number' ? Math.min(maximum, least) : least
}

function sampleObject(schema: Type.TSchema, sampling: Sampling, path: string): object {
    const properties = propertyOf(schema, 'properties')
    if (typeof properties === 'object' && properties !== null) {
        return Object.fromEntries(
            Object.entries(properties).map(([name, child]) => [
                name,
                sampleAt(schemaOf(child), sampling, path ? `${path}.${name}` : name)
            ])
        )
    }
    const patterns = propertyOf(schema, 'patternProperties')
    if (typeof patterns === 'object' && patterns !== null) {
        const [child] = Object.values(patterns)
        return { key: sampleAt(schemaOf(child), sampling, path) }
    }
    return {}
}

/** A value for `schema`, with every optional field present. */
function sampleAt(schema: Type.TSchema, sampling: Sampling, path: string): unknown {
    if (Reflect.has(schema, Visibility.MetadataKey) && !Patches.includes(path)) {
        sampling.secured.add(path)
    }
    const constant = propertyOf(schema, 'const')
    if (constant !== undefined) {
        return constant
    }
    const choices = propertyOf(schema, 'enum')
    if (Array.isArray(choices)) {
        return choices[sampling.variant % choices.length]
    }
    const anyOf = propertyOf(schema, 'anyOf')
    if (Array.isArray(anyOf)) {
        return sampleAt(schemaOf(anyOf[sampling.variant % anyOf.length]), sampling, path)
    }
    const allOf = propertyOf(schema, 'allOf')
    if (Array.isArray(allOf)) {
        return Object.assign({}, ...allOf.map((part) => sampleAt(schemaOf(part), sampling, path)))
    }
    switch (propertyOf(schema, 'type')) {
        case 'object':
            return sampleObject(schema, sampling, path)
        case 'array': {
            const minItems = propertyOf(schema, 'minItems')
            const length = typeof minItems === 'number' ? Math.max(minItems, 1) : 1
            const items = schemaOf(propertyOf(schema, 'items'))
            return Array.from({ length }, () => sampleAt(items, sampling, path))
        }
        case 'string':
            return /playerid$/i.test(path) ? ACTOR : 'text'
        case 'number':
        case 'integer':
            return sampleNumber(schema)
        case 'boolean':
            return true
        case 'null':
            return null
        default:
            return undefined
    }
}

/** The most members any union in `schema` has. */
function variantCount(schema: unknown, seen = new Set<unknown>()): number {
    if (typeof schema !== 'object' || schema === null || seen.has(schema)) {
        return 1
    }
    seen.add(schema)
    const own = [Reflect.get(schema, 'anyOf'), Reflect.get(schema, 'enum')]
        .filter(Array.isArray)
        .map((list) => list.length)
    const children = Object.values(schema).flatMap((child) =>
        Array.isArray(child)
            ? child.map((item) => variantCount(item, seen))
            : [variantCount(child, seen)]
    )
    return Math.max(1, ...own, ...children)
}

/** What a record of `type` holds with every optional field filled, once per union member. */
function samplesOf(type: ActionType, schema: Type.TSchema) {
    const validator = Compile(schema)
    return Array.from({ length: variantCount(schema) }, (_, variant) => {
        const secured = new Set<string>()
        const createdAt = new Date(0)
        const { undoPatch, forwardPatch, ...sampled } = Object(
            sampleAt(schema, { variant, secured }, '')
        )
        const record = {
            ...sampled,
            type,
            playerId: ACTOR,
            createdAt,
            updatedAt: createdAt
        }
        return { record, secured, valid: validator.Check(record) }
    }).filter(({ valid }) => valid)
}

function without(record: object, path: string): object {
    const copy = structuredClone(record)
    const keys = path.split('.')
    const last = keys.pop()
    assertExists(last, 'A path has a field')
    const holder = keys.reduce<unknown>(
        (value, key) => (typeof value === 'object' && value ? Reflect.get(value, key) : undefined),
        copy
    )
    if (typeof holder === 'object' && holder !== null) {
        Reflect.deleteProperty(holder, last)
    }
    return copy
}

const types = Object.values(ActionType)

/** The at-will actions the walking seats never choose; `protectedPlay.spec.ts` plays them. */
const NotWalked = [
    ActionType.ReclaimImmunitySeal,
    ActionType.SpendRegionTile,
    ActionType.PlaceVessel
]

function typeOf({ type }: GameAction): ActionType {
    const found = types.find((candidate) => candidate === type)
    assertExists(found, `${type} is an action type`)
    return found
}

function withoutPatches(action: GameAction): GameAction {
    const { undoPatch: _undo, forwardPatch: _forward, ...rest } = action
    return rest
}

describe('every registered action, sampled with every optional field', () => {
    it('R-5-H1 every action type is registered, System Actions included', () => {
        expect(Object.keys(FeudumApiActions).sort()).toEqual([...types].sort())
    })

    it('R-5-H1 samples a valid record of every type', () => {
        expect(
            types.filter((type) => samplesOf(type, FeudumApiActions[type]).length === 0)
        ).toEqual([])
    })

    for (const type of types) {
        describe(type, () => {
            const samples = samplesOf(type, FeudumApiActions[type])
            const known = ActorKnown[type] ?? []

            it('R-5.1 secures exactly the fields the visibility table gives the actor', () => {
                const secured = new Set(samples.flatMap(({ secured }) => [...secured]))
                expect([...secured].sort()).toEqual([...known].sort())
            })

            it('R-5.1 shows its actor every field', () => {
                for (const { record } of samples) {
                    const own = FeudumRuntime.visibility.actions.project(record, {
                        kind: 'player',
                        playerId: ACTOR
                    })
                    expect(own).toEqual(record)
                }
            })

            it('R-5.1 shows another seat and a spectator all but the actor-known fields', () => {
                const others: Visibility.Perspective[] = [
                    { kind: 'player', playerId: OTHER_SEAT },
                    Spectator
                ]
                for (const { record } of samples) {
                    const expected = known.reduce<object>(without, record)
                    for (const perspective of others) {
                        expect(
                            FeudumRuntime.visibility.actions.project(record, perspective)
                        ).toEqual(expected)
                    }
                }
            })
        })
    }

    it('R-5.1 the table in visibility.md says the same', async () => {
        const rows = docTableRows(await readDoc('visibility.md'), '## Action records')
        const told = new Map<string, Set<string>>()
        for (const row of rows) {
            const fields = row['Actor-known (Policy.Actor)']
                .split(',')
                .map((part) => part.trim().split(' ')[0])
                .filter((field) => field !== 'none')
            for (const name of row.Action.match(/[A-Z][A-Za-z]+/g) ?? []) {
                if (types.some((type) => type === name)) {
                    const fieldsOfName = told.get(name) ?? new Set<string>()
                    fields.forEach((field) => fieldsOfName.add(field))
                    told.set(name, fieldsOfName)
                }
            }
        }
        for (const type of types) {
            expect([...(told.get(type) ?? [])].sort()).toEqual([...(ActorKnown[type] ?? [])].sort())
        }
    })
})

/** R-4.4.2, R-4.4.3 What a record shows the whole table: writs played; a discard is face down. */
function shownToTable(action: GameAction): string[] {
    if (isPlayMandate(action)) {
        return [action.writId]
    }
    if (isCommitAttack(action)) {
        return action.weapons.map(({ writId }) => writId)
    }
    if (isScoreGame(action)) {
        return (action.metadata?.sheet ?? []).flatMap(({ charters }) =>
            charters.map(({ writId }) => writId)
        )
    }
    return []
}

/** R-4.4.4, R-4.4.1, R-3.10 What a seat has had in its own hand or seen go under the deck. */
function heldBy({ after }: Transition, playerId?: string): string[] {
    const row = after.players.find((player) => player.playerId === playerId)
    if (!row) {
        return []
    }
    const { writDraw } = after.flow
    return [
        ...row.writs,
        ...row.sealedCharters,
        ...row.deckKnowledge.map(({ writId }) => writId),
        ...(writDraw && writDraw.playerId === playerId ? (writDraw.drawn ?? []) : [])
    ]
}

/** What scanning real games through every view found; every list should be empty. */
interface Scan {
    readonly writsUnseen: string[]
    readonly sealsInViews: string[]
    readonly sealsDrawnUnseen: string[]
    readonly flipsUnnamed: string[]
    readonly stackedTiles: string[]
    readonly recordsAmiss: string[]
    readonly statesAmiss: string[]
    readonly flips: { count: number }
    readonly reached: Set<string>
}

/** A value as storage keeps it: a field set to undefined isn't there. */
function asStored(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}

function scanTransition(
    walk: GameWalk,
    transition: Transition,
    told: Map<string, Set<string>>,
    scan: Scan
): void {
    const { action, before, after } = transition
    const sealedBefore = new Set(concealedSeals(before.vault))
    const sealedAfter = new Set(concealedSeals(after.vault))
    const flipped = concealedSeals(before.vault).filter((sealId) => !sealedAfter.has(sealId))
    const stacked = new Set<string>(Object.values(after.regionStacks).flat())
    const known = ActorKnown[typeOf(action)] ?? []
    const where = `${action.type}#${action.index ?? '?'}`
    scan.flips.count += flipped.length
    scan.reached.add(action.type)
    for (const perspective of perspectivesOf(walk)) {
        const seat = perspective.kind === 'player' ? perspective.playerId : 'spectator'
        const named = new Set(told.get(seat))
        shownToTable(action).forEach((writId) => named.add(writId))
        heldBy(transition, seat).forEach((writId) => named.add(writId))
        told.set(seat, named)
        const view = viewOf(after, perspective, walk)
        const record = recordFor(action, perspective, walk)
        const inRecord = sealsNamedIn(record)
        for (const writId of [...writsNamedIn(view), ...writsNamedIn(record)]) {
            if (!named.has(writId)) {
                scan.writsUnseen.push(`${where} ${seat} ${writId}`)
            }
        }
        for (const sealId of sealsNamedIn(view)) {
            if (sealedAfter.has(sealId)) {
                scan.sealsInViews.push(`${where} ${seat} ${sealId}`)
            }
        }
        for (const sealId of inRecord) {
            if (sealedBefore.has(sealId) && sealedAfter.has(sealId)) {
                scan.sealsDrawnUnseen.push(`${where} ${seat} ${sealId}`)
            }
        }
        for (const sealId of flipped) {
            if (!inRecord.includes(sealId)) {
                scan.flipsUnnamed.push(`${where} ${seat} ${sealId}`)
            }
        }
        for (const tileId of [...Object.keys(view.tileLandscapes), ...tilesNamedIn(record)]) {
            if (stacked.has(tileId)) {
                scan.stackedTiles.push(`${where} ${seat} ${tileId}`)
            }
        }
        const isActor = seat === action.playerId
        const expected = known.reduce<object>(
            (kept, path) => (isActor ? kept : without(kept, path)),
            withoutPatches(action)
        )
        if (!Value.Equal(record, expected)) {
            scan.recordsAmiss.push(`${where} ${seat}`)
        }
        if (!Value.Equal(asStored(view), asStored(withoutConcealed(after, perspective)))) {
            scan.statesAmiss.push(`${where} ${seat}`)
        }
    }
}

const scan: Scan = {
    writsUnseen: [],
    sealsInViews: [],
    sealsDrawnUnseen: [],
    flipsUnnamed: [],
    stackedTiles: [],
    recordsAmiss: [],
    statesAmiss: [],
    flips: { count: 0 },
    reached: new Set()
}
const games = realGames()
for (const walk of games) {
    const told = new Map<string, Set<string>>()
    for (const transition of transitionsOf(walk)) {
        scanTransition(walk, transition, told, scan)
    }
}

describe('the records and views of real games, for every seat and a spectator', () => {
    it('R-5.1 the games sit 2 to 5 players and reach all but the at-will actions they skip', () => {
        expect(new Set(games.map(({ game }) => game.players.length))).toEqual(new Set([2, 3, 4, 5]))
        expect(types.filter((type) => !scan.reached.has(type))).toEqual(NotWalked)
    })

    it('R-5.1 a writ reaches a view only if its seat held it or the table saw it', () => {
        expect(scan.writsUnseen).toEqual([])
    })

    it('R-5-H1 no view names a seal red side up', () => {
        expect(scan.sealsInViews).toEqual([])
    })

    it('R-5-H1 no record names a seal drawn unseen', () => {
        expect(scan.sealsDrawnUnseen).toEqual([])
    })

    it('R-5-H1 every flip names the seal, so every view has its value', () => {
        expect(scan.flips.count).toBeGreaterThan(0)
        expect(scan.flipsUnnamed).toEqual([])
    })

    it('R-1.4-H2 no view or record names a tile still in a stack', () => {
        expect(scan.stackedTiles).toEqual([])
    })

    it('R-5.1 a record loses its actor-known fields for every other view, and its patches', () => {
        expect(scan.recordsAmiss).toEqual([])
    })

    it('R-5.1, R-5-H1 a state loses exactly what its view may not see', () => {
        expect(scan.statesAmiss).toEqual([])
    })
})
