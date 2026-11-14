export const MinimumPlayers1822 = 3
export const MaximumPlayers1822 = 7

/** The bank, the players' starting money included (§2.1.2). */
export const Bank1822 = 12_000

// Table 1: certificate limit, start money and bidding tokens by number of players (§2.1.9).
export const StartingCash1822: Readonly<Record<number, number>> = {
    3: 700,
    4: 525,
    5: 420,
    6: 350,
    7: 300
}

export const CertificateLimits1822: Readonly<Record<number, number>> = {
    3: 26,
    4: 20,
    5: 16,
    6: 13,
    7: 11
}

export const BiddingTokens1822: Readonly<Record<number, number>> = { 3: 6, 4: 5, 5: 4, 6: 3, 7: 3 }

/** Bidding boxes: four for minor companies, three each for concessions and privates (§4.5.1). */
export const BiddingBoxes1822 = { minor: 4, concession: 3, private: 3 } as const

/** Every bid is a whole multiple of £5 (§4.9.2). */
export const BidIncrement1822 = 5

/** A minor company's and a concession's face value, their lowest opening bid; a private's is £0 (§3.1.1, §3.2.6, §3.3.4, §4.9.2). */
export const FaceValues1822 = { minor: 100, concession: 100, private: 0 } as const

/** What a concession pays its owner each operating round (§3.2.4). */
export const ConcessionRevenue1822 = 10
