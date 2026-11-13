import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { SchemaCleaner } from './schemaCleaner.js'
import { DateType } from './typebox.js'

const Owner = Type.Union([
    Type.Object({ kind: Type.Literal('player'), playerId: Type.String() }),
    Type.Object({ kind: Type.Literal('bank') })
])
const Tree = Type.Cyclic(
    {
        Node: Type.Object({ id: Type.String(), children: Type.Array(Type.Ref('Node')) })
    },
    'Node'
)

const Cases: readonly (readonly [name: string, schema: Type.TSchema, value: unknown])[] = [
    [
        'an object with unknown and nested unknown properties',
        Type.Object({ id: Type.String(), size: Type.Object({ width: Type.Number() }) }),
        { id: 'a', cached: 1, size: { width: 2, height: 3 } }
    ],
    [
        'an object that allows any additional property',
        Type.Object({ id: Type.String() }, { additionalProperties: true }),
        { id: 'a', note: { deep: { junk: 1 } } }
    ],
    [
        'an object whose additional properties follow a schema',
        Type.Object(
            { id: Type.String() },
            { additionalProperties: Type.Object({ count: Type.Number() }) }
        ),
        { id: 'a', kept: { count: 1, junk: 2 }, dropped: 'text' }
    ],
    [
        'an object with keys every object inherits',
        Type.Object({ id: Type.String() }),
        { id: 'a', toString: 1, valueOf: 2, constructor: 3 }
    ],
    [
        'an array of objects',
        Type.Array(Type.Object({ id: Type.String() })),
        [{ id: 'a', junk: 1 }, { id: 'b' }, 'not an object']
    ],
    [
        'a tuple longer than its schema',
        Type.Tuple([Type.Object({ id: Type.String() }), Type.Number()]),
        [{ id: 'a', junk: 1 }, 2, 3]
    ],
    [
        'a record with keys outside its pattern',
        Type.Record(Type.String({ pattern: '^p' }), Type.Object({ count: Type.Number() })),
        { p1: { count: 1, junk: 2 }, q1: { count: 1 } }
    ],
    [
        'a union member chosen by its discriminator',
        Type.Array(Owner),
        [
            { kind: 'player', playerId: 'p1', junk: 1 },
            { kind: 'bank', junk: 2 }
        ]
    ],
    ['a union value no member accepts', Owner, { kind: 'company', junk: 1 }],
    [
        'a union whose earlier member accepts the value once stripped',
        Type.Union([
            Type.Object({ id: Type.String() }),
            Type.Object({ id: Type.String(), count: Type.Number() })
        ]),
        { id: 'a', count: 1 }
    ],
    [
        'a union of values with nothing to remove',
        Type.Array(Type.Union([Type.Literal('a'), Type.Number(), Type.Null()])),
        ['a', 1, null, 'b']
    ],
    [
        'an intersection',
        Type.Intersect([Type.Object({ id: Type.String() }), Type.Object({ count: Type.Number() })]),
        { id: 'a', count: 1, junk: 2 }
    ],
    [
        'a recursive schema',
        Tree,
        { id: 'a', junk: 1, children: [{ id: 'b', junk: 2, children: [] }] }
    ],
    [
        'an optional property and a date',
        Type.Object({ at: DateType(), note: Type.Optional(Type.String()) }),
        { at: new Date(0), junk: 1 }
    ],
    ['a value of the wrong kind', Type.Object({ id: Type.String() }), 'text'],
    [
        'a union with a member that accepts anything',
        Type.Unsafe({ anyOf: [Type.Object({ id: Type.Number() }), true] }),
        { id: 'a', junk: 1 }
    ],
    [
        'a reference no definition answers',
        Type.Union([Type.Ref('toString'), Type.Object({ id: Type.String() })]),
        { id: 'a', junk: 1 }
    ]
]

describe('SchemaCleaner', () => {
    it.each(Cases)('cleans %s as Value.Clean does', (_, schema, value) => {
        const validator = Compile(schema)
        const cleaned = SchemaCleaner.for(validator)(structuredClone(value))
        expect(cleaned).toEqual(Value.Clean(schema, structuredClone(value)))
    })

    it('removes what the schema does not name', () => {
        const validator = Compile(Type.Array(Owner))
        expect(
            SchemaCleaner.for(validator)([
                { kind: 'player', playerId: 'p1', cached: true },
                { kind: 'bank', cached: true }
            ])
        ).toEqual([{ kind: 'player', playerId: 'p1' }, { kind: 'bank' }])
    })

    it('checks a union member against the copy Value.Clean would check', () => {
        const schema = Type.Union([
            Type.Unsafe({ type: 'object', maxProperties: 1 }),
            Type.Object({ count: Type.Optional(Type.Number()) })
        ])
        const cleaned = SchemaCleaner.for(Compile(schema))(JSON.parse('{"__proto__":5,"id":1}'))
        expect(cleaned).toEqual({ id: 1 })
        expect(cleaned).toEqual(Value.Clean(schema, JSON.parse('{"__proto__":5,"id":1}')))
    })

    it('builds one cleaner for a schema, whichever validator asks', () => {
        const validator = Compile(Owner)
        expect(SchemaCleaner.for(validator)).toBe(SchemaCleaner.for(validator))
        expect(SchemaCleaner.for(Compile(Owner))).toBe(SchemaCleaner.for(validator))
    })

    it('keeps a schema compiled with definitions apart from the same schema without them', () => {
        const Reference = Type.Object({ owner: Type.Ref('Owner') })
        const value = { owner: { kind: 'bank', junk: 1 } }
        const withDefinitions = SchemaCleaner.for(Compile({ Owner }, Reference))
        const withoutDefinitions = SchemaCleaner.for(Compile(Reference))
        expect(withDefinitions(structuredClone(value))).toEqual({ owner: { kind: 'bank' } })
        expect(withoutDefinitions(structuredClone(value))).toEqual(value)
        expect(withDefinitions(structuredClone(value))).toEqual(
            Value.Clean({ Owner }, Reference, structuredClone(value))
        )
    })
})
