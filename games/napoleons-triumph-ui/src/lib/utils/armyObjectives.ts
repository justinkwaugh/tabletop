import {
    Hold,
    STARS_SOUGHT,
    Side,
    type HydratedNapoleonsTriumphGameState,
    type LocaleHold,
    type Star,
    type StarHold
} from '@tabletop/napoleons-triumph'

export interface ObjectiveStar {
    star: Star
    hold: Hold | undefined
    explanation: string
}

export interface ArmyObjectives {
    stars: ObjectiveStar[]
    terms: string
}

const TERMS: Record<Side, { unreinforced: string; reinforced: string }> = {
    [Side.French]: {
        unreinforced: 'Any one wins',
        reinforced: 'All three win if the Allies hold none'
    },
    [Side.Allied]: {
        unreinforced: 'One wins if the French hold none',
        reinforced: 'One wins'
    }
}

function places(
    state: HydratedNapoleonsTriumphGameState,
    locales: readonly LocaleHold[],
    hold: Hold
): string {
    return locales
        .filter((candidate) => candidate.hold === hold)
        .map(({ locale }) => state.map.label(locale))
        .join(', ')
}

export function armyObjectives(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    holds: readonly StarHold[]
): ArmyObjectives {
    const side = state.sideOf(playerId)
    const terms = TERMS[side]
    const sought = holds.filter((hold) => STARS_SOUGHT[side].includes(hold.star))
    return {
        stars: sought.map(({ star, locales }) => {
            const strongest = locales.some(({ hold }) => hold === Hold.Held)
                ? Hold.Held
                : locales[0]?.hold
            switch (strongest) {
                case Hold.Held:
                    return {
                        star,
                        hold: strongest,
                        explanation: `${star} star held at ${places(state, locales, strongest)}`
                    }
                case Hold.Possible:
                    return {
                        star,
                        hold: strongest,
                        explanation: `${star} star perhaps held at ${places(state, locales, strongest)}: the units there are face-down`
                    }
                case undefined:
                    return {
                        star,
                        hold: undefined,
                        explanation: `No ${star.toLowerCase()} star held`
                    }
            }
        }),
        terms: state.frenchReinforcementsEntered ? terms.reinforced : terms.unreinforced
    }
}
