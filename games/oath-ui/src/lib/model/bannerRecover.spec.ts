import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert } from '@tabletop/common'
import { ActionType, Banner, MachineState, Suit, isRecover } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

/** R-5.4.2 any amount above the value; R-5.4.4 the People's Favor's start bank is the player's. */
function recovering(banner: Banner) {
    const state = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 5, secrets: 6 })],
        {
            machineState: MachineState.ActPhase,
            banners: {
                [Banner.PeoplesFavor]: { value: 2, mobSide: false },
                [Banner.DarkestSecret]: { value: 2 }
            }
        }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.Recover)
    session.pickBanner(banner)
    return { session, sent }
}

function sentRecover(sent: ReturnType<typeof recovering>['sent']) {
    const action = sent.mock.calls[0][0]
    assert(isRecover(action), 'a Recover is sent')
    return action
}

describe('recovering a banner', () => {
    it('offers every bid from value + 1 to what the player holds, and sends the one chosen', async () => {
        const { session, sent } = recovering(Banner.DarkestSecret)
        expect(session.bannerAmounts).toEqual([3, 4, 5, 6])
        expect(session.bannerAmount).toBe(3)
        expect(sent).not.toHaveBeenCalled()

        session.setBannerAmount(5)
        session.setBannerAmount(9)
        expect(session.bannerAmount).toBe(5)
        await session.recoverBanner()
        const action = sentRecover(sent)
        expect(action.amountPaid).toBe(5)
        expect(action.redistributeFrom).toBeUndefined()
    })

    it("asks where the People's Favor's old favor starts returning, and sends that bank", async () => {
        const { session, sent } = recovering(Banner.PeoplesFavor)
        expect(session.needsFavorStart).toBe(true)
        expect(session.bannerRecoverReason).toMatch(/favor bank/)
        await session.recoverBanner()
        expect(sent).not.toHaveBeenCalled()

        session.setFavorStart(Suit.Hearth)
        expect(session.bannerRecoverReason).toBeUndefined()
        await session.recoverBanner()
        expect(sentRecover(sent).redistributeFrom).toBe(Suit.Hearth)
    })

    it('Undo from the bid returns to the lit banners', async () => {
        const { session } = recovering(Banner.DarkestSecret)
        session.setBannerAmount(4)
        await session.undo()
        expect(session.bannerAmount).toBe(3)
        await session.undo()
        expect(session.stagedBanner).toBeUndefined()
        expect(session.bannerBid(Banner.DarkestSecret)).toBe(3)
    })
})
