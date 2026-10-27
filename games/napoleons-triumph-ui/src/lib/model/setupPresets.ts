import { assert } from '@tabletop/common'
import {
    SANTON_LOCALE,
    Side,
    UnitType,
    faceOf,
    sameFace,
    type Face,
    type HydratedNapoleonsTriumphGameState,
    type Position
} from '@tabletop/napoleons-triumph'
import {
    emptySetup,
    withFixedBatteryPosted,
    withUnitDetached,
    withUnitJoining,
    type ArmySetup
} from './armySetup.js'

export interface SetupPreset {
    id: string
    name: string
    side: Side
    corps: Record<string, Face[]>
    detached?: { face: Face; position: Position }[]
    /** The fixed battery is set on the Santon where that rule is in use; otherwise it is left for the player to place. */
    batteryOnTheSanton?: boolean
}

function units(count: number, face: Face): Face[] {
    return Array.from({ length: count }, () => ({ ...face }))
}

const inf = (strength: number, count = 1) => units(count, { type: UnitType.Infantry, strength })
const cav = (strength: number, count = 1) => units(count, { type: UnitType.Cavalry, strength })
const ARTILLERY: Face = { type: UnitType.Artillery, strength: 1 }
const art = (count = 1) => units(count, ARTILLERY)
const guard = (count = 1) => units(count, { type: UnitType.Infantry, strength: 3, guard: true })

const cavalryScreen = (locales: number[]) =>
    locales.map((locale) => ({ face: cav(2)[0], position: { locale } }))

// Sources: /workspace/artassets/napoleons-triumph/notes/example-setups.md, each list checked against the order of battle.
export const SETUP_PRESETS: readonly SetupPreset[] = [
    // Bowen Simmons, the designer, via ConsimWorld
    {
        id: 'french-historical',
        name: 'Historical',
        side: Side.French,
        corps: {
            bessieres: [...guard(2), ...inf(3, 2), ...cav(3), ...art()],
            bernadotte: [...inf(3), ...inf(2, 3)],
            davout: [...inf(2, 3), ...cav(2)],
            'st-hilaire': [...inf(3), ...inf(2, 2)],
            vandamme: [...inf(3), ...inf(2, 2)],
            legrand: [...inf(3), ...inf(2, 2), ...cav(2)],
            lannes: [...inf(3), ...inf(2, 4), ...cav(2), ...art()],
            murat: [...cav(3, 2), ...cav(2, 2)]
        },
        batteryOnTheSanton: true
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'french-defend-in-place',
        name: 'Defend in place',
        side: Side.French,
        corps: {
            bessieres: [...guard(2), ...inf(2, 2)],
            murat: inf(2, 4),
            lannes: [...inf(3, 2), ...inf(2, 2)],
            vandamme: cav(3, 3),
            'st-hilaire': [...inf(3, 2), ...inf(2, 2)],
            legrand: inf(3, 3),
            davout: [...art(), ...inf(2, 3)],
            bernadotte: [...art(), ...inf(2, 3)]
        },
        detached: cavalryScreen([55, 65, 83, 119, 135]),
        batteryOnTheSanton: true
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'french-mixed-defence',
        name: 'Mixed defence',
        side: Side.French,
        corps: {
            bessieres: [...art(2), ...inf(2, 2)],
            murat: [...inf(3, 2), ...inf(2, 2)],
            lannes: inf(2, 4),
            vandamme: [...inf(3, 2), ...inf(2, 2)],
            'st-hilaire': cav(3, 3),
            legrand: inf(3, 3),
            davout: [...guard(), ...inf(2, 3)],
            bernadotte: [...guard(), ...inf(2, 3)]
        },
        detached: cavalryScreen([43, 55, 65, 119, 135]),
        batteryOnTheSanton: true
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'french-counter-attack',
        name: 'Counter-attack',
        side: Side.French,
        corps: {
            bessieres: [...art(2), ...inf(2, 2)],
            murat: inf(2, 4),
            lannes: inf(2, 4),
            vandamme: cav(3, 3),
            'st-hilaire': inf(2, 4),
            legrand: [...inf(3), ...inf(2, 2)],
            davout: [...guard(2), ...inf(3, 2)],
            bernadotte: inf(3, 4)
        },
        detached: cavalryScreen([43, 55, 65, 119, 135]),
        batteryOnTheSanton: true
    },
    // Bowen Simmons, the designer, via ConsimWorld
    {
        id: 'allied-historical',
        name: 'Historical',
        side: Side.Allied,
        corps: {
            kienmayer: [...inf(3), ...cav(2, 2), ...cav(1)],
            dokhturov: [...inf(3), ...inf(2, 4), ...art()],
            langeron: [...inf(3), ...inf(2, 4)],
            prebyshevsky: [...inf(3), ...inf(2, 3)],
            miloradovich: [...inf(2, 2), ...inf(1, 2), ...art()],
            kollowrath: inf(2, 3),
            liechtenstein: [...cav(3), ...cav(2, 2), ...cav(1)],
            bagration: [...inf(3), ...inf(2, 3), ...cav(2, 2), ...cav(1), ...art()],
            constantine: [...guard(3), ...cav(3), ...art()]
        }
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'allied-north-attack',
        name: 'Attack in the north',
        side: Side.Allied,
        corps: {
            bagration: [...art(2), ...inf(3, 2), ...inf(2, 2), ...cav(2, 2)],
            constantine: [...art(2), ...inf(3, 3), ...cav(3, 2), ...cav(2)],
            kollowrath: [...guard(3), ...inf(2, 3)],
            miloradovich: inf(2, 3),
            prebyshevsky: [...inf(2, 3), ...cav(2)],
            langeron: [...inf(2, 3), ...cav(2)],
            dokhturov: [...inf(2, 3), ...cav(2)],
            liechtenstein: [...inf(2, 2), ...inf(1, 2)],
            kienmayer: cav(1, 3)
        }
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'allied-centre-attack',
        name: 'Attack in the centre',
        side: Side.Allied,
        corps: {
            bagration: [...inf(2, 2), ...cav(1, 3)],
            constantine: [...inf(2, 3), ...cav(2)],
            kollowrath: [...art(2), ...guard(3), ...inf(3, 3)],
            miloradovich: [...art(2), ...inf(3, 2), ...cav(3, 2), ...cav(2, 2)],
            prebyshevsky: [...inf(2, 3), ...cav(2)],
            langeron: [...inf(2, 3), ...cav(2)],
            dokhturov: [...inf(2, 3), ...cav(2)],
            liechtenstein: [...inf(2, 2), ...inf(1, 2)],
            kienmayer: inf(2, 3)
        }
    },
    // Zarion of Arabel, BoardGameGeek, 2011
    {
        id: 'allied-south-attack',
        name: 'Attack in the south',
        side: Side.Allied,
        corps: {
            bagration: [...cav(1, 3), ...inf(2, 2), ...inf(1, 2)],
            constantine: [...art(2), ...inf(2, 2)],
            kollowrath: [...art(2), ...inf(2, 2)],
            miloradovich: [...cav(3, 2), ...cav(2)],
            prebyshevsky: [...inf(2, 3), ...cav(2)],
            langeron: [...inf(3, 2), ...inf(2, 2), ...cav(2)],
            dokhturov: [...inf(3, 2), ...inf(2, 2), ...cav(2)],
            liechtenstein: [...guard(3), ...inf(3), ...inf(2, 2)],
            kienmayer: [...inf(2, 4), ...cav(2, 2)]
        }
    },
    // mgmiller, BoardGameGeek, 2026
    {
        id: 'allied-mgmiller',
        name: 'Attack north and south',
        side: Side.Allied,
        corps: {
            kienmayer: [...cav(3, 2), ...art(), ...cav(2)],
            dokhturov: [...art(), ...cav(2), ...inf(2, 2), ...inf(3)],
            langeron: [...cav(1), ...inf(2, 2), ...inf(3)],
            liechtenstein: [...inf(2, 2), ...guard(), ...art()],
            prebyshevsky: [...inf(2, 4), ...cav(2)],
            miloradovich: [...inf(2, 3), ...cav(2)],
            kollowrath: [...inf(2, 2), ...inf(3), ...cav(2)],
            constantine: [...cav(2), ...inf(2, 2), ...inf(1), ...guard(2)],
            bagration: [...cav(1, 2), ...inf(2, 2), ...art(), ...inf(3, 2), ...inf(1)]
        }
    }
]

export function presetsFor(side: Side): SetupPreset[] {
    return SETUP_PRESETS.filter((preset) => preset.side === side)
}

export function arrangedFromPreset(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    preset: SetupPreset
): ArmySetup {
    const free = [...state.unitsOf(playerId)]
    const take = (face: Face): string => {
        const index = free.findIndex((unit) => sameFace(faceOf(unit), face))
        assert(index >= 0, `The ${preset.id} set-up asks for more units than the army has`)
        return free.splice(index, 1)[0].id
    }
    let setup = emptySetup(state, playerId)
    for (const [commanderId, faces] of Object.entries(preset.corps)) {
        for (const face of faces) {
            setup = withUnitJoining(setup, take(face), commanderId)
        }
    }
    for (const { face, position } of preset.detached ?? []) {
        setup = withUnitDetached(setup, take(face), position)
    }
    if (preset.batteryOnTheSanton && state.santon) {
        setup = withFixedBatteryPosted(setup, take(ARTILLERY), { locale: SANTON_LOCALE })
    }
    return setup
}
