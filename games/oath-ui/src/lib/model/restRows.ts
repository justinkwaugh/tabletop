import {
    FAVOR_BANK_ORDER,
    HydratedUseRestPower,
    PowerChoiceKind,
    type HydratedOathGameState,
    type LegalPowerUse,
    type PowerChoice,
    type Suit
} from '@tabletop/oath'
import { assertExists } from '@tabletop/common'

/** R-4.3.5 — what one use of each Rest power the panel offers gains. */
const REST_POWERS: Record<string, { gain: number; token: 'favor' | 'secret' }> = {
    'denizen.beast.vow-of-poverty': { gain: 2, token: 'favor' },
    'denizen.order.vow-of-obedience': { gain: 1, token: 'favor' },
    'denizen.discord.insomnia': { gain: 1, token: 'secret' },
    'denizen.discord.silver-tongue': { gain: 1, token: 'favor' },
    'denizen.discord.naysayers': { gain: 1, token: 'favor' }
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
    gain: { count: number; token: 'favor' | 'secret' }
    banks?: RestBankButton[]
    /** Naysayers — whom the favor comes from. */
    fromPlayerId?: string
    enabled: boolean
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

/**
 * R-4.3.5, R-7.3.4 — the Rest panel's rows: each power still usable this Rest, in the advisers'
 * order. R-9.3 — an empty bank is a legal pick that takes 0, so it stays a button.
 */
export function restRows(state: HydratedOathGameState, playerId: string): RestRow[] {
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
                                  enabled: accepts([choice])
                              }
                          ]
                      }),
            fromPlayerId:
                power.cardId === 'denizen.discord.naysayers' ? state.chancellorId() : undefined,
            enabled: banks.length === 0 && accepts([])
        }
    })
    const adviserOrder = state.getPlayerState(playerId).advisers.map((row) => row.cardId)
    const position = (row: RestRow) => adviserOrder.indexOf(row.cardId)
    return usable.sort((a, b) => position(a) - position(b))
}

export function restBankChoice(suit: Suit): PowerChoice[] {
    return [{ kind: PowerChoiceKind.FavorBank, suit }]
}
