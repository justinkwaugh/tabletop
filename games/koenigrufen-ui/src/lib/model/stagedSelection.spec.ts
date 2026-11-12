import { describe, expect, it } from 'vitest'
import { undoableStagedSelection, type StagedSelectionState } from '@tabletop/frontend-components'
import {
    AnnouncementStageOrder,
    chosenAnnouncements,
    chosenToLayAway,
    LayAwayStageOrder,
    pickedToPlay,
    pickToPlay,
    PlayStageOrder,
    toggleAnnouncement,
    toggleLayAway,
    type AnnouncementSelectionValues,
    type LayAwaySelectionValues,
    type PlaySelectionValues
} from './stagedSelection.js'

// Undo as the session does it: through the selection it registers.
function undoable<T extends Record<string, unknown>>(
    order: Parameters<typeof undoableStagedSelection<T>>[0],
    start: StagedSelectionState<T>
) {
    let selection = start
    const registered = undoableStagedSelection<T>(
        order,
        () => selection,
        (next) => (selection = next)
    )
    return {
        hasManual: () => registered.hasManual(),
        undo: () => {
            registered.undo()
            return selection
        }
    }
}

describe('choosing cards to lay away', () => {
    it('adds each chosen card as the next stage', () => {
        const selection = toggleLayAway(toggleLayAway({}, 'hearts-Q'), 'clubs-10')
        expect(chosenToLayAway(selection)).toEqual(['hearts-Q', 'clubs-10'])
        expect(undoable<LayAwaySelectionValues>(LayAwayStageOrder, selection).hasManual()).toBe(
            true
        )
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
        const choice = undoable<LayAwaySelectionValues>(LayAwayStageOrder, selection)
        expect(chosenToLayAway(choice.undo())).toEqual(['hearts-Q'])
        expect(chosenToLayAway(choice.undo())).toEqual([])
        expect(choice.hasManual()).toBe(false)
    })

    it('puts a card taken back out back in on Undo, keeping the rest as they were', () => {
        let selection = toggleLayAway({}, 'hearts-Q')
        selection = toggleLayAway(selection, 'clubs-10')
        selection = toggleLayAway(selection, 'spades-7')
        selection = toggleLayAway(selection, 'hearts-Q')
        const choice = undoable<LayAwaySelectionValues>(LayAwayStageOrder, selection)
        expect(chosenToLayAway(choice.undo())).toEqual(['hearts-Q', 'clubs-10', 'spades-7'])
        expect(chosenToLayAway(choice.undo())).toEqual(['hearts-Q', 'clubs-10'])
    })

    it('takes back taking out the only chosen card', () => {
        const selection = toggleLayAway(toggleLayAway({}, 'hearts-Q'), 'hearts-Q')
        expect(chosenToLayAway(selection)).toEqual([])
        const choice = undoable<LayAwaySelectionValues>(LayAwayStageOrder, selection)
        expect(choice.hasManual()).toBe(true)
        expect(chosenToLayAway(choice.undo())).toEqual(['hearts-Q'])
        expect(chosenToLayAway(choice.undo())).toEqual([])
        expect(choice.hasManual()).toBe(false)
    })

    it('holds as many cards as Sechserdreier lays away', () => {
        let selection = {}
        for (const cardId of ['a', 'b', 'c', 'd', 'e', 'f']) {
            selection = toggleLayAway(selection, cardId)
        }
        expect(chosenToLayAway(selection)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    })
})

describe('picking a card to play', () => {
    it('holds the picked card as a manual stage', () => {
        const selection = pickToPlay('hearts-K')
        expect(pickedToPlay(selection)).toBe('hearts-K')
        expect(undoable<PlaySelectionValues>(PlayStageOrder, selection).hasManual()).toBe(true)
    })

    it('replaces the pick when another card is picked', () => {
        expect(pickedToPlay(pickToPlay('clubs-10'))).toBe('clubs-10')
    })

    it('drops the pick on Undo', () => {
        const pick = undoable<PlaySelectionValues>(PlayStageOrder, pickToPlay('hearts-K'))
        expect(pickedToPlay(pick.undo())).toBeUndefined()
        expect(pick.hasManual()).toBe(false)
    })
})

describe('choosing announcements', () => {
    it('toggles choices in any order and pops the latest press on Undo', () => {
        let selection = toggleAnnouncement({}, 'bonus:trull')
        selection = toggleAnnouncement(selection, 'game:')
        selection = toggleAnnouncement(selection, 'bonus:uhu')
        expect(chosenAnnouncements(selection)).toEqual(['bonus:trull', 'game:', 'bonus:uhu'])
        selection = toggleAnnouncement(selection, 'bonus:trull')
        expect(chosenAnnouncements(selection)).toEqual(['game:', 'bonus:uhu'])
        const choice = undoable<AnnouncementSelectionValues>(AnnouncementStageOrder, selection)
        expect(choice.hasManual()).toBe(true)
        expect(chosenAnnouncements(choice.undo())).toEqual(['bonus:trull', 'game:', 'bonus:uhu'])
        expect(chosenAnnouncements(choice.undo())).toEqual(['bonus:trull', 'game:'])
        expect(chosenAnnouncements(choice.undo())).toEqual(['bonus:trull'])
        expect(chosenAnnouncements(choice.undo())).toEqual([])
        expect(choice.hasManual()).toBe(false)
        expect(undoable<AnnouncementSelectionValues>(AnnouncementStageOrder, {}).hasManual()).toBe(
            false
        )
    })
})
