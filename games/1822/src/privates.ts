import { placeReference as place } from '@tabletop/18xx'

/** Who may acquire a private company: blue no company, red only a major, green either (§3.1.3). */
export type PrivateColor1822 = 'blue' | 'red' | 'green'

/** The 1822+ stack a private is dealt from: trains, track, or the rest (§2.1.7). */
export const PrivateStacks1822 = ['trains', 'track', 'other'] as const
export type PrivateStack1822 = (typeof PrivateStacks1822)[number]

export type Private1822 = {
    id: string
    name: string
    initials: string
    /** What it pays its player owner each operating round (§3.1.1). */
    revenue: number
    /** Its revenue is that amount for each phase number (P15, P20). */
    revenuePerPhase?: true
    color: PrivateColor1822
    /** The phase from which a company may acquire it; never, for the tax haven (§3.1.4). */
    acquiredFromPhaseId?: string
    stack: PrivateStack1822
    power: string
    description: string
    /** One of the three private companies of the 1822+ expansion (§3.1.1). */
    expansion?: true
}

export const EnglishChannelLocationId = 'P43'
export const GrimsbyLocationId = 'N23'
export const HullLocationId = 'N21'

/** The Butterley Engineering Company, always first in its stack (§2.1.6). */
export const FirstPrivateId = 'P1'
export const RemoveSmallStationPrivateId = 'P2'
export const EnglishChannelPrivateId = 'P5'
export const MailContractPrivateIds: readonly string[] = ['P6', 'P7']
export const HillDiscountPrivateId = 'P8'
export const DoubleCashPrivateId = 'P9'
export const RiverDiscountPrivateId = 'P10'
export const AdvancedTileLayPrivateId = 'P11'
export const ExtraTileLayPrivateId = 'P12'
export const PhaseCreditPrivateIds: readonly string[] = ['P15', 'P20']
export const TaxHavenPrivateId = 'P16'
export const MoveCardPrivateId = 'P17'
export const StationSwapPrivateId = 'P18'
export const HumberBridgePrivateId = 'P21'

/** Privates that keep paying £10 to the company that acquired them until their power is used (§3.1.8). */
export const CompanyRevenuePrivateIds1822: readonly string[] = [
    RemoveSmallStationPrivateId,
    AdvancedTileLayPrivateId,
    ExtraTileLayPrivateId
]

/** What P9 pays the company that owns it, by the tile colour of the phase (Table 3). */
export const DoubleCashCompanyRevenue1822: Readonly<Record<string, number>> = {
    green: 20,
    brown: 40,
    gray: 60
}

/** The phase at whose start P15 and P20 close if no company has acquired them (Table 3). */
export const PhaseCreditClosurePhaseId = '7'

const PermanentTrain =
    'It cannot be sold to another company, does not count against the train limit and is not the train a company must own. A company owns only one, and not together with a permanent L-train. Its earnings may be paid out, split or kept apart from the other trains’; a dividend from either counts as a dividend for the share price. Does not close.'
const MailContract =
    'After running trains, the owning company’s treasury receives half the base value of the first and last stations of one train’s run. Doubled values, for an E train or a destination, do not count. The company need not run for the most revenue if stopping at a large station earns more mail. A train carries one mail contract. Does not close.'
const Pullman =
    'A Pullman carriage the owning company adds to one of its trains each operating round, though never an E train. That train then counts only large stations against its number and still earns from every small station it passes. It cannot be sold to another company, does not count against the train limit and is not the train a company must own. Does not close.'
const phaseCredit = (amount: number) =>
    `Pays its owner £${amount} for each phase number, and sets the same amount aside on its charter. A company that acquires it receives that money and the private closes. If none has, it closes at the start of phase 7 and the money returns to the bank.`

// The private companies (§3.1, Table 3). The certificate colour says who may acquire one, and
// each names the phase it can be acquired from (§3.1.3, §3.1.4).
export const Privates1822: readonly Private1822[] = [
    {
        id: 'P1',
        name: 'Butterley Engineering Company',
        initials: 'BEC',
        revenue: 5,
        color: 'red',
        acquiredFromPhaseId: '5',
        stack: 'trains',
        power: '5-train',
        description:
            'An ordinary 5-train. A company may acquire it even at its train limit, since acquiring it is not buying a train, and then discards down to the limit.'
    },
    {
        id: RemoveSmallStationPrivateId,
        name: 'Middleton Railway',
        initials: 'MtonR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '2',
        stack: 'track',
        power: 'Remove small station',
        description:
            'As its track lay, the owning company lays plain yellow track on an undeveloped hex with a single small station, or replaces a single small station tile with plain track of the next colour. Other track rules apply. Pays the owning company £10 each operating round until used, then closes.'
    },
    {
        id: 'P3',
        name: 'Shrewsbury and Hereford Railway',
        initials: 'S&HR',
        revenue: 0,
        color: 'red',
        acquiredFromPhaseId: '2',
        stack: 'trains',
        power: 'Permanent 2-train',
        description: `A permanent 2-train. ${PermanentTrain}`
    },
    {
        id: 'P4',
        name: 'South Devon Railway',
        initials: 'SDR',
        revenue: 0,
        color: 'red',
        acquiredFromPhaseId: '2',
        stack: 'trains',
        power: 'Permanent 2-train',
        description: `A permanent 2-train. ${PermanentTrain}`
    },
    {
        id: EnglishChannelPrivateId,
        name: 'London, Chatham and Dover Railway',
        initials: 'LC&DR',
        revenue: 10,
        color: 'red',
        acquiredFromPhaseId: '3',
        stack: 'track',
        power: 'English Channel',
        description: `The owning company places an exchange token free in the ${place(EnglishChannelLocationId)}, without needing a route there and apart from its token step. If no space is free, it may upgrade the ${place(EnglishChannelLocationId)} as its track lay, at the usual cost, to make one. Or it moves an exchange token to its available tokens.`
    },
    {
        id: 'P6',
        name: 'Leeds & Selby Railway',
        initials: 'L&SR',
        revenue: 10,
        color: 'red',
        acquiredFromPhaseId: '3',
        stack: 'other',
        power: 'Mail contract',
        description: MailContract
    },
    {
        id: 'P7',
        name: 'Shrewsbury and Birmingham Railway',
        initials: 'S&BR',
        revenue: 10,
        color: 'red',
        acquiredFromPhaseId: '3',
        stack: 'other',
        power: 'Mail contract',
        description: MailContract
    },
    {
        id: HillDiscountPrivateId,
        name: 'Edinburgh and Glasgow Railway',
        initials: 'E&GR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '3',
        stack: 'track',
        power: 'Mountain/hill discount',
        description:
            'When acquiring it the company either takes a token that pays the whole cost of one track lay on rough terrain, a hill or a mountain, which closes the private; or refuses the token and pays £20 less for every hill and mountain, though not rough terrain, and the private stays open.'
    },
    {
        id: DoubleCashPrivateId,
        name: 'Midland and Great Northern Joint Railway',
        initials: 'M&GNR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '3',
        stack: 'other',
        power: 'Declare 2× cash holding',
        description:
            'Its player owner may declare twice their cash at the end of a stock round, for the next round’s player order. Owned by a company it pays £20 while green tiles are the newest, £40 with brown and £60 with grey. Does not close.'
    },
    {
        id: RiverDiscountPrivateId,
        name: 'Glasgow and South-Western Railway',
        initials: 'G&SWR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '3',
        stack: 'track',
        power: 'River/estuary discount',
        description:
            'The owning company receives two tokens, each paying for one track lay across an estuary, on the same lay or different ones; using the second closes the private. Until then it also pays £10 less for river terrain, estuary crossings excepted.'
    },
    {
        id: AdvancedTileLayPrivateId,
        name: 'Bristol & Exeter Railway',
        initials: 'B&ER',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '2',
        stack: 'track',
        power: 'Advanced tile lay',
        description:
            'In place of its track lay, the owning company upgrades one plain or small station tile to the next colour of track before the phase makes it available. No colour is skipped and other track rules apply. Pays the owning company £10 each operating round until used, then closes.'
    },
    {
        id: ExtraTileLayPrivateId,
        name: 'Leicester & Swannington Railway',
        initials: 'L&SR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '3',
        stack: 'track',
        power: 'Extra tile lay',
        description:
            'In its track step the owning company lays one more yellow tile, two for a major company, or makes one more upgrade, which may be of a tile it has just laid. Other track rules apply. Pays the owning company £10 each operating round until used, then closes.'
    },
    {
        id: 'P13',
        name: 'York, Newcastle and Berwick Railway',
        initials: 'YN&BR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '5',
        stack: 'trains',
        power: 'Pullman',
        description: Pullman
    },
    {
        id: 'P14',
        name: 'Kilmarnock and Troon Railway',
        initials: 'K&TR',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '5',
        stack: 'trains',
        power: 'Pullman',
        description: Pullman
    },
    {
        id: 'P15',
        name: 'Highland Railway',
        initials: 'HR',
        revenue: 10,
        revenuePerPhase: true,
        color: 'green',
        acquiredFromPhaseId: '2',
        stack: 'other',
        power: '£10 × phase',
        description: phaseCredit(10)
    },
    {
        id: TaxHavenPrivateId,
        name: 'Off-Shore Tax Haven',
        initials: 'TH',
        revenue: 0,
        color: 'blue',
        stack: 'other',
        power: 'Tax haven',
        description:
            'As a stock round action its owner buys one available share certificate with their own money and places it on the tax haven. That share does not count for directorship, the 60% limit or the certificate limit, and may not be of a company the owner has sold this round. Its dividends collect on the tax haven; at the end of the game the owner counts the share and the money. Never acquired by a company and does not count against the certificate limit.'
    },
    {
        id: MoveCardPrivateId,
        name: 'Lancashire Union Railway',
        initials: 'LUR',
        revenue: 10,
        color: 'red',
        acquiredFromPhaseId: '2',
        stack: 'other',
        power: 'Move card',
        description:
            'The owning company’s director moves one concession, private company or minor company that is not in a bidding box to the top or the bottom of its stack. Closes when used.'
    },
    {
        id: StationSwapPrivateId,
        name: 'Cromford and High Peak Railway',
        initials: 'C&HPR',
        revenue: 10,
        color: 'red',
        acquiredFromPhaseId: '5',
        stack: 'other',
        power: 'Station marker swap',
        description:
            'The owning company moves a token from its exchange tokens to its available tokens, or the other way. Closes when used.'
    },
    {
        id: 'P19',
        name: 'Avonside Engine Company',
        initials: 'AEC',
        revenue: 0,
        color: 'green',
        acquiredFromPhaseId: '1',
        stack: 'trains',
        power: 'Permanent L-train',
        description:
            'A permanent L-train. It cannot be sold to another company, does not count against the train limit and is not the train a company must own. A company does not own it together with a permanent 2-train. Its earnings may be paid out, split or kept apart from the other trains’; a dividend from either counts as a dividend for the share price. Does not close.',
        expansion: true
    },
    {
        id: 'P20',
        name: 'Canterbury and Whitstable Railway',
        initials: 'C&WR',
        revenue: 5,
        revenuePerPhase: true,
        color: 'green',
        acquiredFromPhaseId: '3',
        stack: 'other',
        power: '£5 × phase',
        description: phaseCredit(5),
        expansion: true
    },
    {
        id: HumberBridgePrivateId,
        name: 'Humber Suspension Bridge Company',
        initials: 'HSBC',
        revenue: 10,
        color: 'green',
        acquiredFromPhaseId: '2',
        stack: 'track',
        power: 'Grimsby/Hull bridge',
        description: `As its track lay, the owning company, with a station in ${place(GrimsbyLocationId)} or ${place(HullLocationId)}, lays yellow tiles in either or both so that track joins the two cities across the Humber, without terrain costs. From phase 3, where one already has a yellow tile, one of the lays may be a green upgrade. Closes when used.`,
        expansion: true
    }
]
export const PrivateIds1822: readonly string[] = Privates1822.map(({ id }) => id)

export function private1822(companyId: string): Private1822 | undefined {
    return Privates1822.find((entry) => entry.id === companyId)
}
