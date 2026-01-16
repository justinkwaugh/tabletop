import { describe, expect, it } from 'vitest'
import Value from 'typebox/value'
import * as Type from 'typebox'
import { DateType } from './typebox.js'

describe('Chat Message Data Object Tests', () => {
    it('converts dates', () => {
        type ObjectWithDate = Type.Static<typeof ObjectWithDate>
        const ObjectWithDate = Type.Object({
            timestamp: DateType()
        })

        const dateString = '2024-06-10T12:34:56.789Z'
        const data = {
            timestamp: dateString
        }

        const converted = Value.Convert(ObjectWithDate, data) as ObjectWithDate
        expect(converted.timestamp instanceof Date).toBe(true)
    })

    it('converts composite dates', () => {
        type ObjectWithDate = Type.Static<typeof ObjectWithDate>
        const ObjectWithDate = Type.Object({
            timestamp: DateType()
        })

        type CompositeDate = Type.Static<typeof CompositeDate>
        const CompositeDate = Type.Evaluate(
            Type.Intersect([
                ObjectWithDate,
                Type.Object({
                    foo: Type.String()
                })
            ])
        )

        const dateString = '2024-06-10T12:34:56.789Z'
        const data = {
            timestamp: dateString,
            foo: 'bar'
        }

        const converted = Value.Convert(CompositeDate, data) as CompositeDate
        expect(converted.timestamp instanceof Date).toBe(true)
    })
})
