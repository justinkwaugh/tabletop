import { describe, expect, it } from 'vitest'
import { Contract } from '../components/contracts.js'
import { startTestGame } from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

describe('the auction', () => {
    it('starts with Forehand, who must say Mein Spiel or bid', () => {
        const session = startTestGame()
        const forehand = session.hydrated().forehandId()
        expect(session.activePlayerId()).toBe(forehand)
        expect(session.validActions(forehand)).toEqual([ActionType.SayMeinSpiel, ActionType.Bid])
    })

    it('lets Forehand name any contract once Mein Spiel is passed out', () => {
        const session = startTestGame()
        const [forehand, second, third, dealer] = session.hydrated().seats()
        session.act(forehand, ActionType.SayMeinSpiel)
        session.act(second, ActionType.Pass)
        session.act(third, ActionType.Pass)
        session.act(dealer, ActionType.Pass)
        expect(session.state.machineState).toBe(MachineState.ChoosingContract)
        expect(session.hydrated().nameableContracts()).toContain(Contract.Rufer)
        session.act(forehand, ActionType.ChooseContract, { contract: Contract.Rufer })
        expect(session.state.contract).toEqual({ contract: Contract.Rufer, declarerId: forehand })
        expect(session.state.machineState).toBe(MachineState.CallingKing)
    })

    it('lets Forehand open with Sechserdreier instead of Mein Spiel, and only then', () => {
        const session = startTestGame()
        const [forehand, second] = session.hydrated().seats()
        expect(session.hydrated().biddableContracts(forehand)).toContain(Contract.Sechserdreier)
        session.act(forehand, ActionType.SayMeinSpiel)
        expect(session.hydrated().biddableContracts(second)).not.toContain(Contract.Sechserdreier)
        session.act(second, ActionType.Pass)
        session.act(session.activePlayerId(), ActionType.Pass)
        session.act(session.activePlayerId(), ActionType.Pass)
        expect(session.hydrated().nameableContracts()).not.toContain(Contract.Sechserdreier)
        expect(() =>
            session.act(forehand, ActionType.ChooseContract, {
                contract: Contract.Sechserdreier
            })
        ).toThrow()
    })

    it('lets others overbid a Sechserdreier only with a contract of higher value', () => {
        const session = startTestGame()
        const [forehand, second, third, dealer] = session.hydrated().seats()
        session.act(forehand, ActionType.Bid, { contract: Contract.Sechserdreier })
        const biddable = session.hydrated().biddableContracts(second)
        expect(biddable).not.toContain(Contract.Dreier)
        expect(biddable).toContain(Contract.Solodreier)
        session.act(second, ActionType.Pass)
        session.act(third, ActionType.Pass)
        session.act(dealer, ActionType.Pass)
        expect(session.state.contract).toEqual({
            contract: Contract.Sechserdreier,
            declarerId: forehand
        })
        expect(session.state.machineState).toBe(MachineState.LayingAway)
    })

    it('keeps king-calling contracts from a player holding all four kings', () => {
        const session = startTestGame()
        const [forehand, second] = session.hydrated().seats()
        session.edit((state) => {
            const kings = ['hearts-K', 'diamonds-K', 'spades-K', 'clubs-K']
            const holder = state.players.find((player) => player.playerId === forehand)
            const others = state.players.filter((player) => player.playerId !== forehand)
            for (const king of kings) {
                const owner = others.find((player) => player.hand?.includes(king))
                const swap = holder?.hand?.find((cardId) => !kings.includes(cardId))
                if (owner?.hand && holder?.hand && swap) {
                    owner.hand[owner.hand.indexOf(king)] = swap
                    holder.hand[holder.hand.indexOf(swap)] = king
                }
                if (state.talon?.includes(king) && holder?.hand && swap) {
                    state.talon[state.talon.indexOf(king)] = swap
                    holder.hand[holder.hand.indexOf(swap)] = king
                }
            }
        })
        const opening = session.hydrated().biddableContracts(forehand)
        expect(opening).not.toContain(Contract.Solorufer)
        expect(opening).toContain(Contract.Dreier)
        session.act(forehand, ActionType.SayMeinSpiel)
        expect(session.hydrated().biddableContracts(second)).toContain(Contract.Solorufer)
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        const nameable = session.hydrated().nameableContracts()
        expect(nameable).not.toContain(Contract.Rufer)
        expect(nameable).toContain(Contract.Dreier)
    })

    it('keeps Forehand’s own contracts out of the bidding', () => {
        const session = startTestGame()
        const [forehand, second] = session.hydrated().seats()
        session.act(forehand, ActionType.SayMeinSpiel)
        const biddable = session.hydrated().biddableContracts(second)
        expect(biddable).not.toContain(Contract.Rufer)
        expect(biddable).not.toContain(Contract.Sechserdreier)
        expect(biddable).toContain(Contract.Solorufer)
    })

    it('lets a higher-priority player hold a bid that others must beat', () => {
        const session = startTestGame()
        const [forehand, second, third, dealer] = session.hydrated().seats()
        session.act(forehand, ActionType.SayMeinSpiel)
        session.act(second, ActionType.Bid, { contract: Contract.Solorufer })
        expect(session.hydrated().biddableContracts(third)).not.toContain(Contract.Solorufer)
        session.act(third, ActionType.Pass)
        session.act(dealer, ActionType.Pass)
        expect(session.activePlayerId()).toBe(forehand)
        expect(session.hydrated().biddableContracts(forehand)).toContain(Contract.Solorufer)
        session.act(forehand, ActionType.Bid, { contract: Contract.Solorufer })
        expect(session.activePlayerId()).toBe(second)
        expect(session.hydrated().biddableContracts(second)).not.toContain(Contract.Solorufer)
        session.act(second, ActionType.Pass)
        expect(session.state.contract).toEqual({
            contract: Contract.Solorufer,
            declarerId: forehand
        })
    })

    it('rejects a bid that does not beat the held one', () => {
        const session = startTestGame()
        const [forehand, second, third] = session.hydrated().seats()
        session.act(forehand, ActionType.SayMeinSpiel)
        session.act(second, ActionType.Bid, { contract: Contract.Dreier })
        expect(() => session.act(third, ActionType.Bid, { contract: Contract.Solorufer })).toThrow()
    })

    it('skips players who have passed', () => {
        const session = startTestGame()
        const [forehand, second, third, dealer] = session.hydrated().seats()
        session.act(forehand, ActionType.SayMeinSpiel)
        session.act(second, ActionType.Pass)
        session.act(third, ActionType.Bid, { contract: Contract.Solorufer })
        session.act(dealer, ActionType.Pass)
        expect(session.activePlayerId()).toBe(forehand)
        session.act(forehand, ActionType.Bid, { contract: Contract.Solorufer })
        expect(session.activePlayerId()).toBe(third)
    })
})
