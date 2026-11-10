use super::*;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

#[derive(Deserialize)]
pub(super) struct Policy {
    shared_track: bool,
    pay_once: bool,
    payment_groups: Vec<usize>,
    connectivity: Option<Connectivity>,
    minimum_cities: usize,
    coordinates: Vec<Coordinates>,
    bonus_per_hex: i32,
    end_rates: Vec<i32>,
    offboard_distance: bool,
}

#[derive(Deserialize)]
struct Connectivity {
    root: Option<usize>,
    stops: Vec<bool>,
}

#[derive(Deserialize, Clone, Copy)]
struct Coordinates {
    q: i32,
    r: i32,
}

impl Coordinates {
    fn distance(self, other: Self) -> i32 {
        let q = self.q - other.q;
        let r = self.r - other.r;
        q.abs().max(r.abs()).max((q + r).abs())
    }
}

#[derive(Deserialize, PartialEq)]
pub(super) struct TrainPolicy {
    paying: Vec<bool>,
    limited: Vec<bool>,
    paying_limit: Option<usize>,
    hex_subsidy: i32,
    freight: Option<Freight>,
}

#[derive(Deserialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum Freight {
    Required,
    Optional,
}

pub(super) fn validate(problem: &Problem) -> Result<(), String> {
    let Some(policy) = &problem.fleet else {
        return if problem.trains.iter().any(|train| train.fleet.is_some()) {
            Err("Fleet train requires fleet policy".into())
        } else {
            Ok(())
        };
    };
    let n = problem.stops.len();
    if policy.payment_groups.len() != n
        || policy.payment_groups.iter().any(|&group| group >= n)
        || policy.end_rates.len() != n
        || policy.coordinates.len() != problem.hex_bonuses.len()
        || policy.connectivity.as_ref().is_some_and(|connection| {
            connection.stops.len() != n || connection.root.is_some_and(|root| root >= n)
        })
        || policy.bonus_per_hex < 0
        || policy.end_rates.iter().any(|&rate| rate < 0)
        || problem.longest_route_bonus_per_stop != 0
        || problem.hex_bonuses.iter().any(|&amount| amount != 0)
    {
        return Err("Invalid fleet policy".into());
    }
    for train in &problem.trains {
        let Some(fleet) = &train.fleet else {
            return Err("Fleet requires a policy for each train".into());
        };
        if fleet.paying.len() != n
            || fleet.limited.len() != n
            || fleet.paying_limit == Some(0)
            || fleet.hex_subsidy < 0
            || train.scores_payments()
            || train.first_bonus.iter().any(|&amount| amount != 0)
        {
            return Err("Unsupported fleet train policy".into());
        }
    }
    Ok(())
}

pub(super) fn allowed_shape(network: Network<'_>, walking: &[usize], start: usize) -> bool {
    let Some(policy) = &network.problem.fleet else {
        return true;
    };
    std::iter::once(start)
        .chain(walking.iter().map(|&id| network.connections[id].to))
        .filter(|&id| network.problem.stops[id].city)
        .count()
        >= policy.minimum_cities
}

#[derive(Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord)]
struct End {
    stop: usize,
    hex: usize,
    offboard: bool,
}

type Bits = Vec<u64>;

fn bits(len: usize) -> Bits {
    vec![0; len.div_ceil(64)]
}

fn mark(bits: &mut [u64], index: usize) {
    bits[index / 64] |= 1 << (index % 64);
}

fn bit(bits: &[u64], index: usize) -> bool {
    bits[index / 64] >> (index % 64) & 1 == 1
}

fn within(inner: &[u64], outer: &[u64]) -> bool {
    inner
        .iter()
        .zip(outer)
        .all(|(inner, outer)| inner & !outer == 0)
}

fn meet(a: &[u64], b: &[u64]) -> bool {
    a.iter().zip(b).any(|(a, b)| a & b != 0)
}

fn join(into: &mut [u64], from: &[u64]) {
    for (into, from) in into.iter_mut().zip(from) {
        *into |= from;
    }
}

/// The amount `list`, sorted by item, pays for `item`.
fn amount(list: &[(usize, i32)], item: usize) -> i32 {
    list.binary_search_by_key(&item, |&(item, _)| item)
        .map_or(0, |index| list[index].1)
}

/// Raises what `list` pays for `item` to `value`.
fn raise(list: &mut Vec<(usize, i32)>, item: usize, value: i32) {
    if value <= 0 {
        return;
    }
    match list.binary_search_by_key(&item, |&(item, _)| item) {
        Ok(index) => list[index].1 = list[index].1.max(value),
        Err(index) => list.insert(index, (item, value)),
    }
}

/// One way to run a unit of the fleet: a route for one train, or a chain of freight routes.
///
/// `cover` is what the routes pay that another route could pay instead, as (item, amount) by item;
/// the items are the payment groups, then the hexes, then the pairs of payment groups that chains
/// run between, and each pays its best amount once across the fleet. `add` is everything else:
/// every stop and every chain's distance bonus when those pay per train. Scoring a fleet is then a
/// sum of `add` plus a weighted cover, which is what lets the search bound a unit by its best
/// remaining gain.
#[derive(Clone)]
struct Choice {
    add: i32,
    cover: Vec<(usize, i32)>,
    /// Payments that count against the train's paying limit, until `settled` picks among them.
    offers: Vec<(usize, i32)>,
    /// A freight route's ends, while it can still be chained.
    ends: Option<[End; 2]>,
    /// The connectivity stops the routes visit, and whether they visit the root.
    reach: Bits,
    root: bool,
    /// Each route's own reach, when the routes of a chain do not all meet each other.
    parts: Vec<(Bits, bool)>,
    resources: Bits,
    /// The (profile, source candidate) of each route.
    members: Vec<(usize, usize)>,
}

impl Choice {
    fn weight(&self) -> i32 {
        self.add
            + self.cover.iter().map(|&(_, amount)| amount).sum::<i32>()
            + self.offers.iter().map(|&(_, amount)| amount).sum::<i32>()
    }

    /// The memory the choice takes.
    fn bytes(&self) -> usize {
        let words = self.reach.len() * (1 + self.parts.len()) + self.resources.len();
        std::mem::size_of::<Choice>()
            + 16 * (self.cover.len() + self.offers.len() + self.members.len())
            + 8 * words
            + (5 + self.parts.len()) * ALLOCATION
    }

    /// Whether running `self` in place of `other` can never score less or break a fleet: it pays
    /// at least as much everywhere, reaches every stop `other` connects through, and uses no
    /// track `other` leaves free.
    fn covers(&self, other: &Choice) -> bool {
        self.add >= other.add
            && self.ends == other.ends
            && (self.root || !other.root)
            && self.parts.is_empty()
            && other.parts.is_empty()
            && within(&other.reach, &self.reach)
            && within(&self.resources, &other.resources)
            && other
                .cover
                .iter()
                .all(|&(item, value)| amount(&self.cover, item) >= value)
            && other.offers.iter().all(|&(item, value)| {
                amount(&self.cover, item) >= value || amount(&self.offers, item) >= value
            })
    }
}

/// Drops every choice another one covers.
fn prune(mut choices: Vec<Choice>) -> Vec<Choice> {
    choices.sort_by_cached_key(|choice| {
        let reach: u32 = choice.reach.iter().map(|word| word.count_ones()).sum();
        std::cmp::Reverse((choice.weight(), reach))
    });
    let mut kept: Vec<Choice> = vec![];
    for choice in choices {
        if !kept.iter().any(|other| other.covers(&choice)) {
            kept.push(choice);
        }
    }
    kept
}

/// The ways a route can spend its train's paying limit, each a choice with nothing left to settle.
fn settled(choice: &Choice, limit: Option<usize>, into: &mut Vec<Choice>) {
    let count = choice.offers.len();
    let limit = limit.unwrap_or(count).min(count);
    let mut picked: Vec<usize> = (0..limit).collect();
    loop {
        let mut settled = Choice {
            offers: vec![],
            ..choice.clone()
        };
        for &index in &picked {
            let (item, value) = choice.offers[index];
            raise(&mut settled.cover, item, value);
        }
        into.push(settled);
        // The next combination of `limit` offers, in lexicographic order.
        let Some(position) =
            (0..limit).rfind(|&position| picked[position] < count - limit + position)
        else {
            return;
        };
        picked[position] += 1;
        for later in position + 1..limit {
            picked[later] = picked[later - 1] + 1;
        }
    }
}

/// The trains of one unit, as their profiles in order, and the profile of the optional freight
/// train that joins a chain of required ones.
type Block = (Vec<usize>, Option<usize>);

/// How many ways a route can spend a paying limit of `limit` on its offers.
fn variants(choice: &Choice, limit: Option<usize>) -> usize {
    let count = choice.offers.len();
    let limit = limit.unwrap_or(count).min(count);
    (0..limit).fold(1usize, |ways, picked| {
        ways.saturating_mul(count - picked) / (picked + 1)
    })
}

/// The freight routes that end at each stop, as (route, which end).
fn ends_at(routes: &[Choice], stops: usize) -> Vec<Vec<(usize, usize)>> {
    let mut ending = vec![vec![]; stops];
    for (index, route) in routes.iter().enumerate() {
        for (which, end) in route.ends.unwrap().iter().enumerate() {
            ending[end.stop].push((index, which));
        }
    }
    ending
}

/// The fleet being routed: what each profile of train can run, and the best fleet found so far.
struct Fleet<'a> {
    network: Network<'a>,
    policy: &'a Policy,
    /// The trains of each profile, which share one list of source candidates.
    profiles: Vec<Vec<usize>>,
    /// Each freight profile's distinct routes, kept apart by their ends for chaining.
    runs: Vec<Vec<Choice>>,
    /// The choices of each kind of unit: one train of each profile first, then each chain built.
    classes: Vec<Vec<Choice>>,
    /// The class of each chain built, by its trains' profiles and the optional train anchoring it.
    chains: HashMap<Block, usize>,
    /// The runs of each freight profile that end at each stop, as (run, which end).
    ending: Vec<Vec<Vec<(usize, usize)>>>,
    /// Each freight profile's runs reduced to their ends, one for each pair of ends, and the same
    /// index by stop; a chain of these scores at least what the chains of runs between those ends do.
    sketches: Vec<Vec<Choice>>,
    sketched: Vec<Vec<Vec<(usize, usize)>>>,
    outlines: HashMap<Block, usize>,
    /// The item of each pair of payment groups a chain runs between, made when one first does.
    pairs: RefCell<HashMap<[usize; 2], usize>>,
    /// The connectivity stops, as bits.
    flagged: Bits,
    best: Vec<(usize, usize)>,
    score: Score,
    deadline: f64,
    expansions: u64,
    exhausted: bool,
    limited: bool,
    budget: usize,
}

#[derive(Clone, Copy, Default)]
struct Score {
    revenue: i32,
    subsidy: i32,
}

impl Score {
    fn total(self) -> i32 {
        self.revenue + self.subsidy
    }
}

impl<'a> Fleet<'a> {
    /// The fleet that may run every candidate, or with `only` named, just those (profile, source
    /// candidate) routes.
    fn new(
        network: Network<'a>,
        sources: &[Rc<Candidates>],
        only: &[(usize, usize)],
        deadline: f64,
        budget: usize,
    ) -> Self {
        let problem = network.problem;
        let policy = problem.fleet.as_ref().unwrap();
        let mut profiles: Vec<Vec<usize>> = vec![];
        for train in 0..problem.trains.len() {
            match profiles
                .iter_mut()
                .find(|profile| Rc::ptr_eq(&sources[profile[0]], &sources[train]))
            {
                Some(profile) => profile.push(train),
                None => profiles.push(vec![train]),
            }
        }
        let mut flagged = bits(problem.stops.len());
        if let Some(connectivity) = &policy.connectivity {
            for stop in 0..problem.stops.len() {
                if connectivity.stops[stop] {
                    mark(&mut flagged, stop);
                }
            }
        }
        let mut fleet = Self {
            network,
            policy,
            runs: profiles.iter().map(|_| vec![]).collect(),
            classes: vec![],
            chains: HashMap::new(),
            ending: profiles.iter().map(|_| vec![]).collect(),
            sketches: profiles.iter().map(|_| vec![]).collect(),
            sketched: profiles.iter().map(|_| vec![]).collect(),
            outlines: HashMap::new(),
            pairs: RefCell::new(HashMap::new()),
            flagged,
            best: vec![],
            score: Score::default(),
            deadline,
            expansions: 0,
            exhausted: false,
            limited: false,
            budget,
            profiles,
        };
        let path_hex: HashMap<usize, usize> =
            problem.arcs.iter().map(|arc| (arc.path, arc.hex)).collect();
        for profile in 0..fleet.profiles.len() {
            let source = &sources[fleet.profiles[profile][0]];
            // Every candidate becomes a choice before the covered ones are dropped, so those
            // only borrow the memory the kept ones then take.
            let (routes, cut) = fleet.routes(profile, source, only, &path_hex);
            fleet.limited |= cut;
            let mut routes = prune(routes);
            let policy = fleet.train_policy(profile);
            let ways = |route: &Choice| match policy.freight {
                // A freight route is kept as a link for chains and as a run of its own.
                Some(_) => 2,
                None => variants(route, policy.paying_limit),
            };
            // Short of memory, each profile keeps its best routes within an even share of it.
            let rest = fleet.budget - fleet.budget / (fleet.profiles.len() - profile);
            let fits = (0..routes.len())
                .find(|&route| !fleet.spend(ways(&routes[route]), routes[route].bytes(), rest))
                .unwrap_or(routes.len());
            routes.truncate(fits);
            let singles = if policy.freight.is_some() {
                let singles = (0..routes.len())
                    .filter_map(|run| {
                        let ends = routes[run].ends.unwrap();
                        fleet.chained(&[&routes[run]], [(profile, ends[0]), (profile, ends[1])])
                    })
                    .collect();
                let mut sketches: Vec<Choice> = vec![];
                let mut between: HashMap<[End; 2], usize> = HashMap::new();
                for route in &routes {
                    let sketch = *between.entry(route.ends.unwrap()).or_insert_with(|| {
                        sketches.push(Choice {
                            cover: vec![],
                            reach: bits(0),
                            root: false,
                            resources: bits(0),
                            members: vec![],
                            ..route.clone()
                        });
                        sketches.len() - 1
                    });
                    for &(item, value) in &route.cover {
                        raise(&mut sketches[sketch].cover, item, value);
                    }
                }
                for sketch in &sketches {
                    fleet.spend(1, sketch.bytes(), 0);
                }
                fleet.sketched[profile] = ends_at(&sketches, problem.stops.len());
                fleet.sketches[profile] = sketches;
                fleet.ending[profile] = ends_at(&routes, problem.stops.len());
                fleet.runs[profile] = routes;
                singles
            } else {
                let mut singles = vec![];
                for route in &routes {
                    settled(route, policy.paying_limit, &mut singles);
                }
                singles
            };
            fleet.classes.push(prune(singles));
        }
        fleet
    }

    fn train(&self, profile: usize) -> &'a Train {
        &self.network.problem.trains[self.profiles[profile][0]]
    }

    fn train_policy(&self, profile: usize) -> &'a TrainPolicy {
        self.train(profile).fleet.as_ref().unwrap()
    }

    /// Takes the memory of `count` choices of `bytes` each from the budget, leaving `rest` of it,
    /// or reports the search limited.
    fn spend(&mut self, count: usize, bytes: usize, rest: usize) -> bool {
        let needed = count.saturating_mul(bytes);
        if needed > self.budget - rest {
            self.limited = true;
            return false;
        }
        self.budget -= needed;
        true
    }

    /// What each source candidate of a profile offers the fleet, and whether the memory left ran
    /// out before the last of them.
    fn routes(
        &self,
        profile: usize,
        source: &Candidates,
        only: &[(usize, usize)],
        path_hex: &HashMap<usize, usize>,
    ) -> (Vec<Choice>, bool) {
        let network = self.network;
        let problem = network.problem;
        let policy = self.policy;
        let train = self.train(profile);
        let fleet = self.train_policy(profile);
        let n = problem.stops.len();
        let root = policy
            .connectivity
            .as_ref()
            .and_then(|connectivity| connectivity.root);
        let mut routes = vec![];
        let mut left = self.budget;
        for (source_id, candidate) in source.iter().enumerate() {
            if !only.is_empty() && !only.contains(&(profile, source_id)) {
                continue;
            }
            let connections: Vec<_> = source
                .connection_ids(candidate)
                .map(|id| &network.connections[id])
                .collect();
            let stops: Vec<_> = std::iter::once(connections[0].from)
                .chain(connections.iter().map(|edge| edge.to))
                .collect();
            let hexes: Vec<_> = connections
                .iter()
                .flat_map(|edge| &edge.paths)
                .map(|path| path_hex[path])
                .collect();
            let end = |stop: usize, first: bool| {
                let node = &problem.stops[stop];
                let offboard = policy.offboard_distance && !node.city && !node.town;
                let hex = if offboard {
                    if first {
                        hexes.iter().copied().find(|&hex| hex != node.hex)
                    } else {
                        hexes.iter().rev().copied().find(|&hex| hex != node.hex)
                    }
                    .unwrap_or(node.hex)
                } else {
                    node.hex
                };
                End {
                    stop,
                    hex,
                    offboard,
                }
            };
            let mut ends = [end(stops[0], true), end(*stops.last().unwrap(), false)];
            ends.sort_unstable();
            let mut reach = bits(n);
            for &stop in &stops {
                if bit(&self.flagged, stop) {
                    mark(&mut reach, stop);
                }
            }
            let mut resources = bits(if policy.shared_track {
                0
            } else {
                problem.resource_count
            });
            if !policy.shared_track {
                for resource in source.resources(candidate, network) {
                    mark(&mut resources, resource);
                }
            }
            let mut cover = vec![];
            if fleet.hex_subsidy > 0 {
                for &hex in &hexes {
                    raise(&mut cover, n + hex, fleet.hex_subsidy);
                }
                for &stop in &stops {
                    raise(&mut cover, n + problem.stops[stop].hex, fleet.hex_subsidy);
                }
            }
            let mut offers = vec![];
            let mut add = 0;
            if fleet.freight.is_none() {
                let mut pay = vec![];
                for &stop in &stops {
                    if !fleet.paying[stop] {
                        continue;
                    }
                    let group = policy.payment_groups[stop];
                    if fleet.limited[stop] && fleet.paying_limit.is_some() {
                        raise(&mut offers, group, train.revenues[stop]);
                    } else {
                        raise(&mut pay, group, train.revenues[stop]);
                    }
                }
                offers.retain(|&(item, value)| value > amount(&pay, item));
                if policy.pay_once {
                    for (item, value) in pay {
                        raise(&mut cover, item, value);
                    }
                } else {
                    // Stops pay per train, so the route keeps its best offers itself.
                    let mut extra: Vec<_> = offers
                        .iter()
                        .map(|&(item, value)| value - amount(&pay, item))
                        .collect();
                    extra.sort_unstable_by(|a, b| b.cmp(a));
                    add = pay.iter().map(|&(_, value)| value).sum::<i32>()
                        + extra
                            .iter()
                            .take(fleet.paying_limit.unwrap_or(0))
                            .sum::<i32>();
                    offers.clear();
                }
            }
            let route = Choice {
                add,
                cover,
                offers,
                ends: fleet.freight.map(|_| ends),
                reach,
                root: root.is_some_and(|root| stops.contains(&root)),
                parts: vec![],
                resources,
                members: vec![(profile, source_id)],
            };
            if route.bytes() > left {
                return (routes, true);
            }
            left -= route.bytes();
            routes.push(route);
        }
        (routes, false)
    }

    /// The item that pays for the distance between the payment groups `a` and `z`.
    fn pair(&self, a: usize, z: usize) -> usize {
        let mut pairs = self.pairs.borrow_mut();
        let next = self.network.problem.stops.len() + self.policy.coordinates.len() + pairs.len();
        *pairs.entry([a.min(z), a.max(z)]).or_insert(next)
    }

    /// What a chain between `a` and `z` earns for the distance between them.
    fn bonus(&self, a: End, z: End) -> i32 {
        let policy = self.policy;
        let distance = (policy.coordinates[a.hex].distance(policy.coordinates[z.hex]) - 1
            + i32::from(a.offboard)
            + i32::from(z.offboard))
        .max(0);
        distance
            * policy
                .bonus_per_hex
                .max(policy.end_rates[a.stop])
                .max(policy.end_rates[z.stop])
    }

    /// Running the freight routes `links` as one chain between `ends`, each outer end with the
    /// profile of the train that reaches it; `None` when the routes would share track they may not.
    fn chained(&self, links: &[&Choice], ends: [(usize, End); 2]) -> Option<Choice> {
        let policy = self.policy;
        let bonus = self.bonus(ends[0].1, ends[1].1);
        let mut choice = Choice {
            add: 0,
            cover: vec![],
            offers: vec![],
            ends: None,
            reach: bits(self.network.problem.stops.len()),
            root: false,
            parts: vec![],
            resources: links[0].resources.iter().map(|_| 0).collect(),
            members: vec![],
        };
        let pays = ends.map(|(profile, end)| {
            (
                policy.payment_groups[end.stop],
                self.train(profile).revenues[end.stop].max(0),
            )
        });
        if policy.pay_once {
            for (group, value) in pays {
                raise(&mut choice.cover, group, value);
            }
            // Chains between the same two places pay for the distance once.
            if bonus > 0 {
                raise(&mut choice.cover, self.pair(pays[0].0, pays[1].0), bonus);
            }
        } else if links.len() == 1 && pays[0].0 == pays[1].0 {
            choice.add = bonus + pays[0].1.max(pays[1].1);
        } else {
            choice.add = bonus + pays[0].1 + pays[1].1;
        }
        for link in links {
            if meet(&choice.resources, &link.resources) {
                return None;
            }
            join(&mut choice.resources, &link.resources);
            join(&mut choice.reach, &link.reach);
            choice.root |= link.root;
            choice.add += link.add;
            for &(item, value) in &link.cover {
                raise(&mut choice.cover, item, value);
            }
            choice.members.extend(&link.members);
        }
        // The chain counts as one route for connectivity only when its routes all meet at
        // connectivity stops; a chain can also join at a stop that connects nothing.
        let mut met = vec![0];
        let mut next = 0;
        while next < met.len() {
            let from = met[next];
            next += 1;
            for other in 0..links.len() {
                if !met.contains(&other) && meet(&links[from].reach, &links[other].reach) {
                    met.push(other);
                }
            }
        }
        if met.len() < links.len() {
            choice.parts = links
                .iter()
                .map(|link| (link.reach.clone(), link.root))
                .collect();
        }
        Some(choice)
    }

    /// The class of the unit that runs `block`: the profile's own class for one train, else every
    /// chain its trains can form, built the first time it is asked for.
    fn class(&mut self, block: &Block) -> usize {
        if let [profile] = block.0[..] {
            return profile;
        }
        if let Some(&class) = self.chains.get(block) {
            return class;
        }
        let mut left: Vec<(usize, usize)> = vec![];
        for &profile in &block.0 {
            match left.iter_mut().find(|(other, _)| *other == profile) {
                Some((_, count)) => *count += 1,
                None => left.push((profile, 1)),
            }
        }
        let mut chaining = Chaining {
            left,
            anchor: block.1,
            length: block.0.len(),
            links: vec![],
            order: vec![],
            stops: vec![],
            ends: None,
            steps: 0,
            cut: false,
            late: false,
            room: CHAIN_BATCH,
            budget: self.budget,
            bytes: 0,
            found: vec![],
        };
        self.link(&mut chaining);
        let Chaining {
            cut, late, found, ..
        } = chaining;
        self.limited |= cut && !late;
        self.exhausted |= late;
        let found = prune(found);
        self.budget -= found
            .iter()
            .map(Choice::bytes)
            .sum::<usize>()
            .min(self.budget);
        let class = self.classes.len();
        self.classes.push(found);
        self.chains.insert(block.clone(), class);
        class
    }

    /// Extends the chain by one route in every way its remaining trains allow.
    fn link<'c>(&'c self, chaining: &mut Chaining<'c>) {
        let position = chaining.links.len();
        if position == chaining.length {
            let [first, last] = chaining.ends.unwrap();
            // Each chain turns up from both ends; keep one of the two.
            if first.stop < last.stop {
                let ends = [
                    (chaining.order[0], first),
                    (chaining.order[position - 1], last),
                ];
                if let Some(chain) = self.chained(&chaining.links, ends) {
                    chaining.bytes += chain.bytes();
                    chaining.found.push(chain);
                }
                if chaining.found.len() >= chaining.room || chaining.bytes > chaining.budget {
                    // Most chains are covered by better ones, which frees their memory.
                    chaining.found = prune(std::mem::take(&mut chaining.found));
                    chaining.room = (2 * chaining.found.len()).max(CHAIN_BATCH);
                    chaining.bytes = chaining.found.iter().map(Choice::bytes).sum();
                    chaining.cut |= chaining.bytes > chaining.budget / 2;
                }
            }
            return;
        }
        for slot in 0..chaining.left.len() {
            let (profile, left) = chaining.left[slot];
            // The required trains must chain without the optional one, so it goes at an end.
            let inside = position > 0 && position + 1 < chaining.length;
            if left == 0 || (inside && chaining.anchor == Some(profile)) {
                continue;
            }
            chaining.left[slot].1 -= 1;
            chaining.order.push(profile);
            if position == 0 {
                for run in &self.runs[profile] {
                    let ends = run.ends.unwrap();
                    for first in 0..2 {
                        chaining.ends = Some([ends[first], ends[1 - first]]);
                        chaining.stops = vec![ends[first].stop, ends[1 - first].stop];
                        chaining.links.push(run);
                        self.link(chaining);
                        chaining.links.pop();
                    }
                }
            } else {
                let [first, last] = chaining.ends.unwrap();
                for &(run, which) in &self.ending[profile][last.stop] {
                    let route = &self.runs[profile][run];
                    let next = route.ends.unwrap()[1 - which];
                    chaining.steps += 1;
                    if chaining.steps.is_multiple_of(1024) && milliseconds() >= self.deadline {
                        chaining.late = true;
                        chaining.cut = true;
                    }
                    chaining.cut |= chaining.steps >= CHAIN_STEPS;
                    if chaining.cut {
                        break;
                    }
                    if chaining.stops.contains(&next.stop) {
                        continue;
                    }
                    chaining.stops.push(next.stop);
                    chaining.links.push(route);
                    chaining.ends = Some([first, next]);
                    self.link(chaining);
                    chaining.ends = Some([first, last]);
                    chaining.links.pop();
                    chaining.stops.pop();
                }
            }
            chaining.order.pop();
            chaining.left[slot].1 += 1;
            if chaining.cut {
                return;
            }
        }
    }

    /// A class that scores at least what the chains of `block` do, without building them: for two
    /// trains, one choice for each pair of ends their routes can join between; for more, a single
    /// choice that scores the most any two ends could.
    fn outline(&mut self, block: &Block) -> usize {
        if let [profile] = block.0[..] {
            return profile;
        }
        if let Some(&class) = self.outlines.get(block) {
            return class;
        }
        let mut found: Vec<Choice> = vec![];
        if let [first, second] = block.0[..] {
            let mut seen = HashSet::new();
            for stop in 0..self.network.problem.stops.len() {
                for &(a, near) in &self.sketched[first][stop] {
                    for &(z, far) in &self.sketched[second][stop] {
                        let links = [&self.sketches[first][a], &self.sketches[second][z]];
                        let ends = [
                            (first, links[0].ends.unwrap()[1 - near]),
                            (second, links[1].ends.unwrap()[1 - far]),
                        ];
                        if ends[0].1.stop == ends[1].1.stop {
                            continue;
                        }
                        let choice = self.chained(&links, ends).unwrap();
                        if seen.insert((choice.add, choice.cover.clone())) {
                            found.push(choice);
                        }
                    }
                }
            }
        } else {
            found.push(Choice {
                add: self.chain_bound(block),
                cover: vec![],
                offers: vec![],
                ends: None,
                reach: bits(0),
                root: false,
                parts: vec![],
                resources: bits(0),
                members: vec![],
            });
        }
        let class = self.classes.len();
        self.classes.push(found);
        self.outlines.insert(block.clone(), class);
        class
    }

    /// More than any chain of `block` can score: the best two ends its trains reach, whether or
    /// not routes join them.
    fn chain_bound(&self, block: &Block) -> i32 {
        let mut ends: Vec<(End, i32)> = vec![];
        let mut subsidy = 0;
        for &profile in &block.0 {
            let revenues = &self.train(profile).revenues;
            for run in &self.runs[profile] {
                for end in run.ends.unwrap() {
                    ends.push((end, revenues[end.stop].max(0)));
                }
            }
            subsidy += self.runs[profile]
                .iter()
                .map(|run| run.cover.iter().map(|&(_, amount)| amount).sum::<i32>())
                .max()
                .unwrap_or(0);
        }
        ends.sort_unstable();
        ends.dedup();
        let mut best = 0;
        for (index, &(a, paid)) in ends.iter().enumerate() {
            for &(z, other) in &ends[index + 1..] {
                if a.stop != z.stop {
                    best = best.max(self.bonus(a, z) + paid + other);
                }
            }
        }
        best + subsidy
    }

    /// Every way to split the fleet's trains into units, as the profiles of each unit's trains.
    ///
    /// A train that is not a freight train is always a unit of its own. Freight trains run alone
    /// or in chains: any of the required ones may run, as one chain, and when optional ones run
    /// beside them exactly one joins that chain; the other optional ones group freely.
    fn patterns(&self) -> Vec<Vec<Block>> {
        let mut plain = vec![];
        let mut required = vec![];
        let mut optional = vec![];
        for (profile, trains) in self.profiles.iter().enumerate() {
            let list = match self.train_policy(profile).freight {
                None => &mut plain,
                Some(Freight::Required) => &mut required,
                Some(Freight::Optional) => &mut optional,
            };
            list.extend(trains.iter().map(|_| profile));
        }
        let mut seen = HashSet::new();
        let mut patterns = vec![];
        for subset in 0..1usize << required.len() {
            let main: Vec<usize> = (0..required.len())
                .filter(|index| subset >> index & 1 == 1)
                .map(|index| required[index])
                .collect();
            let anchors = if main.is_empty() { 0 } else { optional.len() };
            for anchor in std::iter::once(None).chain((0..anchors).map(Some)) {
                let mut fixed: Vec<Block> =
                    plain.iter().map(|&profile| (vec![profile], None)).collect();
                let mut rest = vec![];
                match anchor {
                    None if main.is_empty() => rest = optional.clone(),
                    None => fixed.push((main.clone(), None)),
                    Some(anchor) => {
                        let mut block = main.clone();
                        block.push(optional[anchor]);
                        block.sort_unstable();
                        fixed.push((block, Some(optional[anchor])));
                        rest = optional.clone();
                        rest.remove(anchor);
                    }
                }
                partitions(&rest, &mut vec![], &mut |blocks| {
                    let mut pattern = fixed.clone();
                    pattern.extend(blocks.iter().map(|block| (block.clone(), None)));
                    pattern.sort_unstable();
                    if seen.insert(pattern.clone()) {
                        patterns.push(pattern);
                    }
                });
            }
        }
        // Trains running alone are the cheapest to search and usually the best, so they set the
        // score the chains have to beat.
        patterns.sort_by_key(|pattern| std::cmp::Reverse(pattern.len()));
        patterns
    }

    /// Searches the patterns in turn, while there is time.
    fn run(&mut self) {
        for pattern in self.patterns() {
            if self.exhausted {
                break;
            }
            self.search(&pattern);
        }
    }

    /// Searches one pattern for a fleet that beats the best so far.
    fn search(&mut self, pattern: &[Block]) {
        let bound: i32 = pattern
            .iter()
            .map(|block| match block.0[..] {
                [profile] => self.classes[profile]
                    .iter()
                    .map(Choice::weight)
                    .max()
                    .unwrap_or(0),
                _ => self.chain_bound(block),
            })
            .sum();
        if bound <= self.score.total() {
            return;
        }
        // Chains are costly to build, so first see whether outlines of them could do any better.
        if pattern.iter().any(|block| block.0.len() > 1) {
            let mut outlines = vec![];
            for block in pattern {
                let class = self.outline(block);
                if !self.classes[class].is_empty() {
                    outlines.push(class);
                } else if block.0.len() > 1 {
                    return;
                }
            }
            let mut search = Search::new(self, outlines);
            search.relaxed = true;
            search.tune();
            search.walk(0);
            let (beaten, expansions) = (search.beaten, search.expansions);
            self.expansions += expansions;
            if !beaten {
                self.exhausted |= milliseconds() >= self.deadline;
                return;
            }
        }
        let mut units = vec![];
        for block in pattern {
            let class = self.class(block);
            if !self.classes[class].is_empty() {
                units.push(class);
            } else if block.0.len() > 1 {
                // These trains cannot chain, and the patterns that split them up cover the rest.
                return;
            }
        }
        let mut search = Search::new(self, units);
        search.tune();
        search.walk(0);
        let Search {
            found,
            expansions,
            exhausted,
            ..
        } = search;
        self.expansions += expansions;
        self.exhausted |= exhausted;
        if let Some((score, best)) = found {
            self.score = score;
            self.best = best;
        }
    }
}

/// A chain of freight routes being built from one end.
struct Chaining<'c> {
    /// How many trains of each profile are still to join.
    left: Vec<(usize, usize)>,
    anchor: Option<usize>,
    length: usize,
    links: Vec<&'c Choice>,
    /// The profile of each link.
    order: Vec<usize>,
    /// The stops the chain joins at, with both its ends.
    stops: Vec<usize>,
    ends: Option<[End; 2]>,
    steps: usize,
    /// Whether the chains were more than the search will build, and whether for want of time.
    cut: bool,
    late: bool,
    /// How many chains to find before dropping the covered ones.
    room: usize,
    /// The memory the chains may take, and what those found so far do.
    budget: usize,
    bytes: usize,
    found: Vec<Choice>,
}

const TUNING_ROUNDS: usize = 60;
const CHAIN_STEPS: usize = 4_000_000;
const CHAIN_BATCH: usize = 8192;

/// Visits every way to split `rest` into blocks, beside the `blocks` already made.
fn partitions(rest: &[usize], blocks: &mut Vec<Vec<usize>>, visit: &mut impl FnMut(&[Vec<usize>])) {
    let Some((&first, rest)) = rest.split_first() else {
        visit(blocks);
        return;
    };
    blocks.push(vec![first]);
    partitions(rest, blocks, visit);
    blocks.pop();
    for index in 0..blocks.len() {
        blocks[index].push(first);
        partitions(rest, blocks, visit);
        blocks[index].pop();
    }
}

/// The search of one pattern: a choice for each unit, taken in turn.
///
/// What a fleet scores is each choice's `add` plus the best amount any choice pays for each item,
/// so a choice's gain over the choices already taken only falls as more are taken. Each depth
/// keeps, per class, the choices that could still be part of a better fleet with their gains then,
/// best first; deeper levels look only at those.
struct Search<'s> {
    classes: &'s [Vec<Choice>],
    shared: bool,
    connected: bool,
    rooted: bool,
    /// Where the hexes start among the items, and where they end.
    hexes: usize,
    pairs: usize,
    /// Each unit's slot, and each slot's class: units of one class share a slot.
    units: Vec<usize>,
    slots: Vec<usize>,
    /// The last unit of each slot.
    until: Vec<usize>,
    /// What the choices taken pay for each item, and the most any choice could.
    paid: Vec<i32>,
    peak: Vec<i32>,
    /// How much of an item's amount counts toward a choice's gain; `slack` holds the rest of every
    /// item once, so that choices which pay for the same item do not all count it.
    cap: Vec<i32>,
    slack: i32,
    trail: Vec<(usize, i32)>,
    used: Bits,
    value: i32,
    chosen: Vec<Option<usize>>,
    /// By depth and slot, the (gain, choice) pairs still worth taking.
    lists: Vec<Vec<Vec<(i32, u32)>>>,
    tops: Vec<Vec<i32>>,
    /// The choices of each slot already tried by an earlier unit of the slot.
    barred: Vec<Vec<bool>>,
    /// The score to beat.
    total: i32,
    found: Option<(Score, Vec<(usize, usize)>)>,
    deadline: f64,
    expansions: u64,
    exhausted: bool,
    /// Whether the classes are outlines, searched only to learn whether a better fleet could
    /// exist, and whether one could.
    relaxed: bool,
    beaten: bool,
}

impl<'s> Search<'s> {
    fn new(fleet: &'s Fleet<'_>, classes: Vec<usize>) -> Self {
        let policy = fleet.policy;
        let problem = fleet.network.problem;
        let hexes = problem.stops.len();
        let top = |class: usize| {
            fleet.classes[class]
                .iter()
                .map(Choice::weight)
                .max()
                .unwrap_or(0)
        };
        // The units that can score most go first, so the bound on the rest is the smaller one.
        let mut order = classes;
        order.sort_by_cached_key(|&class| (std::cmp::Reverse(top(class)), class));
        let mut slots: Vec<usize> = vec![];
        let mut units = vec![];
        for class in order {
            if slots.last() != Some(&class) {
                slots.push(class);
            }
            units.push(slots.len() - 1);
        }
        let until = (0..slots.len())
            .map(|slot| units.iter().rposition(|&unit| unit == slot).unwrap())
            .collect();
        let pairs = hexes + policy.coordinates.len();
        let items = pairs + fleet.pairs.borrow().len();
        let mut peak = vec![0; items];
        for &class in &slots {
            for choice in &fleet.classes[class] {
                for &(item, amount) in &choice.cover {
                    peak[item] = peak[item].max(amount);
                }
            }
        }
        Self {
            classes: &fleet.classes,
            shared: policy.shared_track,
            connected: policy.connectivity.is_some(),
            rooted: policy
                .connectivity
                .as_ref()
                .is_some_and(|connectivity| connectivity.root.is_some()),
            hexes,
            pairs,
            until,
            paid: vec![0; items],
            peak,
            cap: vec![i32::MAX; items],
            slack: 0,
            trail: vec![],
            used: bits(if policy.shared_track {
                0
            } else {
                problem.resource_count
            }),
            value: 0,
            chosen: vec![None; units.len()],
            lists: vec![vec![vec![]; slots.len()]; units.len()],
            tops: vec![vec![0; slots.len()]; units.len()],
            barred: slots
                .iter()
                .map(|&class| vec![false; fleet.classes[class].len()])
                .collect(),
            total: fleet.score.total(),
            found: None,
            deadline: fleet.deadline,
            expansions: 0,
            exhausted: false,
            relaxed: false,
            beaten: false,
            units,
            slots,
        }
    }

    /// At most what `choice` adds to the choices taken, short of the amounts `slack` holds.
    fn gain(&self, choice: &Choice) -> i32 {
        let mut gain = choice.add;
        for &(item, amount) in &choice.cover {
            let more = amount - self.paid[item];
            if more > 0 {
                gain += more.min(self.cap[item]);
            }
        }
        gain
    }

    /// What is left of an item for `slack` once it pays `paid`.
    fn spare(&self, item: usize, paid: i32) -> i32 {
        (self.peak[item] - paid)
            .saturating_sub(self.cap[item])
            .max(0)
    }

    fn take(&mut self, choice: &Choice) {
        self.value += choice.add;
        for &(item, amount) in &choice.cover {
            let paid = self.paid[item];
            if amount > paid {
                self.trail.push((item, paid));
                self.slack += self.spare(item, amount) - self.spare(item, paid);
                self.value += amount - paid;
                self.paid[item] = amount;
            }
        }
        join(&mut self.used, &choice.resources);
    }

    fn release(&mut self, choice: &Choice, mark: usize, value: i32, slack: i32) {
        for (item, paid) in self.trail.drain(mark..).rev() {
            self.paid[item] = paid;
        }
        for (used, resources) in self.used.iter_mut().zip(&choice.resources) {
            *used &= !resources;
        }
        self.value = value;
        self.slack = slack;
    }

    /// Lists, for `depth`, the choices of each slot that could still be part of a better fleet;
    /// false when none of them can be.
    fn refresh(&mut self, depth: usize) -> bool {
        let classes = self.classes;
        for slot in 0..self.slots.len() {
            if self.until[slot] < depth {
                continue;
            }
            let class = &classes[self.slots[slot]];
            let mut list = std::mem::take(&mut self.lists[depth][slot]);
            list.clear();
            if depth == 0 {
                list.extend(
                    (0..class.len()).map(|option| (self.gain(&class[option]), option as u32)),
                );
            } else {
                list.extend(
                    self.lists[depth - 1][slot]
                        .iter()
                        .map(|&(_, option)| (self.gain(&class[option as usize]), option)),
                );
            }
            self.tops[depth][slot] = list.iter().map(|&(gain, _)| gain).max().unwrap_or(0);
            self.lists[depth][slot] = list;
        }
        let rest: i32 = self.units[depth..]
            .iter()
            .map(|&slot| self.tops[depth][slot])
            .sum();
        let room = self.total - self.value - self.slack;
        if rest <= room {
            return false;
        }
        for slot in 0..self.slots.len() {
            if self.until[slot] >= depth {
                let others = rest - self.tops[depth][slot];
                let list = &mut self.lists[depth][slot];
                list.retain(|&(gain, _)| gain + others > room);
                list.sort_unstable_by(|a, b| b.cmp(a));
            }
        }
        true
    }

    /// Sets how much of each item a choice's gain may count, so that the bound on a whole fleet is
    /// as low as it can be made.
    ///
    /// With every item counted in full by every unit, units that would pay for the same stops all
    /// count them, and the bound is far above any fleet. Capping an item at λ and holding the rest
    /// of it once in `slack` is still a bound for any λ: it is the Lagrangian relaxation of the
    /// cover, and subgradient steps on λ bring it down to near the best fleet.
    fn tune(&mut self) {
        let classes = self.classes;
        // A fleet to aim at: each unit in turn takes what gains most.
        for unit in 0..self.units.len() {
            let slot = self.units[unit];
            let class = &classes[self.slots[slot]];
            let best = (0..class.len())
                .filter(|&option| !meet(&self.used, &class[option].resources))
                .max_by_key(|&option| self.gain(&class[option]));
            if let Some(option) = best {
                self.take(&class[option]);
                self.chosen[unit] = Some(option);
            }
        }
        let aim = self.value;
        self.offer();
        self.paid.fill(0);
        self.used.fill(0);
        self.trail.clear();
        self.chosen.fill(None);
        self.value = 0;
        if self.units.len() < 3 {
            return;
        }
        let aim = f64::from(aim.max(self.total));
        let weights: Vec<i32> = (0..self.slots.len())
            .map(|slot| self.units.iter().filter(|&&unit| unit == slot).count() as i32)
            .collect();
        let mut caps: Vec<f64> = self.peak.iter().map(|&peak| f64::from(peak)).collect();
        let mut best = (i32::MAX, self.cap.clone());
        let mut scale = 1.0;
        let mut stalled = 0;
        for _ in 0..TUNING_ROUNDS {
            for (cap, &tuned) in self.cap.iter_mut().zip(&caps) {
                *cap = tuned as i32;
            }
            // The bound under these caps, and which way each cap would lower it.
            let mut bound: i32 = (0..caps.len()).map(|item| self.spare(item, 0)).sum();
            let mut slope = vec![-1; caps.len()];
            for slot in 0..self.slots.len() {
                let class = &classes[self.slots[slot]];
                let Some(top) = class.iter().max_by_key(|choice| self.gain(choice)) else {
                    continue;
                };
                bound += weights[slot] * self.gain(top);
                for &(item, amount) in &top.cover {
                    if self.cap[item] <= amount {
                        slope[item] += weights[slot];
                    }
                }
            }
            if bound < best.0 {
                best = (bound, self.cap.clone());
                stalled = 0;
            } else {
                stalled += 1;
                if stalled == 4 {
                    scale /= 2.0;
                    stalled = 0;
                }
            }
            // A cap stays between nothing and the whole item.
            for (item, slope) in slope.iter_mut().enumerate() {
                if (*slope < 0 && self.cap[item] >= self.peak[item])
                    || (*slope > 0 && self.cap[item] <= 0)
                {
                    *slope = 0;
                }
            }
            let norm: i32 = slope.iter().map(|slope| slope * slope).sum();
            if norm == 0 || f64::from(bound) <= aim {
                break;
            }
            let step = scale * (f64::from(bound) - aim) / f64::from(norm);
            for (item, cap) in caps.iter_mut().enumerate() {
                *cap =
                    (*cap - step * f64::from(slope[item])).clamp(0.0, f64::from(self.peak[item]));
            }
        }
        self.cap = best.1;
        self.slack = (0..caps.len()).map(|item| self.spare(item, 0)).sum();
    }

    fn walk(&mut self, depth: usize) {
        self.expansions += 1;
        if self.expansions.is_multiple_of(16) && milliseconds() >= self.deadline {
            self.exhausted = true;
        }
        if self.exhausted {
            return;
        }
        let count = self.units.len();
        if depth == count {
            self.offer();
            return;
        }
        // The last unit takes its choices from the list above it: those gains are from before the
        // unit above chose, so they only overstate, and most are never looked at.
        let last = depth + 1 == count;
        let from = if last && depth > 0 {
            depth - 1
        } else if self.refresh(depth) {
            depth
        } else {
            return;
        };
        let classes = self.classes;
        let slot = self.units[depth];
        let class = &classes[self.slots[slot]];
        let after: i32 = self.units[depth + 1..]
            .iter()
            .map(|&slot| self.tops[depth][slot])
            .sum();
        let mut tried = vec![];
        let mut explored = false;
        for index in 0..self.lists[from][slot].len() {
            let (gain, option) = self.lists[from][slot][index];
            if self.value + self.slack + gain + after <= self.total {
                break;
            }
            let option = option as usize;
            let choice = &class[option];
            if self.barred[slot][option] || meet(&self.used, &choice.resources) {
                continue;
            }
            let (mark, value, slack) = (self.trail.len(), self.value, self.slack);
            self.take(choice);
            if !last || self.value > self.total {
                self.chosen[depth] = Some(option);
                self.walk(depth + 1);
                self.chosen[depth] = None;
                explored = true;
            }
            self.release(choice, mark, value, slack);
            // A later unit of the same class taking this choice would only swap the two.
            if self.until[slot] > depth {
                self.barred[slot][option] = true;
                tried.push(option);
            }
            if self.exhausted {
                break;
            }
        }
        // Leaving a train out can only help where trains get in each other's way, or where no
        // choice of this unit is worth taking; a fleet that does not hold together is cut down
        // when it is offered.
        if (!explored || !self.shared)
            && !self.exhausted
            && self.value + self.slack + after > self.total
        {
            self.walk(depth + 1);
        }
        for option in tried {
            self.barred[slot][option] = false;
        }
    }

    /// Scores the choices taken as a fleet, or the parts of them that hold together as one.
    fn offer(&mut self) {
        if self.value <= self.total {
            return;
        }
        if self.relaxed {
            self.beaten = true;
            self.exhausted = true;
            return;
        }
        let classes = self.classes;
        let picked: Vec<&Choice> = (0..self.units.len())
            .filter_map(|unit| Some(&classes[self.slots[self.units[unit]]][self.chosen[unit]?]))
            .collect();
        if !self.connected {
            self.keep(&picked);
            return;
        }
        // Each route is a node, and routes that share a connectivity stop are joined.
        let mut nodes: Vec<(&[u64], bool, usize)> = vec![];
        for (index, choice) in picked.iter().enumerate() {
            if choice.parts.is_empty() {
                nodes.push((&choice.reach, choice.root, index));
            }
            for (reach, root) in &choice.parts {
                nodes.push((reach, *root, index));
            }
        }
        let mut group = vec![usize::MAX; nodes.len()];
        let mut groups = 0;
        for start in 0..nodes.len() {
            if group[start] != usize::MAX {
                continue;
            }
            group[start] = groups;
            let mut pending = vec![start];
            while let Some(node) = pending.pop() {
                for other in 0..nodes.len() {
                    if group[other] == usize::MAX && meet(nodes[node].0, nodes[other].0) {
                        group[other] = groups;
                        pending.push(other);
                    }
                }
            }
            groups += 1;
        }
        for component in 0..groups {
            let inside = |index: usize| {
                nodes
                    .iter()
                    .zip(&group)
                    .filter(|(node, _)| node.2 == index)
                    .all(|(_, &group)| group == component)
            };
            let rooted = nodes
                .iter()
                .zip(&group)
                .any(|(node, &group)| group == component && node.1);
            if self.rooted && !rooted {
                continue;
            }
            // A chain only partly inside is dropped whole: the pattern that splits it keeps the
            // routes that are inside.
            let kept: Vec<&Choice> = (0..picked.len())
                .filter(|&index| inside(index))
                .map(|index| picked[index])
                .collect();
            self.keep(&kept);
        }
    }

    /// Records `kept` as the best fleet if it scores more than the best so far.
    fn keep(&mut self, kept: &[&Choice]) {
        let mut paid = vec![0; self.paid.len()];
        let mut total = 0;
        for choice in kept {
            total += choice.add;
            for &(item, amount) in &choice.cover {
                if amount > paid[item] {
                    total += amount - paid[item];
                    paid[item] = amount;
                }
            }
        }
        if total > self.total {
            let subsidy = paid[self.hexes..self.pairs].iter().sum::<i32>();
            self.total = total;
            self.found = Some((
                Score {
                    revenue: total - subsidy,
                    subsidy,
                },
                kept.iter()
                    .flat_map(|choice| choice.members.iter().copied())
                    .collect(),
            ));
        }
    }
}

pub(super) fn solve(
    network: Network<'_>,
    candidates: &[Rc<Candidates>],
    deadline: f64,
    memory_budget: usize,
) -> (i32, i32, Vec<Route>, bool, bool, u64, Vec<usize>) {
    let mut fleet = Fleet::new(network, candidates, &[], deadline, memory_budget);
    fleet.run();
    // A search cut short scored its routes the way it came to them, and the same routes can be
    // worth more paid at other stops or chained another way. They are few, so a search of those
    // alone runs to its end, and the fleet is then worth what the game will pay for it.
    if (fleet.exhausted || fleet.limited) && !fleet.best.is_empty() {
        let mut settled = Fleet::new(
            network,
            candidates,
            &fleet.best,
            f64::INFINITY,
            memory_budget,
        );
        settled.run();
        fleet.expansions += settled.expansions;
        if settled.score.total() > fleet.score.total() {
            fleet.best = settled.best;
            fleet.score = settled.score;
        }
    }
    let mut assigned = vec![0; fleet.profiles.len()];
    let mut routes = vec![];
    fleet.best.sort_unstable();
    for &(profile, source) in &fleet.best {
        let trains = &fleet.profiles[profile];
        let train = trains[assigned[profile]];
        assigned[profile] += 1;
        routes.push(candidates[trains[0]].route(source, train, network));
    }
    routes.sort_unstable_by_key(|route| route.train);
    let mut counts = vec![0; candidates.len()];
    for (profile, trains) in fleet.profiles.iter().enumerate() {
        for &train in trains {
            counts[train] = fleet.classes[profile].len();
        }
    }
    (
        fleet.score.revenue,
        fleet.score.subsidy,
        routes,
        !fleet.exhausted,
        fleet.limited,
        fleet.expansions,
        counts,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_search_cut_short_settles_the_routes_it_returns() {
        // Two trains run the same route and count one of its stops each. Fourteen trains worth
        // more are searched first, so time runs out before the search comes back to the pair.
        let lone = 14;
        let stops = 2 * (lone + 1);
        let train = |pays: &[(usize, i32)], limit: Option<usize>| {
            let mut revenues = vec![0; stops];
            for &(stop, amount) in pays {
                revenues[stop] = amount;
            }
            serde_json::json!({
                "id": "", "distance": 2, "counts_crossings": false, "requires_city": false,
                "visit_costs": vec![1; stops], "revenues": revenues,
                "first_bonus": vec![0; stops],
                "fleet": {
                    "paying": vec![true; stops], "limited": vec![true; stops],
                    "paying_limit": limit, "hex_subsidy": 0, "freight": null,
                },
            })
        };
        let mut trains = vec![
            train(&[(0, 50), (1, 40)], Some(1)),
            train(&[(0, 50), (1, 10)], Some(1)),
        ];
        trains
            .extend((1..=lone).map(|route| train(&[(2 * route, 100), (2 * route + 1, 100)], None)));
        let problem: Problem = serde_json::from_value(serde_json::json!({
            "version": 7, "junction_count": 0, "group_count": 0, "resource_count": lone + 1,
            "hex_bonuses": vec![0; lone + 1], "budget_ms": 1, "memory_budget_bytes": 1,
            "stops": (0..stops).map(|stop| serde_json::json!({
                "token": true, "blocked": false, "endpoint": true, "allowed": true,
                "city": true, "town": false, "hex": stop / 2, "groups": [],
            })).collect::<Vec<_>>(),
            "arcs": (0..=lone).map(|route| serde_json::json!({
                "from": 2 * route, "to": 2 * route + 1, "next": [], "junctions": [],
                "resources": [route], "path": route, "hex": route, "crossings": 0,
                "terminal": false,
            })).collect::<Vec<_>>(),
            "trains": trains,
            "fleet": {
                "shared_track": true, "pay_once": true,
                "payment_groups": (0..stops).collect::<Vec<_>>(),
                "connectivity": null, "minimum_cities": 0,
                "coordinates": (0..=lone).map(|q| serde_json::json!({"q": q, "r": 0}))
                    .collect::<Vec<_>>(),
                "bonus_per_hex": 0, "end_rates": vec![0; stops], "offboard_distance": false,
            },
        }))
        .unwrap();
        let connections: Vec<_> = (0..=lone)
            .map(|route| Connection {
                from: 2 * route,
                to: 2 * route + 1,
                paths: vec![route],
                resources: vec![route],
                hexes: vec![],
                first_terminal: false,
                last_terminal: false,
                crossings: 0,
            })
            .collect();
        let network = Network {
            problem: &problem,
            connections: &connections,
            adjacency: &[],
            departures: &[],
        };
        let candidates: Vec<_> = (0..lone + 2)
            .map(|train| {
                let mut routes = Candidates::new(network);
                routes.push(CandidateView {
                    revenue: 0,
                    visits: 2,
                    connections: &[train.saturating_sub(1)],
                    resources: &[],
                    reversed: false,
                    extension: &[],
                });
                Rc::new(routes)
            })
            .collect();
        let (revenue, subsidy, routes, proved, ..) = solve(network, &candidates, -1.0, usize::MAX);
        assert!(!proved);
        assert_eq!(routes.len(), lone + 2);
        assert_eq!((revenue, subsidy), (lone as i32 * 200 + 90, 0));
    }
}
