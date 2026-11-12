import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    Banner,
    IMPERIAL_WARBANDS,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    PowerTiming,
    Region,
    Search,
    SearchSource,
    allMapSlots,
    mapSlotsFor,
    powerIndexOf
} from '@tabletop/oath'
import { openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const WRESTLERS = 'denizen.order.wrestlers'
export const TWIN_BROTHER = 'denizen.nomad.twin-brother'
export const RELIC_BREAKER = 'denizen.hearth.relic-breaker'
export const BLOOD_PACT = 'denizen.arcane.blood-pact'
export const CONSPIRACY = 'vision.conspiracy'
export const GLEAMING_ARMOR = 'denizen.arcane.gleaming-armor'
export const CROP_ROTATION = 'denizen.hearth.crop-rotation'
export const LAND_WARDEN = 'denizen.hearth.land-warden'

/** The three cards Dana's Search draws, in the order drawn. */
export const FULL_SITE_DRAW = [WRESTLERS, TWIN_BROTHER, RELIC_BREAKER]

export type FullSiteSearch = {
    /** The rules the game was recorded under; a game created at revision 28 by default. */
    revision?: OathRevision
    /** Dana's own full site is the Barren Coast and the Great Slum is elsewhere, empty. */
    slumElsewhere?: boolean
    /** Dana, not Mara, holds the People's Favor (R-5.1.4.I), so a site play may go to another Hinterland site. */
    peoplesFavor?: boolean
    /** Dana holds this adviser faceup in place of Gleaming Armor and uses its power on the Search. */
    modifier?: typeof CROP_ROTATION | typeof LAND_WARDEN
}

/**
 * R-5.1.2 to R-5.1.4.II — round 4 of a four-seat game, Dana's Act Phase. Dana (an Exile) holds a full adviser row:
 * Blood Pact facedown, the Vision of Conspiracy facedown and Gleaming Armor (or another adviser) faceup. They stand at the Great Slum
 * (capacity 3), full with the Wolves, Tavern Songs and the Oracle; nine more denizens stand across the map. Rhys is
 * the Chancellor; Mara holds the People's Favor. Dana searches the world deck and draws Wrestlers, Twin Brother and
 * the Relic Breaker. Wrestlers could go to a site, but Dana's is full; the other two are played only as advisers.
 */
export function fullSiteSearch({
    revision = OathRevision.EngineFixes24,
    slumElsewhere = false,
    peoplesFavor = false,
    modifier
}: FullSiteSearch = {}): PlayedTable {
    const [plains, river] = mapSlotsFor(Region.Cradle)
    const [marshes, mountain, valley] = mapSlotsFor(Region.Provinces)
    const [coast, slum, pass] = mapSlotsFor(Region.Hinterland)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: slum,
                favor: 1,
                secrets: 1,
                supply: 6,
                warbandsOnBoard: { Dana: 6 },
                warbandsInPersonalBank: { Dana: 8 },
                advisers: [
                    { cardId: BLOOD_PACT, faceUp: false },
                    { cardId: CONSPIRACY, faceUp: false },
                    { cardId: modifier ?? GLEAMING_ARMOR, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'Rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: marshes,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 },
                advisers: [{ cardId: 'denizen.order.longbows', faceUp: true }]
            }),
            testPlayer({
                playerId: 'Mara',
                color: Color.Blue,
                status: PlayerStatus.Exile,
                siteId: slum,
                favor: 3,
                secrets: 2,
                advisers: [{ cardId: 'denizen.nomad.vow-of-kinship', faceUp: true }]
            }),
            testPlayer({
                playerId: 'Ivo',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: pass,
                favor: 2,
                secrets: 1
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'Rhys',
            round: 4,
            machineState: MachineState.ActPhase,
            map: allMapSlots(),
            denizensBySite: {
                [plains]: ['denizen.hearth.ballot-box', 'denizen.hearth.wayside-inn'],
                [river]: ['denizen.order.scouts'],
                [marshes]: [
                    'denizen.beast.rangers',
                    'denizen.beast.mushrooms',
                    'denizen.discord.charlatan'
                ],
                [mountain]: ['denizen.hearth.homesteaders', 'denizen.beast.wild-cry'],
                [valley]: [],
                [coast]: [],
                [slum]: [
                    'denizen.beast.wolves',
                    'denizen.hearth.tavern-songs',
                    'denizen.nomad.oracle'
                ],
                [pass]: []
            },
            warbandsBySite: {
                [plains]: { Dana: 2 },
                [river]: { Dana: 2 },
                [coast]: { Dana: 2 },
                [marshes]: { [IMPERIAL_WARBANDS]: 4 }
            },
            siteCards: {
                [plains]: 'site.plains',
                [river]: 'site.river',
                [marshes]: 'site.marshes',
                [mountain]: 'site.mountain',
                [valley]: 'site.fertile-valley',
                [coast]: slumElsewhere ? 'site.great-slums' : 'site.barren-coast',
                [slum]: slumElsewhere ? 'site.barren-coast' : 'site.great-slums',
                [pass]: 'site.narrow-pass'
            },
            banners: testBanners({ [Banner.PeoplesFavor]: peoplesFavor ? 'Dana' : 'Mara' }),
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'Rhys'
        }
    )
    openTurn(state, 'Dana')
    const vault = state.requireVault()
    vault.worldDeck = [...FULL_SITE_DRAW, ...vault.worldDeck]
    const table = tableOf(state)
    return played(table, [
        createAction(Search, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: 'Dana',
            drawFrom: SearchSource.WorldDeck,
            ...(modifier
                ? {
                      modifiers: [
                          {
                              cardId: modifier,
                              powerIndex: powerIndexOf(modifier, PowerTiming.Modifier)
                          }
                      ]
                  }
                : {})
        })
    ])
}
