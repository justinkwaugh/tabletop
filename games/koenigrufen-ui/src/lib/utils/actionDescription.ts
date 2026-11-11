import type { GameAction } from '@tabletop/common'
import {
    Contracts,
    DoubleNames,
    FourthKing,
    isAnnounce,
    isBid,
    isCallKing,
    isChooseContract,
    isChooseTalonHalf,
    isDealHand,
    isEndHand,
    isGiveUp,
    isLayAway,
    isPass,
    isPickUpTalon,
    isPlayCard,
    isRevealTalon,
    isSayMeinSpiel,
    type CalledKing,
    type HandResult
} from '@tabletop/koenigrufen'
import { bonusName, doubleTargetName } from './announcementText.js'
import { bidName } from './contractText.js'
import { cardLabel, SuitSymbols, type CardStyle } from './cardStyle.js'

export type Names = { name: (playerId: string) => string }

function cards(cardIds: readonly string[], style: CardStyle): string {
    return cardIds.map((cardId) => cardLabel(cardId, style)).join(' ')
}

// Short, like the cards: K♠, or the fourth king (the one not in the caller's hand).
export function calledKingName(king: CalledKing): string {
    return king === FourthKing ? '4th K' : `K${SuitSymbols[king]}`
}

function signed(value: number): string {
    return value > 0 ? `+${value}` : String(value)
}

export function describeHandResult(result: HandResult, names: Names): string {
    const contract = Contracts[result.contract].name
    const side = result.partnerId
        ? `${names.name(result.declarerId)} and ${names.name(result.partnerId)}`
        : names.name(result.declarerId)
    if (result.givenUp) {
        return `${contract}: ${side} gave up`
    }
    if (result.playerPoints !== undefined) {
        const points = Object.entries(result.playerPoints)
            .map(([playerId, value]) => `${names.name(playerId)} ${value}`)
            .join(', ')
        return `${contract}: card points ${points}`
    }
    const outcome = result.made ? 'made it' : 'lost'
    if (result.declarerTricks !== undefined) {
        const tricks = `${result.declarerTricks} ${result.declarerTricks === 1 ? 'trick' : 'tricks'}`
        return `${contract}: ${side} took ${tricks} and ${outcome}`
    }
    return `${contract}: ${side} took ${result.declarerPoints} of 70 and ${outcome}`
}

export function describeScoreChanges(result: HandResult, names: Names): string {
    return Object.entries(result.scoreChanges)
        .map(([playerId, change]) => `${names.name(playerId)} ${signed(change)}`)
        .join(', ')
}

// Describes an Action from its input and metadata alone.
export function describeAction(
    action: GameAction,
    names: Names,
    style: CardStyle
): string | undefined {
    const who = action.playerId ? names.name(action.playerId) : ''
    switch (true) {
        case isDealHand(action):
            return action.metadata
                ? `${names.name(action.metadata.dealerId)} dealt hand ${action.metadata.deal}`
                : undefined
        case isSayMeinSpiel(action):
            return `${who} said “Mein Spiel”`
        case isBid(action):
            return `${who} bid ${bidName(action)}`
        case isPass(action):
            return `${who} passed`
        case isChooseContract(action):
            return `${who} named ${bidName(action)}`
        case isCallKing(action):
            return `${who} called ${calledKingName(action.king)}`
        case isRevealTalon(action):
            return action.metadata
                ? `The talon was turned up: ${action.metadata.halves.map((half) => cards(half, style)).join(' | ')}`
                : 'The talon was turned up'
        case isChooseTalonHalf(action):
            return action.metadata
                ? `${who} took ${cards(action.metadata.cardIds, style)}`
                : `${who} took a half of the talon`
        case isGiveUp(action):
            return `${who} gave up with the called King in the talon`
        case isPickUpTalon(action):
            return 'Declarer took the whole talon'
        case isLayAway(action): {
            const shown = action.metadata?.shown ?? []
            const count = action.cardIds?.length
            const laid = count === undefined ? 'cards' : `${count} cards`
            return shown.length > 0
                ? `${who} laid away ${laid}, showing ${cards(shown, style)}`
                : `${who} laid away ${laid}`
        }
        case isAnnounce(action): {
            const said = [
                ...action.bonuses.map(bonusName),
                ...action.doubles.map((target, index) => {
                    const level = action.metadata?.doubleLevels[index] ?? 1
                    return `${DoubleNames[level - 1]} on ${doubleTargetName(target, names)}`
                })
            ]
            return said.length > 0 ? `${who} announced ${said.join(', ')}` : `${who} passed`
        }
        case isPlayCard(action): {
            const winner = action.metadata?.trickWinnerId
            const played = `${who} played ${cardLabel(action.cardId, style)}`
            return winner ? `${played}; ${names.name(winner)} won the trick` : played
        }
        case isEndHand(action):
            return action.metadata
                ? `${describeHandResult(action.metadata, names)} (${describeScoreChanges(action.metadata, names)})`
                : undefined
        default:
            return undefined
    }
}
