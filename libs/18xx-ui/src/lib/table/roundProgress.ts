import {
    isCompleteStockRound,
    isFinishOperatingTurn,
    isInterruptOperatingTurn,
    isResumeOperatingTurn,
    isStartOperatingRound,
    isStartStockRound,
    recordedRoundEnd,
    type OperatingRoundIdentity,
    type OperatingRoundSnapshot,
    type PlayerNetWorth,
    type RoundEnd
} from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'
import type { TitleRound } from '../session/titlePresentation.js'
import {
    AuctionHeading,
    identifiedOperatingRoundHeading,
    operatingSetNumber,
    stockRoundHeading,
    titleRoundHeading,
    type RoundHeading
} from './roundHeading.js'

/** Whether the Action starts a stock round: its own start, or one interrupting an operating turn. */
export function startsStockRound(action: GameAction): boolean {
    return isStartStockRound(action) || isInterruptOperatingTurn(action)
}

type ProgressTitleRound = Pick<
    TitleRound,
    'name' | 'abbreviation' | 'starts' | 'ends' | 'followsStockRound'
>
export type RoundProgressTitle = {
    openingRound?: Pick<TitleRound, 'name' | 'abbreviation'>
    titleRounds?: readonly ProgressTitleRound[]
}

/** A round that ended, with every player's net worth at its end where the game recorded it. */
export type EndedRound = {
    round: RoundEnd['round']
    heading: RoundHeading
    playerNetWorth?: PlayerNetWorth
}

/**
 * Follows a game's rounds through its Actions: the round under way and each round as it ends.
 * Stock rounds are numbered as the state numbers them: the first is under way as the game
 * starts, and those interrupting an operating round count too.
 *
 * Games stored before rounds recorded their ends take a stock round's end from the next
 * operating round's start, which includes that round's private income, and have no net worth
 * for a title's round.
 */
export class RoundProgress {
    readonly #opening: RoundHeading
    readonly #titleRounds: readonly ProgressTitleRound[]
    #current: RoundHeading
    #stockRound = 1
    #operatingRound: OperatingRoundIdentity = { number: 1, roundNumber: 1 }
    /** The part of an endless set's round under way, one more than the stock rounds that interrupted it. */
    #part = 1
    #setUnderWay = false
    #titleRoundUnderWay: ProgressTitleRound | undefined
    #unrecordedStockRound: number | undefined

    constructor(title: RoundProgressTitle) {
        this.#opening = title.openingRound ? { ...title.openingRound, number: '' } : AuctionHeading
        this.#titleRounds = title.titleRounds ?? []
        this.#current = this.#opening
    }

    /** The round under way after the Actions so far. */
    get current(): RoundHeading {
        return this.#current
    }

    /** The rounds the Action ended, oldest first. */
    advance(action: GameAction): EndedRound[] {
        const ended: EndedRound[] = []
        if (startsStockRound(action)) {
            this.#stockRound++
            if (isStartStockRound(action)) this.#setUnderWay = false
            this.#current = stockRoundHeading(this.#stockRound)
        }
        if (isResumeOperatingTurn(action)) {
            this.#part++
            this.#current = this.#operatingRoundHeading()
        }
        const startedRound = this.#titleRounds.find((round) => round.starts(action))
        if (startedRound) {
            this.#titleRoundUnderWay = startedRound
            this.#current = this.#titleRoundHeading(startedRound)
        }
        let snapshot: OperatingRoundSnapshot | undefined
        if (isFinishOperatingTurn(action)) snapshot = action.metadata
        if (isStartOperatingRound(action)) {
            assertExists(action.metadata, 'Recorded operating round requires metadata')
            snapshot = action.metadata.snapshot
            if (this.#unrecordedStockRound !== undefined)
                ended.push({
                    round: 'stock',
                    heading: stockRoundHeading(this.#unrecordedStockRound),
                    playerNetWorth: snapshot.playerNetWorth
                })
            this.#unrecordedStockRound = undefined
            this.#operatingRound = snapshot
            this.#part = 1
            this.#setUnderWay = true
            this.#current = this.#operatingRoundHeading()
        }
        const end: RoundEnd | undefined =
            recordedRoundEnd(action) ??
            (snapshot?.complete
                ? { round: 'operating', playerNetWorth: snapshot.playerNetWorth }
                : undefined)
        if (isCompleteStockRound(action) && !end) this.#unrecordedStockRound = this.#stockRound
        switch (end?.round) {
            case 'opening':
                ended.push({ ...end, heading: this.#opening })
                this.#current = stockRoundHeading(1)
                break
            case 'stock':
                ended.push({ ...end, heading: stockRoundHeading(this.#stockRound) })
                break
            case 'operating':
                ended.push({ ...end, heading: this.#operatingRoundHeading() })
                break
        }
        const titleRound = this.#titleRoundUnderWay
        if (titleRound?.ends(action)) {
            this.#titleRoundUnderWay = undefined
            ended.push({
                round: 'title',
                heading: this.#titleRoundHeading(titleRound),
                playerNetWorth: end?.round === 'title' ? end.playerNetWorth : undefined
            })
        }
        return ended
    }

    #operatingRoundHeading(): RoundHeading {
        return identifiedOperatingRoundHeading(this.#operatingRound, this.#part)
    }

    #titleRoundHeading(round: ProgressTitleRound): RoundHeading {
        return titleRoundHeading(round, {
            stock: this.#stockRound,
            setUnderWay: this.#setUnderWay,
            set: operatingSetNumber(this.#operatingRound),
            round: this.#operatingRound.roundNumber,
            part: this.#operatingRound.endless ? this.#part : undefined
        })
    }
}
