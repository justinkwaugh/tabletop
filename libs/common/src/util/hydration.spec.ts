import { describe, expect, it } from 'vitest'
import Type, { Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from './hydration.js'

describe('Hydration Tests', () => {
    it('hydrates and dehydrates', () => {
        type TestObject = Static<typeof TestObject>
        const TestObject = Type.Object({
            val: Type.Number()
        })

        class HydratedTestObject extends Hydratable<typeof TestObject> implements TestObject {
            val: number

            constructor(data: TestObject) {
                super(data, Compile(TestObject))
                this.val = data.val
            }

            doubleVal() {
                return this.val * 2
            }
        }

        const data: TestObject = { val: 42 }
        const hydrated = new HydratedTestObject(data)
        expect(hydrated.val).toBe(42)
        expect(hydrated.doubleVal()).toBe(84)
        hydrated.val = 100
        expect(data.val).toBe(42) // original data unchanged

        const dehydrated = hydrated.dehydrate()
        expect(dehydrated).toEqual({ val: 100 })
        dehydrated.val = 200
        expect(hydrated.val).toBe(100) // hydrated object unchanged

        const doubleHydrated = new HydratedTestObject(hydrated)
        expect(doubleHydrated.val).toBe(100)
        expect(doubleHydrated.doubleVal()).toBe(200)
        doubleHydrated.val = 300
        expect(hydrated.val).toBe(100) // original hydrated object unchanged
        expect(hydrated.doubleVal()).toBe(200) // dehydrated object unchanged
    })

    it('validates schema on construction', () => {
        type TestObject = Static<typeof TestObject>
        const TestObject = Type.Object({
            val: Type.Number()
        })

        class HydratedTestObject extends Hydratable<typeof TestObject> implements TestObject {
            val: number

            constructor(data: TestObject) {
                super(data, Compile(TestObject))
                this.val = data.val
            }
        }

        const validData: TestObject = { val: 10 }
        expect(() => new HydratedTestObject(validData)).not.toThrow()

        const invalidData = { val: 'not a number' }

        // @ts-expect-error Testing invalid data
        expect(() => new HydratedTestObject(invalidData)).toThrow()
    })

    it('hydrates nested hydratables', () => {
        type ChildObject = Static<typeof ChildObject>
        const ChildObject = Type.Object({
            name: Type.String()
        })

        class HydratedChildObject extends Hydratable<typeof ChildObject> implements ChildObject {
            name: string

            constructor(data: ChildObject) {
                super(data, Compile(ChildObject))
                this.name = data.name
            }

            greet() {
                return `Hello, ${this.name}!`
            }
        }

        type ParentObject = Static<typeof ParentObject>
        const ParentObject = Type.Object({
            child: ChildObject
        })

        class HydratedParentObject extends Hydratable<typeof ParentObject> implements ParentObject {
            child: HydratedChildObject

            constructor(data: ParentObject) {
                super(data, Compile(ParentObject))
                this.child = new HydratedChildObject(data.child)
            }
        }

        const data: ParentObject = { child: { name: 'Alice' } }
        const hydratedParent = new HydratedParentObject(data)
        expect(hydratedParent.child.name).toBe('Alice')
        expect(hydratedParent.child.greet()).toBe('Hello, Alice!')

        const dehydratedParent = hydratedParent.dehydrate()
        expect(dehydratedParent).toEqual({ child: { name: 'Alice' } })
        dehydratedParent.child.name = 'Bob'
        expect(hydratedParent.child.name).toBe('Alice') // hydrated object unchanged

        const rehydratedParent = new HydratedParentObject(hydratedParent)
        expect(rehydratedParent.child.name).toBe('Alice')
        expect(rehydratedParent.child.greet()).toBe('Hello, Alice!')
        expect(hydratedParent.child.greet()).toBe('Hello, Alice!') // original hydrated object unchanged

        // Edge case: non hydrated parent with hydrated child
        dehydratedParent.child = new HydratedChildObject({ name: 'Charlie' })
        const edgeCaseParent = new HydratedParentObject(dehydratedParent)
        expect(edgeCaseParent.child.name).toBe('Charlie')
        expect(edgeCaseParent.child.greet()).toBe('Hello, Charlie!') // works as expected

        // @ts-expect-error Testing invalid but possible edge case
        expect(dehydratedParent.child.greet()).toBe('Hello, Charlie!') // original dehydrated object unchanged
    })
})
