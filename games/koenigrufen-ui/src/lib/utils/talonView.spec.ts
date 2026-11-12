import { describe, expect, it } from 'vitest'
import {
    Contract,
    contractDefinition,
    MachineState,
    type HydratedKoenigrufenGameState
} from '@tabletop/koenigrufen'
import { defenderCollector, talonViewOf, TalonPlace } from './talonView.js'

const halves = [
    ['a1', 'a2', 'a3'],
    ['b1', 'b2', 'b3']
]

// Only what the talon view reads.
function state({
    contract,
    machineState,
    talonHalves,
    rejectedTalonHalf,
    kingInTalon = false
}: {
    contract?: Contract
    machineState: MachineState
    talonHalves?: string[][]
    rejectedTalonHalf?: string[]
    kingInTalon?: boolean
}): HydratedKoenigrufenGameState {
    return {
        contract: contract === undefined ? undefined : { contract, declarerId: 'c' },
        machineState,
        talonHalves,
        rejectedTalonHalf,
        contractDefinition: () => contractDefinition(contract ?? Contract.Rufer),
        isCalledKingInTalon: () => kingInTalon,
        turnManager: { turnOrder: ['a', 'b', 'c', 'd'] }
    } as unknown as HydratedKoenigrufenGameState
}

describe('the talon on the table', () => {
    it('lies face down in the middle until the contract uses it', () => {
        expect(talonViewOf(state({ machineState: MachineState.Bidding }))).toEqual({
            kind: 'stack',
            place: TalonPlace.Middle
        })
        expect(
            talonViewOf(
                state({ contract: Contract.Solorufer, machineState: MachineState.CallingKing })
            )
        ).toEqual({ kind: 'stack', place: TalonPlace.Middle })
    })

    it('shows the halves in the middle for the choice', () => {
        expect(
            talonViewOf(
                state({
                    contract: Contract.Rufer,
                    machineState: MachineState.ChoosingTalonHalf,
                    talonHalves: halves
                })
            )
        ).toEqual({ kind: 'halves', place: TalonPlace.Middle, halves })
    })

    it('keeps the rejected half in the corner while the partner is secret', () => {
        expect(
            talonViewOf(
                state({
                    contract: Contract.Rufer,
                    machineState: MachineState.LayingAway,
                    talonHalves: halves,
                    rejectedTalonHalf: halves[1]
                })
            )
        ).toEqual({ kind: 'half', place: TalonPlace.Corner, cards: halves[1] })
    })

    it('gives the rejected half to the defenders when declarer plays alone', () => {
        for (const [contract, kingInTalon] of [
            [Contract.Dreier, false],
            [Contract.Rufer, true]
        ] as const) {
            expect(
                talonViewOf(
                    state({
                        contract,
                        machineState: MachineState.Playing,
                        talonHalves: halves,
                        rejectedTalonHalf: halves[0],
                        kingInTalon
                    })
                )
            ).toEqual({ kind: 'gone' })
        }
    })

    it('sends the untouched talon to the declarer, the defenders, or the corner by contract', () => {
        const playing = (contract: Contract) =>
            talonViewOf(state({ contract, machineState: MachineState.Announcing }))
        expect(playing(Contract.Sechserdreier)).toEqual({ kind: 'gone' })
        expect(playing(Contract.Solodreier)).toEqual({ kind: 'gone' })
        expect(playing(Contract.Farbensolo)).toEqual({ kind: 'gone' })
        for (const waits of [
            Contract.Solorufer,
            Contract.Piccolo,
            Contract.Bettel,
            Contract.Trischaken
        ]) {
            expect(playing(waits)).toEqual({ kind: 'stack', place: TalonPlace.Corner })
        }
    })

    it('has the first opponent after the declarer collect the defenders’ cards', () => {
        expect(
            defenderCollector(
                state({ contract: Contract.Dreier, machineState: MachineState.Playing })
            )
        ).toBe('d')
    })
})
