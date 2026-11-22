use super::{Connection, Problem, Train};

/// One connection on from a stop, in the order a search tries them: the stops that pay the train
/// most first, each stop's connections of one class together, and within a class those that
/// leave the stop on the same track.
#[derive(Clone, Copy)]
pub(super) struct Move {
    pub connection: usize,
    pub class: usize,
    // Where the connections leaving on other track, the next class, and the next stop's
    // connections begin among the stop's moves.
    pub run_end: usize,
    pub class_end: usize,
    pub stop_end: usize,
}

/// Every stop's moves for one train.
pub(super) struct Order {
    pub moves: Vec<Vec<Move>>,
    own: Vec<usize>,
    own_ends: Vec<usize>,
    // By stop, the pieces of track its moves run on, each with the moves that do, as bits.
    users: Vec<Users>,
}

#[derive(Default)]
struct Users {
    // Each piece of track with the place of its moves in `moves`, by piece of track.
    rows: Vec<(usize, usize)>,
    moves: Vec<u64>,
    words: usize,
}

impl Order {
    /// How many words hold one bit for each of the stop's moves.
    pub(super) fn words(&self, stop: usize) -> usize {
        self.users[stop].words
    }

    /// The stop's moves that run on the piece of track, as bits.
    pub(super) fn users(&self, stop: usize, r: usize) -> &[u64] {
        let users = &self.users[stop];
        users
            .rows
            .binary_search_by_key(&r, |&(track, _)| track)
            .map_or(&[], |row| {
                let at = users.rows[row].1;
                &users.moves[at..at + users.words]
            })
    }

    /// The connection's track that only connections of its first stop run on: the way it leaves
    /// the stop, which the connection a route arrived on is the likeliest to be using.
    pub(super) fn own(&self, connection: usize) -> &[usize] {
        let start = connection
            .checked_sub(1)
            .map_or(0, |before| self.own_ends[before]);
        &self.own[start..self.own_ends[connection]]
    }
}

/// What a connection does to a route besides using track: the stop it reaches, what it uses of
/// the train's distance, its terminus track, and the hexes it pays for or closes.
struct Class {
    cost: u32,
    terminus: [bool; 4],
    hexes: Vec<usize>,
    // The hexes entered that a route may not enter again.
    closed: Vec<usize>,
    // Its place among the classes on to its stop, in the order tried.
    place: usize,
    // The classes on to its stop, by place, that leave what follows at least as well off: the
    // same cost and terminus track, every hex of this class that pays, and no hex that charges.
    betters: u64,
}

pub(super) struct Classes {
    classes: Vec<Class>,
    // The one stop every connection on a piece of track begins or ends at, if any; track only
    // connections between one pair of stops run on is of no further use to a route with both.
    home: Vec<usize>,
}

const SHARED: usize = usize::MAX;
const PAIRED: usize = usize::MAX - 1;
const UNOWNED: usize = usize::MAX;

fn homes(problem: &Problem, connections: &[Connection]) -> Vec<usize> {
    let mut ends = vec![[SHARED; 2]; problem.resource_count];
    let mut seen = vec![false; problem.resource_count];
    for edge in connections {
        for &r in &edge.resources {
            if !seen[r] {
                seen[r] = true;
                ends[r] = [edge.from, edge.to];
            } else {
                for end in &mut ends[r] {
                    if *end != edge.from && *end != edge.to {
                        *end = SHARED;
                    }
                }
            }
        }
    }
    ends.into_iter()
        .map(|ends| match ends {
            [SHARED, SHARED] => SHARED,
            [stop, SHARED] | [SHARED, stop] => stop,
            _ => PAIRED,
        })
        .collect()
}

/// Which of a stop's moves run on each piece of track.
fn users(connections: &[Connection], moves: &[Move], row_of: &mut [usize]) -> Users {
    let mut users = Users {
        words: moves.len().div_ceil(64),
        ..Users::default()
    };
    for (place, step) in moves.iter().enumerate() {
        for &r in &connections[step.connection].resources {
            if row_of[r] == usize::MAX {
                row_of[r] = users.moves.len();
                users.rows.push((r, row_of[r]));
                users.moves.resize(row_of[r] + users.words, 0);
            }
            users.moves[row_of[r] + place / 64] |= 1 << (place % 64);
        }
    }
    for &(r, _) in &users.rows {
        row_of[r] = usize::MAX;
    }
    users.rows.sort_unstable();
    users
}

/// The order one train's search for its best route tries connections in, and their classes.
pub(super) fn order(
    problem: &Problem,
    connections: &[Connection],
    stays: &[Vec<usize>],
    adjacency: &[Vec<usize>],
    train: &Train,
) -> (Order, Classes) {
    let home = homes(problem, connections);
    let mut own = vec![];
    let own_ends: Vec<usize> = connections
        .iter()
        .map(|edge| {
            own.extend(edge.resources.iter().filter(|&&r| home[r] == edge.from));
            own.len()
        })
        .collect();
    let mut order = Order {
        moves: vec![],
        own,
        own_ends,
        users: vec![],
    };
    let mut row_of = vec![usize::MAX; problem.resource_count];
    let mut ids = std::collections::HashMap::new();
    let mut classes: Vec<Class> = vec![];
    let class_of: Vec<usize> = connections
        .iter()
        .enumerate()
        .map(|(id, edge)| {
            let mut closed: Vec<usize> = stays
                .get(id)
                .into_iter()
                .flatten()
                .copied()
                .filter(|&hex| problem.forbids_reentry(hex))
                .collect();
            closed.sort_unstable();
            closed.dedup();
            let cost = train.crossing_cost(edge);
            let terminus = [
                edge.first_terminal,
                edge.last_terminal,
                edge.departs_terminal,
                edge.paths.len() == 1,
            ];
            let key = (
                (edge.from, edge.to, cost),
                terminus,
                edge.hexes.clone(),
                closed.clone(),
            );
            *ids.entry(key).or_insert_with(|| {
                classes.push(Class {
                    cost,
                    terminus,
                    hexes: edge.hexes.clone(),
                    closed,
                    place: 0,
                    betters: 0,
                });
                classes.len() - 1
            })
        })
        .collect();
    let gain = |class: usize| -> i32 {
        classes[class]
            .hexes
            .iter()
            .map(|&hex| problem.hex_bonuses[hex])
            .sum()
    };
    // Within a class the least track first, as it keeps the least out: by the ways out of the
    // stop, each with its shortest connection first.
    let mut shortest = std::collections::HashMap::new();
    for (id, edge) in connections.iter().enumerate() {
        let least = shortest
            .entry((class_of[id], order.own(id)))
            .or_insert(usize::MAX);
        *least = edge.resources.len().min(*least);
    }
    let ordered: Vec<Vec<usize>> = adjacency
        .iter()
        .map(|from| {
            let mut ordered = from.clone();
            ordered.sort_by_key(|&id| {
                let edge = &connections[id];
                (
                    std::cmp::Reverse(train.revenues[edge.to]),
                    edge.to,
                    std::cmp::Reverse(gain(class_of[id])),
                    class_of[id],
                    shortest[&(class_of[id], order.own(id))],
                    order.own(id),
                    edge.resources.len(),
                )
            });
            ordered
        })
        .collect();
    for ordered in ordered {
        let mut moves: Vec<Move> = ordered
            .iter()
            .map(|&connection| Move {
                connection,
                class: class_of[connection],
                run_end: 0,
                class_end: 0,
                stop_end: 0,
            })
            .collect();
        let mut ends = [moves.len(); 3];
        for index in (0..moves.len()).rev() {
            if let Some(next) = moves.get(index + 1) {
                let (id, following) = (moves[index].connection, next.connection);
                if connections[id].to != connections[following].to {
                    ends = [index + 1; 3];
                } else if moves[index].class != next.class {
                    ends = [index + 1, index + 1, ends[2]];
                } else if order.own(id) != order.own(following) {
                    ends[0] = index + 1;
                }
            }
            [
                moves[index].run_end,
                moves[index].class_end,
                moves[index].stop_end,
            ] = ends;
        }
        let mut first = 0;
        while first < moves.len() {
            let end = moves[first].stop_end;
            let mut onward: Vec<usize> = vec![];
            let mut at = first;
            while at < end {
                onward.push(moves[at].class);
                at = moves[at].class_end;
            }
            for (place, &class) in onward.iter().enumerate() {
                classes[class].place = place;
                classes[class].betters = onward
                    .iter()
                    .take(64)
                    .enumerate()
                    .filter(|&(_, &other)| betters(problem, &classes[other], &classes[class]))
                    .fold(0, |bits, (place, _)| bits | 1 << place);
            }
            first = end;
        }
        order.users.push(users(connections, &moves, &mut row_of));
        order.moves.push(moves);
    }
    (order, Classes { classes, home })
}

fn betters(problem: &Problem, better: &Class, class: &Class) -> bool {
    better.cost == class.cost
        && better.terminus == class.terminus
        && class
            .hexes
            .iter()
            .all(|hex| problem.hex_bonuses[*hex] < 0 || better.hexes.contains(hex))
        && better
            .hexes
            .iter()
            .all(|hex| problem.hex_bonuses[*hex] > 0 || class.hexes.contains(hex))
}

/// For one train's best route, connections on to the same stop differ in what follows only by
/// the track they use and the hexes they close. After walking everything that follows one of
/// them, another is walked only for what the first kept out: what follows it and would have
/// used track, or entered a hex, of the first that the other leaves free. Each connection that
/// cannot be taken notes one piece of track or hex in its way against the connection using it.
pub(super) struct Alike {
    rules: std::rc::Rc<Classes>,
    // The place in the route of the connection on each piece of track, and of the one that
    // entered each hex.
    owner: Vec<usize>,
    hex_owner: Vec<usize>,
    // Which stay of a connection in the route last noted each piece of track and hex.
    noted: Vec<u64>,
    hex_noted: Vec<u64>,
    stays: u64,
    levels: Vec<Level>,
}

/// The search at one place in the route.
#[derive(Default)]
struct Level {
    // The connection the route takes from here: this stay of it, and the track and hexes of it
    // that kept a later connection out.
    stay: u64,
    blocking: Vec<usize>,
    blocking_hexes: Vec<usize>,
    // Connections already walked from here on to the stop now tried: the classes, by place,
    // whose connection kept nothing out, and the others with what they kept out.
    stop: usize,
    free: u64,
    walked: Vec<Walked>,
    kept: Vec<usize>,
    // Arriving here: sets of the stop's own track, of each of which the connection taken on
    // must use some.
    needs: Vec<usize>,
    need_ends: Vec<usize>,
}

/// A connection walked in full, and what of it kept later connections out: track other stops'
/// connections run on, track only the reached stop's connections run on, and hexes.
struct Walked {
    class: usize,
    shared: std::ops::Range<usize>,
    reached: std::ops::Range<usize>,
    hexes: std::ops::Range<usize>,
}

/// What the search does with a connection it could take.
pub(super) enum Verdict {
    /// Everything that follows it was walked after another connection.
    Covered,
    /// What follows it is walked: all of it, or only what leaves the reached stop on the track
    /// the next level needs.
    Walk { narrowed: bool },
}

impl Alike {
    pub(super) fn new(problem: &Problem, rules: std::rc::Rc<Classes>) -> Self {
        Self {
            rules,
            owner: vec![UNOWNED; problem.resource_count],
            hex_owner: vec![UNOWNED; problem.hex_bonuses.len()],
            noted: vec![0; problem.resource_count],
            hex_noted: vec![0; problem.hex_bonuses.len()],
            stays: 0,
            levels: (0..problem.stops.len() + 2)
                .map(|_| Level::default())
                .collect(),
        }
    }

    /// The route starts in a hex no connection of it entered.
    pub(super) fn start(&mut self, hex: usize) {
        self.hex_owner[hex] = UNOWNED;
    }

    /// Begins trying the connections on from the stop at this place in the route.
    pub(super) fn arrive(&mut self, depth: usize) {
        self.levels[depth].stop = usize::MAX;
    }

    /// Whether every connection of the class on to the stop is covered by one already walked
    /// from here that kept nothing out.
    pub(super) fn class_covered(&mut self, depth: usize, to: usize, class: usize) -> bool {
        let level = &mut self.levels[depth];
        if level.stop != to {
            level.stop = to;
            level.free = 0;
            level.walked.clear();
            level.kept.clear();
        }
        level.free & self.rules.classes[class].betters != 0
    }

    /// Whether connections leaving the stop on this track use some of each set the arrival
    /// here needs.
    pub(super) fn meets_needs(&self, depth: usize, own: &[usize]) -> bool {
        let level = &self.levels[depth];
        let mut start = 0;
        level.need_ends.iter().all(|&end| {
            let met = level.needs[start..end].iter().any(|r| own.contains(r));
            start = end;
            met
        })
    }

    /// Notes that a piece of track in use keeps a connection out.
    pub(super) fn blocked_by(&mut self, r: usize) {
        let owner = self.owner[r];
        if owner != UNOWNED && self.noted[r] != self.levels[owner].stay {
            self.noted[r] = self.levels[owner].stay;
            self.levels[owner].blocking.push(r);
        }
    }

    /// Notes that a hex the route has entered keeps a connection out.
    pub(super) fn closed_by(&mut self, hex: usize) {
        let owner = self.hex_owner[hex];
        if owner != UNOWNED && self.hex_noted[hex] != self.levels[owner].stay {
            self.hex_noted[hex] = self.levels[owner].stay;
            self.levels[owner].blocking_hexes.push(hex);
        }
    }

    /// Whether what follows the connection needs walking, given those walked from here on to
    /// its stop. One of them covers it if this one too has all the track and hexes of it that
    /// kept something out; if the only such track this one frees is the reached stop's own,
    /// only what leaves the stop on that track is new.
    pub(super) fn verdict(&mut self, depth: usize, edge: &Connection, class: usize) -> Verdict {
        let (levels, next) = self.levels.split_at_mut(depth + 1);
        let (level, next) = (&levels[depth], &mut next[0]);
        next.needs.clear();
        next.need_ends.clear();
        let classes = &self.rules.classes;
        let own = &classes[class];
        let has = |r: &usize| edge.resources.binary_search(r).is_ok();
        for walked in &level.walked {
            let other = &classes[walked.class];
            let better =
                walked.class == class || other.place < 64 && own.betters >> other.place & 1 == 1;
            if !better
                || !level.kept[walked.hexes.clone()]
                    .iter()
                    .all(|hex| own.closed.contains(hex))
                || !level.kept[walked.shared.clone()].iter().all(has)
            {
                continue;
            }
            let before = next.needs.len();
            next.needs.extend(
                level.kept[walked.reached.clone()]
                    .iter()
                    .filter(|r| !has(r)),
            );
            if next.needs.len() == before {
                next.needs.clear();
                next.need_ends.clear();
                return Verdict::Covered;
            }
            next.need_ends.push(next.needs.len());
        }
        Verdict::Walk {
            narrowed: !next.need_ends.is_empty(),
        }
    }

    /// Takes the connection at this place in the route.
    pub(super) fn take(&mut self, depth: usize, edge: &Connection, entered: &[usize]) {
        self.stays += 1;
        let level = &mut self.levels[depth];
        level.stay = self.stays;
        level.blocking.clear();
        level.blocking_hexes.clear();
        for &r in &edge.resources {
            self.owner[r] = depth;
        }
        for &hex in entered {
            self.hex_owner[hex] = depth;
        }
    }

    /// Leaves the connection after walking what follows it, keeping what it kept out unless
    /// only part of what follows was walked.
    pub(super) fn leave(&mut self, depth: usize, edge: &Connection, class: usize, narrowed: bool) {
        let (levels, next) = self.levels.split_at_mut(depth + 1);
        let level = &mut levels[depth];
        next[0].needs.clear();
        next[0].need_ends.clear();
        if narrowed {
            return;
        }
        let home = &self.rules.home;
        let shared = level.kept.len();
        level
            .kept
            .extend(level.blocking.iter().filter(|&&r| home[r] == SHARED));
        let reached = level.kept.len();
        level
            .kept
            .extend(level.blocking.iter().filter(|&&r| home[r] == edge.to));
        let hexes = level.kept.len();
        level.kept.extend(&level.blocking_hexes);
        let place = self.rules.classes[class].place;
        if level.kept.len() == shared && place < 64 {
            level.free |= 1 << place;
        } else {
            level.walked.push(Walked {
                class,
                shared: shared..reached,
                reached: reached..hexes,
                hexes: hexes..level.kept.len(),
            });
        }
    }
}
