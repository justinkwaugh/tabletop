import {
    FAVOR_BANK_ORDER,
    HydratedUseRestPower,
    PowerChoiceKind,
    isUseRestPower,
    powerKey,
    type HydratedOathGameState,
    type LegalPowerUse,
    type PowerChoice,
    type Suit
} from '@tabletop/oath'
import { assertExists, type GameAction } from '@tabletop/common'
import { withoutCardName } from '$lib/model/actionDescription.js'

/** R-4.3.5 — what each Rest power does, as its row says it, and what one use gains. */
const REST_POWERS: Record<string, { does: string; gain: number; token: 'favor' | 'secret' }> = {
    'denizen.beast.vow-of-poverty': {
        does: 'you have no favor: take 2 favor from any bank',
        gain: 2,
        token: 'favor'
    },
    'denizen.order.vow-of-obedience': {
        does: 'take 1 favor from any bank',
        gain: 1,
        token: 'favor'
    },
    'denizen.discord.insomnia': { does: 'gain a secret', gain: 1, token: 'secret' },
    'denizen.discord.silver-tongue': {
        does: 'take 1 favor from a bank matching a card at your site',
        gain: 1,
        token: 'favor'
    },
    'denizen.discord.naysayers': {
        does: 'an Exile holds the title: take 1 favor from the Chancellor',
        gain: 1,
        token: 'favor'
    }
}

export interface RestBankButton {
    suit: Suit
    inBank: number
    takes: number
    enabled: boolean
}

export interface RestRow {
    cardId: string
    powerIndex: number
    does: string
    gain: { count: number; token: 'favor' | 'secret' }
    banks?: RestBankButton[]
    /** Naysayers — whom the favor comes from. */
    fromPlayerId?: string
    enabled: boolean
    used?: string
}

function describedPower(cardId: string) {
    const power = REST_POWERS[cardId]
    assertExists(power, `${cardId} has no Rest power the panel describes`)
    return power
}

function bankChoices(power: LegalPowerUse): PowerChoice[] {
    return (
        power.choices.find((choice) => choice.spec.kind === PowerChoiceKind.FavorBank)?.options ??
        []
    )
}

function suitOf(choice: PowerChoice): Suit | undefined {
    return choice.kind === PowerChoiceKind.FavorBank ? choice.suit : undefined
}

function usedLine(action: GameAction, cardId: string): string | undefined {
    if (!isUseRestPower(action) || action.cardId !== cardId) return undefined
    const summary = action.metadata?.summary
    if (!summary) return 'used'
    return `used: ${withoutCardName(summary, cardId)}`
}

/** R-4.3.5, R-7.3.4 — the Rest panel's rows: each usable power once, and each one already used, dimmed. */
export function restRows(
    state: HydratedOathGameState,
    playerId: string,
    actions: readonly GameAction[]
): RestRow[] {
    const turn = state.turnManager.currentTurn()
    const thisTurn = actions.filter(
        (action) => turn !== undefined && (action.index ?? 0) >= turn.start
    )
    const usable = HydratedUseRestPower.usableRestPowers(state, playerId).map((power): RestRow => {
        const described = describedPower(power.cardId)
        const banks = bankChoices(power)
        const accepts = (choices: PowerChoice[]) =>
            HydratedUseRestPower.reasonCannotUse(
                state,
                playerId,
                power.cardId,
                power.powerIndex,
                choices
            ) === undefined
        return {
            cardId: power.cardId,
            powerIndex: power.powerIndex,
            does: described.does,
            gain: { count: described.gain, token: described.token },
            banks:
                banks.length === 0
                    ? undefined
                    : FAVOR_BANK_ORDER.flatMap((suit): RestBankButton[] => {
                          const choice = banks.find((option) => suitOf(option) === suit)
                          if (!choice) return []
                          const inBank = state.favorBank[suit]
                          return [
                              {
                                  suit,
                                  inBank,
                                  takes: Math.min(described.gain, inBank),
                                  enabled: inBank > 0 && accepts([choice])
                              }
                          ]
                      }),
            fromPlayerId:
                power.cardId === 'denizen.discord.naysayers' ? state.chancellorId() : undefined,
            enabled: banks.length === 0 && accepts([])
        }
    })
    const used = state.getPlayerState(playerId).restPowersUsedThisTurn.flatMap((key): RestRow[] => {
        const action = thisTurn.findLast((candidate) =>
            isUseRestPower(candidate)
                ? powerKey(candidate.cardId, candidate.powerIndex) === key
                : false
        )
        if (!action || !isUseRestPower(action)) return []
        const described = describedPower(action.cardId)
        return [
            {
                cardId: action.cardId,
                powerIndex: action.powerIndex,
                does: described.does,
                gain: { count: described.gain, token: described.token },
                enabled: false,
                used: usedLine(action, action.cardId)
            }
        ]
    })
    const adviserOrder = state.getPlayerState(playerId).advisers.map((row) => row.cardId)
    const position = (row: RestRow) => adviserOrder.indexOf(row.cardId)
    return [...usable, ...used].sort((a, b) => position(a) - position(b))
}

export function restBankChoice(suit: Suit): PowerChoice[] {
    return [{ kind: PowerChoiceKind.FavorBank, suit }]
}
