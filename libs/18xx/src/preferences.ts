import * as Type from 'typebox'
import type { TitlePreferenceDefinition } from '@tabletop/common'

const HexColor = Type.String({ pattern: '^#[0-9a-f]{6}$' })
/**
 * A display choice by name. Open rather than a fixed list: every 18xx title validates the one
 * shared family record against the schema it last shipped, so a value a newer title adds must
 * still pass in older ones, which show their default for a name they don't know.
 */
const DisplayChoice = Type.String({ pattern: '^[a-z][a-zA-Z0-9]{0,31}$' })
const ColorsByName = Type.Record(Type.String({ pattern: '^[a-z][a-zA-Z0-9]{0,31}$' }), HexColor, {
    maxProperties: 64
})

export const EighteenXXPreferences = Type.Object(
    {
        operatingOrderDisplay: Type.Union([Type.Literal('tokens'), Type.Literal('details')]),
        historyOrder: Type.Union([Type.Literal('newestFirst'), Type.Literal('newestLast')]),
        compactPlayerCards: Type.Boolean(),
        boardAutoZoom: Type.Boolean(),
        companyCardsWrap: Type.Boolean(),
        companyCardsWide: Type.Boolean(),
        companyCardsWrapTabbed: Type.Boolean(),
        companyCardsWideTabbed: Type.Boolean(),
        companyCardsUnstarted: Type.Boolean(),
        operatingOrderChipsTabbed: Type.Boolean(),
        publishedArtwork: Type.Boolean(),
        tableTopPercent: Type.Number({ minimum: 25, maximum: 65 }),
        spreadsheetHeightPercent: Type.Number({ minimum: 25, maximum: 65 }),
        spreadsheetSplitPercent: Type.Number({ minimum: 25, maximum: 65 }),
        paneLayout: Type.Unknown(),
        tabbedLayout: Type.Unknown(),
        /** Company tokens drawn with their logos (``artwork``), or as discs with ``initials``. */
        tokenStyle: DisplayChoice,
        /** Tile color preset: ``default`` (the title's own) or ``maker``. */
        tileStyle: DisplayChoice,
        /** Picked colors over the preset, by tile color such as ``yellow``. */
        tileColors: ColorsByName,
        /** Picked route colors, by the train's place in the company (``0``, ``1``, …). */
        routeColors: Type.Record(Type.String({ pattern: '^[0-9]{1,2}$' }), HexColor, {
            maxProperties: 64
        }),
        /** Picked colors for each seat color, such as ``red``. */
        playerColors: ColorsByName,
        /** How strongly a player's color tints their cards and rows, in percent. */
        playerTint: Type.Integer({ minimum: 0, maximum: 100 }),
        /** Table palette preset: ``default`` (the title's own), ``light`` or ``contrast``. */
        tableStyle: DisplayChoice,
        /** Picked table colors over the preset; later versions may add colors. */
        tableColors: Type.Object({
            background: Type.Optional(HexColor),
            surface: Type.Optional(HexColor),
            text: Type.Optional(HexColor),
            header: Type.Optional(HexColor),
            border: Type.Optional(HexColor),
            paneBorder: Type.Optional(HexColor),
            muted: Type.Optional(HexColor),
            inactive: Type.Optional(HexColor),
            focus: Type.Optional(HexColor),
            negative: Type.Optional(HexColor),
            market: Type.Optional(HexColor),
            soldOut: Type.Optional(HexColor),
            unfloated: Type.Optional(HexColor),
            soldThisRound: Type.Optional(HexColor),
            sheetBorder: Type.Optional(HexColor)
        }),
        spreadsheetView: Type.Union([Type.Literal('player'), Type.Literal('company')])
    },
    { additionalProperties: false }
)
export const EighteenXXPreferenceDefinition = {
    title: {
        schema: EighteenXXPreferences,
        defaults: {
            paneLayout: null,
            tabbedLayout: null,
            operatingOrderDisplay: 'details',
            historyOrder: 'newestLast',
            spreadsheetView: 'player',
            compactPlayerCards: false,
            boardAutoZoom: true,
            companyCardsWrap: true,
            companyCardsWide: false,
            companyCardsWrapTabbed: true,
            companyCardsWideTabbed: false,
            companyCardsUnstarted: false,
            operatingOrderChipsTabbed: true,
            publishedArtwork: false,
            tokenStyle: 'artwork',
            tileStyle: 'default',
            tileColors: {},
            routeColors: {},
            playerTint: 15,
            playerColors: {},
            tableStyle: 'default',
            tableColors: {},
            spreadsheetSplitPercent: 40,
            spreadsheetHeightPercent: 55,
            tableTopPercent: 35
        },
        version: 1
    },
    family: {
        id: '18xx',
        schema: EighteenXXPreferences,
        defaults: {
            paneLayout: null,
            tabbedLayout: null,
            operatingOrderDisplay: 'details',
            historyOrder: 'newestLast',
            spreadsheetView: 'player',
            compactPlayerCards: false,
            boardAutoZoom: true,
            companyCardsWrap: true,
            companyCardsWide: false,
            companyCardsWrapTabbed: true,
            companyCardsWideTabbed: false,
            companyCardsUnstarted: false,
            operatingOrderChipsTabbed: true,
            publishedArtwork: false,
            tokenStyle: 'artwork',
            tileStyle: 'default',
            tileColors: {},
            routeColors: {},
            playerTint: 15,
            playerColors: {},
            tableStyle: 'default',
            tableColors: {},
            spreadsheetSplitPercent: 40,
            spreadsheetHeightPercent: 55,
            tableTopPercent: 35
        },
        version: 1
    }
} satisfies TitlePreferenceDefinition<typeof EighteenXXPreferences>

/** The display choices a player makes for every 18xx title from the table's Display panel. */
export type EighteenXXDisplayPreferences = Pick<
    Type.Static<typeof EighteenXXPreferences>,
    | 'tokenStyle'
    | 'tileStyle'
    | 'tileColors'
    | 'routeColors'
    | 'playerColors'
    | 'playerTint'
    | 'tableStyle'
    | 'tableColors'
>
