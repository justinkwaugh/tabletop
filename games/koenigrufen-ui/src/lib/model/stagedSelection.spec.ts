import { describe, expect, it } from 'vitest'
import {
    chosenAnnouncements,
    chosenToLayAway,
    hasManualAnnouncementSelection,
    hasManualLayAwaySelection,
    hasManualPlaySelection,
    pickedToPlay,
    pickToPlay,
    popAnnouncementSelection,
    popLayAwaySelection,
    popPlaySelection,
    toggleAnnouncement,
    toggleLayAway
} from './stagedSelection.js'

describe('choosing cards to lay away', () => {
    it('adds each chosen card as the next stage', () => {
        const selection = toggleLayAway(toggleLayAway({}, 'hearts-Q'), 'clubs-10')
        expect(chosenToLayAway(selection)).toEqual(['hearts-Q', 'clubs-10'])
        expect(hasManualLayAwaySelection(selection)).toBe(true)
    })

    it('takes a chosen card back out when it is chosen again, keeping the others in order', () => {
        let selection = toggleLayAway({}, 'hearts-Q')
        selection = toggleLayAway(selection, 'clubs-10')
        selection = toggleLayAway(selection, 'spades-7')
        selection = toggleLayAway(selection, 'hearts-Q')
        expect(chosenToLayAway(selection)).toEqual(['clubs-10', 'spades-7'])
    })

    it('pops only the latest card on Undo', () => {
        const selection = toggleLayAway(toggleLayAway({}, 'hearts-Q'), 'clubs-10')
        expect(chosenToLayAway(popLayAwaySelection(selection))).toEqual(['hearts-Q'])
        expect(hasManualLayAwaySelection(popLayAwaySelection(popLayAwaySelection(selection)))).toBe(
            false
        )
    })

    it('refuses a seventh card', () => {
        let selection = {}
        for (const cardId of ['a', 'b', 'c', 'd', 'e', 'f']) {
            selection = toggleLayAway(selection, cardId)
        }
        expect(() => toggleLayAway(selection, 'g')).toThrow()
    })
})

describe('picking a card to play', () => {
    it('holds the picked card as a manual stage', () => {
        const selection = pickToPlay('hearts-K')
        expect(pickedToPlay(selection)).toBe('hearts-K')
        expect(hasManualPlaySelection(selection)).toBe(true)
    })

    it('replaces the pick when another card is picked', () => {
        expect(pickedToPlay(pickToPlay('clubs-10'))).toBe('clubs-10')
    })

    it('drops the pick on Undo', () => {
        const popped = popPlaySelection(pickToPlay('hearts-K'))
        expect(pickedToPlay(popped)).toBeUndefined()
        expect(hasManualPlaySelection(popped)).toBe(false)
    })
})

describe('choosing announcements', () => {
    it('toggles each choice as its own stage and pops the latest on Undo', () => {
        let selection = toggleAnnouncement({}, 'bonus:trull')
        selection = toggleAnnouncement(selection, 'game:')
        selection = toggleAnnouncement(selection, 'bonus:uhu')
        expect(chosenAnnouncements(selection)).toEqual(['bonus:trull', 'game:', 'bonus:uhu'])
        selection = toggleAnnouncement(selection, 'bonus:trull')
        expect(chosenAnnouncements(selection)).toEqual(['game:', 'bonus:uhu'])
        expect(chosenAnnouncements(popAnnouncementSelection(selection))).toEqual(['game:'])
        expect(hasManualAnnouncementSelection({})).toBe(false)
    })
})
