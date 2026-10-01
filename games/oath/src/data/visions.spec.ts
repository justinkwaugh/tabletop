import { describe, expect, it } from 'vitest'
import {
    ALL_VISION_IDS,
    CONSPIRACY_ID,
    GOAL_VISION_IDS,
    TOTAL_VISION_CARDS,
    VISION_DEFINITIONS,
    VISION_RECORDS,
    visionRecord
} from './visions.js'
import { cardDefinition, cardIdsOfKind, suitOf } from './cardRegistry.js'
import { CardKind } from '../model/oathEnums.js'
import { Goal, VISION_GOALS, VISIONS_DRAWN_GATE } from '../util/oathkeeper.js'
import { required } from '../testing/required.js'

describe('Vision cards (R-8.5)', () => {
    it('holds exactly five Visions, the Conspiracy included', () => {
        expect(VISION_RECORDS).toHaveLength(TOTAL_VISION_CARDS)
        expect(VISION_DEFINITIONS).toHaveLength(TOTAL_VISION_CARDS)
        expect(new Set(ALL_VISION_IDS).size).toBe(TOTAL_VISION_CARDS)
        expect(ALL_VISION_IDS).toContain(CONSPIRACY_ID)
    })

    it('registers all five as suitless, unplaceable and unlocked', () => {
        expect(cardIdsOfKind(CardKind.Vision).sort()).toEqual([...ALL_VISION_IDS].sort())
        for (const id of ALL_VISION_IDS) {
            const def = cardDefinition(id)
            expect(def?.kind).toBe(CardKind.Vision)
            // R-10.14
            expect(def?.suit).toBeUndefined()
            expect(suitOf(id)).toBeUndefined()
            // R-2.2.1 — the Revealed Vision space is no adviser, so R-7.2.1 does not apply.
            expect(def?.placement).toBeNull()
            expect(def?.locked).toBe(false)
        }
    })

    it('names every card as printed, and the ids are unchanged', () => {
        expect(ALL_VISION_IDS).toEqual([
            'vision.conquest',
            'vision.rebellion',
            'vision.sanctuary',
            'vision.faith',
            'vision.conspiracy'
        ])
        expect(visionRecord(CONSPIRACY_ID)?.name).toBe('Conspiracy')
    })

    it('gives four Visions a goal and the Conspiracy a When Played power', () => {
        expect(GOAL_VISION_IDS).toEqual(Object.keys(VISION_GOALS))
        expect(VISION_RECORDS.filter((v) => v.isConspiracy)).toHaveLength(1)

        const conspiracy = required(visionRecord(CONSPIRACY_ID), 'the Conspiracy record')
        expect(conspiracy.goalText).toBe('')
        expect(conspiracy.timing).toBe('whenPlayed')
        expect(conspiracy.powerText).toContain('When Played:')
        expect(VISION_GOALS[CONSPIRACY_ID]).toBeUndefined()
    })

    it('prints the goal that oathkeeper.ts implements for it', () => {
        const printedGoal: Record<string, RegExp> = {
            [Goal.MostSites]: /you rule the most sites/i,
            [Goal.PeoplesFavor]: /you hold the People's Favor/i,
            [Goal.MostRelicsAndBanners]: /you hold the most relics and banners/i,
            [Goal.DarkestSecret]: /you hold the Darkest Secret/i
        }

        for (const id of GOAL_VISION_IDS) {
            const record = required(visionRecord(id), id)
            expect(record.timing, `${id} is a Wake power`).toBe('wake')
            expect(record.goalText, `${id} prints a goal`).not.toBe('')
            expect(record.goalText, `${id} goal wording`).toMatch(printedGoal[VISION_GOALS[id]])
        }
    })

    it('prints the three-Visions gate on every goal card, with the same number', () => {
        // R-3.2
        const numberWord = ['zero', 'one', 'two', 'three', 'four', 'five'][VISIONS_DRAWN_GATE]

        for (const id of GOAL_VISION_IDS) {
            const { goalText } = required(visionRecord(id), id)
            expect(goalText, `${id} gates on the Visions Drawn track`).toMatch(
                new RegExp(`at least ${numberWord} visions have been drawn`, 'i')
            )
        }
    })

    it('tells every Vision, the Conspiracy included, to advance Visions Drawn', () => {
        for (const record of VISION_RECORDS) {
            expect(record.reminderText, `${record.id} reminder`).toContain(
                'If drawn from world deck, increase Visions Drawn.'
            )
        }
    })

    it('restricts the four to Exiles and lets anyone play the Conspiracy', () => {
        for (const id of GOAL_VISION_IDS) {
            const { reminderText } = required(visionRecord(id), id)
            expect(reminderText).toContain('**Exiles**')
            expect(reminderText).toContain('Revealed Vision space')
        }
        expect(visionRecord(CONSPIRACY_ID)?.reminderText).toContain('**Anyone**')
    })

    it('has no printed numbering, so cannot corroborate the R-3.4.3 order', () => {
        for (const record of VISION_RECORDS) {
            expect(record.cardNumber, `${record.id} prints no card number`).toBeNull()
        }
        expect([...GOAL_VISION_IDS].sort()).toEqual(
            ['vision.conquest', 'vision.rebellion', 'vision.sanctuary', 'vision.faith'].sort()
        )
    })
})
