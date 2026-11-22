//! Two trains without a fleet policy. One train's routes are listed and the other's streamed
//! through them, in slices of so many steps of search, and between the slices the two trains
//! are kept apart. The slices follow one another the same way however long each takes, so the
//! search takes the same course on any machine until its time is up.

use super::{
    Candidates, Clock, Compiled, EARLY_SETTLING_SHARE, LISTING_FIRST_SHARE, Limit, Listed, Network,
    OPERATION_SHARE, ORDERING_MS, OUTLINE_SHARE, Outline, PATIENCE, Problem, Profile, Resume,
    SETTLING_ROUTINGS, SearchPlan, Selection, Settling, Solution, StreamingSelection, WhenFull,
    milliseconds, same_profile, selection_bytes,
};
use std::rc::Rc;

// The steps listing two differing trains' routes outright may take before the pair is outlined,
// and on a machine too slow for them the share of the time. The listing goes on from where it
// stopped, so what it lists is not lost on a pair it does not settle.
const FIRST_STEPS: u64 = 500_000;
const FIRST_TIME_SHARE: f64 = 0.25;
// The first slice of listing after the outline; each slice after it is twice the last.
const FIRST_SLICE: u64 = 200_000;
// Beside the listing and the stream through the whole list, two searches each take this part of
// a slice's steps: a stream through the list as far as it has come, and keeping the trains
// apart. Either takes half as many after each slice in which it found no better operation, down
// to this many halvings.
const SIDE_PART: u64 = 4;
const MOST_IDLE: u32 = 4;
// A stream through an unfinished list pairs with so many of its most valuable routes at first,
// and with so many times as many after each that came through. Finding them among the routes
// listed takes about a step for every so many.
const FIRST_LEADING: usize = 4096;
const LEADING_GROWTH: usize = 4;
const LISTED_PER_STEP: usize = 8;
// A list of so many routes that is not yet whole is a long one.
const LONG_LIST: usize = 100_000;
// Keeping the trains apart waits for so many times the steps the trains' best routes alone took.
const APART_ROUTINGS: u64 = 1;
// A full list goes on whole while dropping routes on the same track as better ones frees at
// least one part in so many of it. Dropping them is worth its steps while the solve has so many
// times as many left, for the rest of the list and the stream through it; with fewer, the list
// goes on cutting at once.
const FREED_PARTS: usize = 4;
const TIMES_TO_GO_ON: u64 = 6;

pub(super) fn solve(problem: &Problem, compiled: &Compiled, clock: Clock) -> Solution {
    sliced(
        problem,
        compiled,
        clock,
        Slices {
            first: Some(FIRST_STEPS),
            slice: FIRST_SLICE,
        },
    )
}

/// The steps of the listing outright, none where the pair is outlined at once, and of the first
/// slice after the outline.
pub(super) struct Slices {
    pub first: Option<u64>,
    pub slice: u64,
}

pub(super) fn sliced(
    problem: &Problem,
    compiled: &Compiled,
    clock: Clock,
    slices: Slices,
) -> Solution {
    let mut pair = Pair::new(problem, compiled, clock, slices);
    let pass = pair.run();
    pair.solution(&pass)
}

/// One train's routes worth more than a floor, listed in slices.
struct Listing {
    routes: Candidates,
    resume: Resume,
    finished: bool,
    // The floor asked for, and with it what memory left: every route worth more than `kept` is
    // listed, or will be.
    asked: Option<i32>,
    kept: Option<i32>,
    limited: bool,
    // The routes fill the memory. The listing stops there for a higher floor to make room, and
    // with none to be had goes on cutting: it keeps the most valuable half each time.
    full: bool,
    cutting: bool,
}

impl Listing {
    fn above(asked: Option<i32>, network: Network<'_>) -> Self {
        Self {
            routes: Candidates::new(network),
            resume: Resume::default(),
            finished: false,
            asked,
            kept: asked,
            limited: false,
            full: false,
            cutting: false,
        }
    }
}

/// One train's routes streamed through another's listed ones, in slices.
struct Stream<'a> {
    selection: Option<StreamingSelection<'a>>,
    resume: Resume,
    finished: bool,
}

/// One attempt at the pair: the stored train's routes above a floor, and the other train's
/// streamed through them once they are all listed.
struct Pass<'a> {
    listing: Listing,
    stream: Option<Stream<'a>>,
    // Where the stream through the most valuable routes of the unfinished list has come to,
    // and how many of them it pairs with. One that comes through begins again with more.
    probe: Resume,
    leading: usize,
    // The highest floor whose routes overflowed memory: no floor at or below it can be tried.
    overflowed: Option<i32>,
    // Memory cut the lists above what proves an answer, and no higher floor is worth listing.
    over: bool,
}

impl<'a> Pass<'a> {
    fn above(asked: Option<i32>, network: Network<'a>) -> Self {
        Self {
            listing: Listing::above(asked, network),
            stream: None,
            probe: Resume::default(),
            leading: FIRST_LEADING,
            overflowed: None,
            over: false,
        }
    }
}

struct Pair<'a> {
    problem: &'a Problem,
    compiled: &'a Compiled,
    network: Network<'a>,
    clock: Clock,
    whole: Limit,
    profiles: Vec<Rc<Profile>>,
    previous: Vec<Option<usize>>,
    alike: bool,
    // The train whose routes are listed, and the one whose routes are streamed through them.
    stored: usize,
    streamed: usize,
    // The bytes the listed routes may take.
    room: usize,
    // The best operation so far, and once sought the trains' best routes alone.
    outline: Outline,
    outlined: bool,
    settling: Option<Settling>,
    // What the operation earned when each train last tried to better it.
    bettered: i32,
    proved: bool,
    counts: Vec<usize>,
    slices: Slices,
}

impl<'a> Pair<'a> {
    fn new(problem: &'a Problem, compiled: &'a Compiled, clock: Clock, slices: Slices) -> Self {
        let network = compiled.network(problem);
        let previous: Vec<Option<usize>> =
            (0..2).map(|train| same_profile(problem, train)).collect();
        let first = Rc::new(network.profile(&problem.trains[0]));
        let alike = previous[1] == Some(0);
        let second = if alike {
            Rc::clone(&first)
        } else {
            Rc::new(network.profile(&problem.trains[1]))
        };
        // The train with the fewer routes is listed: by its distance, then its major stops.
        let reach = |train: usize| {
            let train = &problem.trains[train];
            (train.distance, train.major_limit.unwrap_or(u32::MAX))
        };
        let (stored, streamed) = if alike || reach(0) <= reach(1) {
            (0, 1)
        } else {
            (1, 0)
        };
        Self {
            problem,
            compiled,
            network,
            clock,
            whole: clock.whole(),
            profiles: vec![first, second],
            previous,
            alike,
            stored,
            streamed,
            room: (problem.memory_budget_bytes - compiled.bytes)
                .saturating_sub(network.streaming_scratch_bytes()),
            outline: Outline::new(2),
            outlined: false,
            settling: None,
            bettered: 0,
            proved: false,
            counts: vec![0; 2],
            slices,
        }
    }

    fn taken(&self) -> u64 {
        self.network.taken.get()
    }

    fn longest_bonus(&self) -> i32 {
        self.problem.longest_route_bonus_per_stop
    }

    /// The stages in turn: the routes listed outright, the outline, the trains kept apart while
    /// that finds better operations, and then slices of listing and streaming with the trains
    /// kept apart between them, each slice twice the last.
    fn run(&mut self) -> Pass<'a> {
        let mut pass = Pass::above(None, self.network);
        if let Some(first) = self.slices.first
            && !self.compiled.exhausted
            && !self.compiled.limited
        {
            self.list_outright(&mut pass, first);
        }
        if self.proved {
            return pass;
        }
        let began = self.taken();
        self.sketch();
        if self.proved {
            return pass;
        }
        self.keep_apart_early(began);
        self.review(&mut pass);
        let mut slice = self.slices.slice;
        // The slices in a row in which keeping the trains apart found nothing better, and those
        // in which a stream through an unfinished list did not: each halves its part of the next.
        let (mut apart_idle, mut probe_idle) = (0, 0);
        // The steps keeping the trains apart has yet to take: it takes them once they are
        // enough for the routings of one piece of shared track, which a slice cut short loses.
        let mut owed = 0;
        let routings = APART_ROUTINGS * self.outline.alone_steps;
        while !self.proved && !self.whole.reached(self.taken()) {
            let began = self.taken();
            if !pass.over {
                self.advance(&mut pass, self.whole.steps_on(self.taken(), slice));
            }
            if self.proved {
                break;
            }
            // A list that memory has cut proves nothing, and a long one not yet whole is far
            // from proving anything: the searches beside it then begin with as many steps as
            // the listing, and else with a part of them.
            let long = pass.over
                || pass.listing.limited
                || !pass.listing.finished && pass.listing.routes.len() >= LONG_LIST;
            let part = |idle: u32| (if long { slice } else { slice / SIDE_PART }) >> idle;
            if !pass.over && !pass.listing.finished {
                let before = self.outline.revenue;
                self.probe(&mut pass, part(probe_idle));
                probe_idle = Self::idle(probe_idle, self.outline.revenue > before);
            }
            // Keeping the trains apart is the one search that can prove anything beside a list
            // far from it, and takes its steps there whatever it has found.
            owed += part(if long { 0 } else { apart_idle });
            if owed >= routings {
                let before = self.outline.revenue;
                let limit = self.whole.steps_on(self.taken(), owed);
                self.better(limit);
                self.keep_apart(limit, None);
                apart_idle = Self::idle(apart_idle, self.outline.revenue > before);
                owed = 0;
            }
            if self.taken() == began && owed == 0 {
                break;
            }
            slice = slice.saturating_mul(2);
        }
        pass
    }

    /// Keeps the trains apart while that finds better operations, where the solve has room for
    /// enough routings to find any.
    fn keep_apart_early(&mut self, began: u64) {
        let early = self.clock.share(began, EARLY_SETTLING_SHARE);
        if self.outline.alone_steps * SETTLING_ROUTINGS <= early.steps.saturating_sub(self.taken())
        {
            self.keep_apart(early, Some(PATIENCE));
        }
    }

    /// The slices in a row without a better operation, after one more; a part of a slice is
    /// halved no more than so many times.
    fn idle(idle: u32, better: bool) -> u32 {
        if better { 0 } else { (idle + 1).min(MOST_IDLE) }
    }

    /// Lists the routes outright, as settles most pairs soonest. Two differing trains' listing
    /// is taken up again after the outline; two alike have their routes selected from one list.
    fn list_outright(&mut self, pass: &mut Pass<'a>, steps: u64) {
        if self.alike {
            self.select_outright();
            return;
        }
        let limit = Limit {
            deadline: self.clock.started + self.clock.budget_ms * FIRST_TIME_SHARE,
            steps,
        };
        self.advance(pass, limit);
        if pass.listing.finished {
            return;
        }
        // Until the other train's routes are streamed, the listed train's best route alone is
        // an operation.
        let bonus = self.longest_bonus();
        let routes = &pass.listing.routes;
        let best =
            (0..routes.len()).max_by_key(|&id| (routes[id].value(bonus), std::cmp::Reverse(id)));
        if let Some(id) = best
            && routes[id].value(bonus) > self.outline.revenue
        {
            let lone = routes.lone(id, self.stored, self.network);
            self.outline.adopt(routes[id].value(bonus), vec![lone]);
        }
    }

    /// Two alike trains' routes listed once and selected among, within a small part of the solve.
    fn select_outright(&mut self) {
        let limit = self.clock.share(0, LISTING_FIRST_SHARE);
        let rows = self.problem.memory_budget_bytes / 4;
        let search = self.network.search(
            &self.problem.trains[0],
            SearchPlan {
                profile: Rc::clone(&self.profiles[0]),
                closed: None,
                limit: limit.shortened(self.clock.started, 0.75),
                memory_budget: self.problem.memory_budget_bytes - rows - self.compiled.bytes,
                selection_bytes_per_candidate: selection_bytes(self.problem),
                best_only: false,
                floor: None,
                streaming: None,
                listed: None,
                when_full: WhenFull::Halve,
            },
        );
        self.counts = vec![search.count; 2];
        let whole = !search.exhausted && !search.limited;
        let routes = Rc::new(search.candidates);
        let candidates = [Rc::clone(&routes), routes];
        let (revenue, routes, selected) =
            Selection::new(&candidates, self.network, limit, rows).operation(0, &candidates);
        if revenue > self.outline.revenue {
            self.outline.adopt(revenue, routes);
        }
        self.proved = whole && selected;
    }

    /// The trains' best routes alone and a first operation; with every train on its best route
    /// nothing earns more.
    fn sketch(&mut self) {
        let network = self.network;
        let began = self.taken();
        network.seek_bests(
            &mut self.outline,
            &self.profiles,
            &self.previous,
            (self.clock.share(began, OUTLINE_SHARE), self.room),
        );
        network.first_operation(
            &mut self.outline,
            &self.profiles,
            (self.clock.share(began, OPERATION_SHARE), self.room),
        );
        self.outlined = true;
        self.bettered = self.outline.revenue;
        self.proved = self
            .outline
            .most()
            .is_some_and(|most| i64::from(self.outline.revenue) >= most);
        // The longest-route bonus is no sum of two routes' worth, so the trains are not kept
        // apart where it is paid.
        if self.longest_bonus() == 0 {
            self.settling = Settling::new(self.problem, &self.profiles, &self.outline);
        }
    }

    fn keep_apart(&mut self, limit: Limit, patience: Option<usize>) {
        let Some(settling) = &mut self.settling else {
            return;
        };
        let room = (self.problem.memory_budget_bytes - self.compiled.bytes) / 4;
        self.proved = self.network.settle(
            &self.profiles,
            &mut self.outline,
            settling,
            (limit, room),
            patience,
        );
    }

    /// Each train in turn takes its best route beside the other's, where the operation has
    /// changed since they last did.
    fn better(&mut self, limit: Limit) {
        if self.outline.revenue == self.bettered {
            return;
        }
        let room = (self.problem.memory_budget_bytes - self.compiled.bytes) / 4;
        self.network
            .improve(&self.profiles, &mut self.outline, (limit, room));
        self.bettered = self.outline.revenue;
    }

    /// What a route of the stored train must be worth more than to be part of a better
    /// operation: half the operation where the trains are alike, as one of two alike routes is
    /// worth that, and else the operation less the other train's best route, once that is known.
    fn needed(&self) -> Option<i32> {
        if self.alike {
            self.outlined.then_some(self.outline.revenue / 2)
        } else {
            self.outline.floor(self.stored)
        }
    }

    /// After the outline, whether the listing so far can still prove an answer: two alike
    /// trains' routes are listed anew above half the operation, and a list that memory cut
    /// above what a better operation needs is begun again above that.
    fn review(&mut self, pass: &mut Pass<'a>) {
        let needed = self.needed();
        let cut_too_high = pass.listing.limited
            && needed.is_some_and(|needed| pass.listing.kept.is_some_and(|kept| kept > needed));
        if self.alike || cut_too_high {
            self.begin(pass, needed);
        }
    }

    fn begin(&mut self, pass: &mut Pass<'a>, asked: Option<i32>) {
        let overflowed = pass.overflowed;
        self.outline.listed = vec![None, None];
        *pass = Pass::above(asked, self.network);
        pass.overflowed = overflowed;
    }

    /// Takes the pass on within the limit: lists the stored train's routes, and once they are
    /// all listed streams the other train's through them. A stream that comes through has
    /// tried every pair with a listed route: the operation is proved where the list holds every
    /// route a better one needs, and where memory cut it short another list is begun above
    /// what the better operation found now needs, if that could fit.
    fn advance(&mut self, pass: &mut Pass<'a>, limit: Limit) {
        while !pass.over {
            if !pass.listing.finished {
                self.list(&mut pass.listing, limit);
                if pass.listing.full {
                    // A higher floor makes room, and before the outline none is known yet.
                    // With none to come, the routes on the same track as better ones are
                    // dropped; where that frees too little, or there is too little time for
                    // it, the listing goes on cutting.
                    let needed = self.needed();
                    if needed
                        .is_some_and(|needed| pass.listing.kept.is_none_or(|kept| kept < needed))
                    {
                        continue;
                    }
                    if !self.outlined {
                        return;
                    }
                    pass.listing.cutting = true;
                    if self.time_to_order(&pass.listing.routes)
                        && self.clock.steps_left(self.taken())
                            >= TIMES_TO_GO_ON * Clock::ordering_steps(pass.listing.routes.len())
                    {
                        let filled = pass.listing.routes.len();
                        pass.listing.routes.dedup(self.network);
                        pass.listing.cutting =
                            pass.listing.routes.len() * FREED_PARTS > filled * (FREED_PARTS - 1);
                    }
                    continue;
                }
                if !pass.listing.finished {
                    return;
                }
                // Two alike trains' routes that overflow memory are listed above a floor
                // halfway to their best: their pairs may better the operation, which a list
                // above half of it then proves.
                if self.alike && pass.listing.limited {
                    let asked = pass.listing.asked.unwrap_or(0);
                    pass.overflowed =
                        Some(pass.overflowed.map_or(asked, |highest| highest.max(asked)));
                    match self.outline.alone[self.stored] {
                        Some(best) if asked < best => {
                            self.begin(pass, Some((asked + best + 1) / 2))
                        }
                        _ => pass.over = true,
                    }
                    continue;
                }
            }
            if pass.stream.is_none() && !self.time_to_order(&pass.listing.routes) {
                return;
            }
            let stream = pass.stream.get_or_insert_with(|| {
                let routes = Rc::new(std::mem::replace(
                    &mut pass.listing.routes,
                    Candidates::new(self.network),
                ));
                self.share(&routes, pass.listing.kept);
                Stream {
                    selection: Some(StreamingSelection::new(
                        routes,
                        self.network,
                        limit.deadline,
                        self.problem.memory_budget_bytes - self.compiled.bytes,
                    )),
                    resume: Resume::default(),
                    finished: false,
                }
            });
            if !stream.finished {
                self.stream(stream, limit);
                if !stream.finished {
                    return;
                }
            }
            let needed = self.needed();
            let kept = pass.listing.kept;
            if kept.is_none_or(|kept| needed.is_some_and(|needed| kept <= needed)) {
                self.proved = true;
                return;
            }
            let fits = match (needed, self.alike) {
                (Some(needed), true) => pass.overflowed.is_none_or(|highest| needed > highest),
                (Some(needed), false) => pass.listing.asked.is_none_or(|asked| needed > asked),
                (None, _) => false,
            };
            if fits {
                self.begin(pass, needed);
            } else {
                pass.over = true;
            }
        }
    }

    /// Whether the time left is enough to put the routes in order, or index them: that takes
    /// about so long for each, and cannot be cut short.
    fn time_to_order(&self, routes: &Candidates) -> bool {
        milliseconds() + routes.len() as f64 * ORDERING_MS <= self.whole.deadline
    }

    /// The routes listed whole are looked up where a train's best route clear of some track is
    /// wanted: the stored train's, and both trains' where they are alike. The longest route's
    /// bonus is not in the order they are listed in.
    fn share(&mut self, routes: &Rc<Candidates>, kept: Option<i32>) {
        if self.longest_bonus() != 0 {
            return;
        }
        for train in 0..2 {
            if train == self.stored || self.alike {
                self.outline.listed[train] = Some(Listed {
                    routes: Rc::clone(routes),
                    floor: kept,
                });
            }
        }
    }

    /// Lists on, above the floor asked for or what a better operation now needs if that is more.
    fn list(&mut self, listing: &mut Listing, limit: Limit) {
        let bonus = self.longest_bonus();
        if let Some(needed) = self.needed()
            && listing.asked.is_none_or(|asked| asked < needed)
        {
            listing.asked = Some(needed);
        }
        if let Some(asked) = listing.asked
            && listing.kept.is_none_or(|kept| kept < asked)
        {
            listing.routes.keep_above(asked, bonus);
            listing.kept = Some(asked);
        }
        let routes = std::mem::replace(&mut listing.routes, Candidates::new(self.network));
        let search = self.network.search(
            &self.problem.trains[self.stored],
            SearchPlan {
                profile: Rc::clone(&self.profiles[self.stored]),
                closed: None,
                limit,
                memory_budget: self.room,
                selection_bytes_per_candidate: if bonus == 0 {
                    0
                } else {
                    std::mem::size_of::<usize>()
                },
                best_only: false,
                floor: listing.kept,
                streaming: None,
                listed: Some((routes, std::mem::take(&mut listing.resume))),
                when_full: if listing.cutting {
                    WhenFull::Raise
                } else {
                    WhenFull::Pause
                },
            },
        );
        self.counts[self.stored] += search.count;
        listing.finished = !search.exhausted;
        listing.full = search.full;
        listing.limited |= search.limited;
        listing.kept = search.floor;
        listing.resume = search.cut;
        listing.routes = search.candidates;
    }

    /// Streams on, and takes a better pair for the operation.
    fn stream(&mut self, stream: &mut Stream<'a>, limit: Limit) {
        let mut selection = stream
            .selection
            .take()
            .expect("a stream keeps its selection");
        selection.seed(self.outline.revenue);
        selection.go_on(limit.deadline);
        let search = self.network.search(
            &self.problem.trains[self.streamed],
            SearchPlan {
                profile: Rc::clone(&self.profiles[self.streamed]),
                closed: None,
                limit,
                memory_budget: 0,
                selection_bytes_per_candidate: 0,
                best_only: false,
                floor: None,
                streaming: Some(selection),
                listed: Some((
                    Candidates::new(self.network),
                    std::mem::take(&mut stream.resume),
                )),
                when_full: WhenFull::Halve,
            },
        );
        self.counts[self.streamed] += search.count;
        stream.finished = !search.exhausted;
        stream.resume = search.cut;
        let selection = search
            .streaming
            .expect("a streamed search keeps its selection");
        if selection.revenue > self.outline.revenue {
            self.outline.adopt(
                selection.revenue,
                selection.operation(self.stored, self.streamed),
            );
        }
        stream.selection = Some(selection);
    }

    /// Streams the other train's routes through the most valuable of the list as far as it
    /// has come, on from where the last such stream stopped. It proves nothing, but its pairs
    /// are operations, and few stored routes leave few of the other train's worth streaming.
    /// Finding the most valuable takes about a step for each route paired with and for every
    /// few listed, so it waits for a slice that gives it as many.
    fn probe(&mut self, pass: &mut Pass<'a>, steps: u64) {
        let listed = pass.listing.routes.len();
        let leading = pass.leading.min(listed);
        if listed == 0
            || steps < (leading + listed / LISTED_PER_STEP) as u64
            || !self.time_to_order(&pass.listing.routes)
        {
            return;
        }
        let resume = std::mem::take(&mut pass.probe);
        let limit = self.whole.steps_on(self.taken(), steps);
        pass.listing.routes.rank_leading(leading);
        let routes = Rc::new(std::mem::replace(
            &mut pass.listing.routes,
            Candidates::new(self.network),
        ));
        let mut stream = Stream {
            selection: Some(StreamingSelection::leading(
                Rc::clone(&routes),
                leading,
                self.network,
                limit.deadline,
                self.problem.memory_budget_bytes - self.compiled.bytes,
            )),
            resume,
            finished: false,
        };
        self.stream(&mut stream, limit);
        if stream.finished {
            pass.leading = pass.leading.saturating_mul(LEADING_GROWTH);
        } else {
            pass.probe = stream.resume;
        }
        drop(stream.selection);
        pass.listing.routes = Rc::into_inner(routes).expect("the probe alone shared the list");
    }

    fn solution(&self, pass: &Pass<'a>) -> Solution {
        let exhaustive = self.proved && !self.compiled.exhausted;
        let counts = self
            .counts
            .iter()
            .zip(&self.outline.counts)
            .map(|(listed, sought)| listed + sought)
            .collect();
        Solution {
            revenue: self.outline.revenue,
            subsidy: 0,
            routes: self.outline.operation(),
            exhaustive,
            path_exhaustive: exhaustive,
            combination_exhaustive: self.proved,
            candidates: counts,
            memory_limited: self.compiled.limited
                || !self.proved && (pass.over || pass.listing.limited),
            expansions: self.taken(),
            connections: self.compiled.connections.len(),
            compile_ms: self.clock.compile_ms,
            path_ms: milliseconds() - self.clock.started - self.clock.compile_ms,
            combination_ms: 0.0,
        }
    }
}
