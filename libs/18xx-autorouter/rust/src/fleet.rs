use super::*;
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

#[derive(Clone, Copy, Hash, PartialEq, Eq)]
struct End {
    stop: usize,
    hex: usize,
    offboard: bool,
}

#[derive(Hash, PartialEq, Eq)]
struct Key {
    stops: Vec<usize>,
    hexes: Vec<usize>,
    ends: Option<[End; 2]>,
    resources: Vec<usize>,
}

struct FleetCandidate {
    profile: usize,
    source: usize,
    stops: Vec<usize>,
    hexes: Vec<usize>,
    ends: [End; 2],
    resources: Vec<usize>,
    bonus_bound: i32,
}

struct Profile {
    trains: Vec<usize>,
    candidates: Vec<usize>,
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

struct Completion {
    members: Vec<usize>,
    bonus: i32,
}

struct Selection<'a> {
    network: Network<'a>,
    policy: &'a Policy,
    candidates: Vec<FleetCandidate>,
    profiles: Vec<Profile>,
    remaining: Vec<usize>,
    chosen: Vec<usize>,
    excluded: Vec<bool>,
    used: Vec<bool>,
    reached: Vec<usize>,
    best: Vec<usize>,
    score: Score,
    deadline: f64,
    expansions: u64,
    exhausted: bool,
    limited: bool,
    completions: Option<Vec<Completion>>,
    completion_cache: HashMap<Vec<usize>, Option<i32>>,
    cache_limit: usize,
    cache_bytes: usize,
}

pub(super) fn solve(
    network: Network<'_>,
    candidates: &[Rc<Candidates>],
    deadline: f64,
    memory_budget: usize,
) -> (i32, i32, Vec<Route>, bool, bool, u64, Vec<usize>) {
    let mut selection = Selection::new(network, candidates, deadline, memory_budget);
    selection.prepare_completions(memory_budget / 4);
    selection.seed();
    selection.walk();
    let mut assigned = vec![0; selection.profiles.len()];
    selection.best.sort_unstable();
    let mut routes = vec![];
    for &id in &selection.best {
        let candidate = &selection.candidates[id];
        let profile = &selection.profiles[candidate.profile];
        let train = profile.trains[assigned[candidate.profile]];
        assigned[candidate.profile] += 1;
        routes.push(candidates[profile.trains[0]].route(candidate.source, train, network));
    }
    routes.sort_unstable_by_key(|route| route.train);
    let mut counts = vec![0; candidates.len()];
    for profile in &selection.profiles {
        for &train in &profile.trains {
            counts[train] = profile.candidates.len();
        }
    }
    (
        selection.score.revenue,
        selection.score.subsidy,
        routes,
        !selection.exhausted,
        selection.limited,
        selection.expansions,
        counts,
    )
}

impl<'a> Selection<'a> {
    fn new(network: Network<'a>, sources: &[Rc<Candidates>], deadline: f64, budget: usize) -> Self {
        let problem = network.problem;
        let policy = problem.fleet.as_ref().unwrap();
        let mut profiles: Vec<Profile> = vec![];
        for train in 0..problem.trains.len() {
            if let Some(profile) = profiles
                .iter_mut()
                .find(|profile| Rc::ptr_eq(&sources[profile.trains[0]], &sources[train]))
            {
                profile.trains.push(train);
            } else {
                profiles.push(Profile {
                    trains: vec![train],
                    candidates: vec![],
                });
            }
        }
        let path_hex: HashMap<_, _> = problem.arcs.iter().map(|arc| (arc.path, arc.hex)).collect();
        let max_rate = policy
            .end_rates
            .iter()
            .copied()
            .max()
            .unwrap_or(0)
            .max(policy.bonus_per_hex);
        let mut candidates = vec![];
        let mut bytes = 0;
        let mut limited = false;
        for (profile_id, profile) in profiles.iter_mut().enumerate() {
            let train = &problem.trains[profile.trains[0]];
            let fleet = train.fleet.as_ref().unwrap();
            let source = &sources[profile.trains[0]];
            let mut seen = HashSet::new();
            for (source_id, candidate) in source.iter().enumerate() {
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
                let ends = [end(stops[0], true), end(*stops.last().unwrap(), false)];
                let mut hexes = hexes;
                hexes.extend(stops.iter().map(|&stop| problem.stops[stop].hex));
                hexes.sort_unstable();
                hexes.dedup();
                let mut stops = stops;
                stops.sort_unstable();
                let mut resources = if policy.shared_track {
                    vec![]
                } else {
                    source.resources(candidate, network).collect::<Vec<_>>()
                };
                resources.sort_unstable();
                resources.dedup();
                let key = Key {
                    stops: stops.clone(),
                    hexes: if fleet.hex_subsidy > 0 {
                        hexes.clone()
                    } else {
                        vec![]
                    },
                    ends: fleet.freight.map(|_| ends),
                    resources: resources.clone(),
                };
                if !seen.insert(key) {
                    continue;
                }
                let needed = std::mem::size_of::<FleetCandidate>()
                    + 2 * (stops.len() + hexes.len() + resources.len())
                        * std::mem::size_of::<usize>()
                    + 256;
                if bytes + needed > budget / 2 {
                    limited = true;
                    break;
                }
                bytes += needed;
                let coordinates = &policy.coordinates;
                let bonus_bound = if fleet.freight.is_some() {
                    let actual = ends.map(|end| coordinates[problem.stops[end.stop].hex]);
                    let length = coordinates[ends[0].hex].distance(actual[0])
                        + actual[0].distance(actual[1])
                        + actual[1].distance(coordinates[ends[1].hex])
                        + i32::from(ends[0].offboard)
                        + i32::from(ends[1].offboard);
                    max_rate * length
                } else {
                    0
                };
                profile.candidates.push(candidates.len());
                candidates.push(FleetCandidate {
                    profile: profile_id,
                    source: source_id,
                    stops,
                    hexes,
                    ends,
                    resources,
                    bonus_bound,
                });
            }
        }
        Self {
            network,
            policy,
            remaining: profiles
                .iter()
                .map(|profile| profile.trains.len())
                .collect(),
            excluded: vec![false; candidates.len()],
            used: vec![false; problem.resource_count],
            reached: vec![0; problem.stops.len()],
            candidates,
            profiles,
            chosen: vec![],
            best: vec![],
            score: Score::default(),
            deadline,
            expansions: 0,
            exhausted: false,
            limited,
            completions: None,
            completion_cache: HashMap::new(),
            cache_limit: budget / 4,
            cache_bytes: 0,
        }
    }

    fn train(&self, id: usize) -> &'a Train {
        &self.network.problem.trains[self.profiles[self.candidates[id].profile].trains[0]]
    }

    fn train_policy(&self, id: usize) -> &'a TrainPolicy {
        self.train(id).fleet.as_ref().unwrap()
    }

    fn repeatable(&self, id: usize) -> bool {
        let policy = self.train_policy(id);
        self.policy.shared_track
            && match policy.freight {
                Some(Freight::Required) => false,
                Some(Freight::Optional) => true,
                None => {
                    !self.policy.pay_once
                        || policy.paying_limit.is_some_and(|limit| {
                            self.candidates[id]
                                .stops
                                .iter()
                                .filter(|&&stop| policy.paying[stop] && policy.limited[stop])
                                .count()
                                > limit
                        })
                }
            }
    }

    fn available(&self, id: usize) -> bool {
        let candidate = &self.candidates[id];
        !self.excluded[id]
            && self.remaining[candidate.profile] > 0
            && candidate
                .resources
                .iter()
                .all(|&resource| !self.used[resource])
    }

    fn connected(&self, id: usize) -> bool {
        let Some(connectivity) = &self.policy.connectivity else {
            return true;
        };
        let candidate = &self.candidates[id];
        if self.chosen.is_empty() {
            return connectivity
                .root
                .is_none_or(|root| candidate.stops.contains(&root));
        }
        candidate
            .stops
            .iter()
            .any(|&stop| connectivity.stops[stop] && self.reached[stop] > 0)
    }

    fn push(&mut self, id: usize) {
        let candidate = &self.candidates[id];
        self.remaining[candidate.profile] -= 1;
        for &stop in &candidate.stops {
            self.reached[stop] += 1;
        }
        for &resource in &candidate.resources {
            self.used[resource] = true;
        }
        self.chosen.push(id);
    }

    fn pop(&mut self) {
        let id = self.chosen.pop().unwrap();
        let candidate = &self.candidates[id];
        self.remaining[candidate.profile] += 1;
        for &stop in &candidate.stops {
            self.reached[stop] -= 1;
        }
        for &resource in &candidate.resources {
            self.used[resource] = false;
        }
    }

    fn keep(&mut self) {
        if let Some(score) = self.settle() {
            if score.total() > self.score.total() {
                self.score = score;
                self.best.clone_from(&self.chosen);
            }
        }
    }

    fn seed(&mut self) {
        let mut roots = vec![];
        for id in 0..self.candidates.len() {
            if !self.connected(id) {
                continue;
            }
            self.push(id);
            self.keep();
            roots.push((self.score_relaxed().total(), id));
            self.pop();
        }
        roots.sort_unstable_by_key(|&(score, id)| (std::cmp::Reverse(score), id));
        for &(_, root) in roots.iter().take(16) {
            self.push(root);
            self.keep();
            loop {
                let mut next = None;
                let before = self.settle().map_or(0, Score::total);
                for id in 0..self.candidates.len() {
                    if (self.chosen.contains(&id) && !self.repeatable(id))
                        || !self.available(id)
                        || !self.connected(id)
                    {
                        continue;
                    }
                    self.push(id);
                    if let Some(score) = self.settle() {
                        if score.total() > before
                            && next.is_none_or(|(best, _)| score.total() > best)
                        {
                            next = Some((score.total(), id));
                        }
                    }
                    self.pop();
                }
                let Some((_, id)) = next else {
                    break;
                };
                self.push(id);
                self.keep();
            }
            while !self.chosen.is_empty() {
                self.pop();
            }
            if milliseconds() > self.deadline {
                self.exhausted = true;
                break;
            }
        }
    }

    fn walk(&mut self) {
        self.expansions += 1;
        if self.exhausted || (self.expansions.is_multiple_of(8) && milliseconds() > self.deadline) {
            self.exhausted = true;
            return;
        }
        self.keep();
        if !self.required_can_extend() {
            return;
        }
        let bonus_upper = self.completion_bonus();
        if self.completions.is_some() && bonus_upper.is_none() {
            return;
        }
        let bonus_relaxation = self.completions.is_none();
        let base = self.coverage_bound(bonus_relaxation).total();
        let nonfreight = self.payments(&[]) + self.subsidy();
        let mut ranked = vec![];
        let mut margins: Vec<Vec<i32>> = self.profiles.iter().map(|_| vec![]).collect();
        for id in 0..self.candidates.len() {
            if !self.available(id) {
                continue;
            }
            let connected = self.connected(id);
            let adds_connection = self.policy.connectivity.as_ref().is_some_and(|policy| {
                self.candidates[id]
                    .stops
                    .iter()
                    .any(|&stop| policy.stops[stop] && self.reached[stop] == 0)
            });
            self.push(id);
            let gain = self.coverage_bound(bonus_relaxation).total() - base;
            let redundant = !self.chosen.is_empty()
                && self.chosen.len() > 1
                && self.train_policy(id).freight.is_none()
                && !adds_connection
                && gain == 0
                && self.payments(&[]) + self.subsidy() == nonfreight;
            self.pop();
            if redundant {
                continue;
            }
            let profile = self.candidates[id].profile;
            margins[profile].push(gain);
            if self.repeatable(id) {
                for _ in 1..self.remaining[profile] {
                    margins[profile].push(gain);
                }
            }
            if connected {
                ranked.push((gain + self.candidates[id].bonus_bound, id));
            }
        }
        let mut upper = base + bonus_upper.unwrap_or(0);
        for (profile, gains) in margins.iter_mut().enumerate() {
            gains.sort_unstable_by(|a, b| b.cmp(a));
            upper += gains.iter().take(self.remaining[profile]).sum::<i32>();
        }
        if upper <= self.score.total() {
            return;
        }
        ranked.sort_unstable_by_key(|&(gain, id)| (std::cmp::Reverse(gain), id));
        let mut excluded = vec![];
        for (_, id) in ranked {
            if !self.available(id) {
                continue;
            }
            let copies = if self.repeatable(id) {
                self.remaining[self.candidates[id].profile]
            } else {
                1
            };
            self.excluded[id] = true;
            excluded.push(id);
            for _ in 0..copies {
                self.push(id);
                self.walk();
                if self.exhausted {
                    break;
                }
            }
            while self.chosen.last() == Some(&id) {
                self.pop();
            }
            if self.exhausted {
                break;
            }
        }
        for id in excluded {
            self.excluded[id] = false;
        }
    }

    fn required_can_extend(&self) -> bool {
        let required: Vec<_> = self
            .chosen
            .iter()
            .copied()
            .filter(|&id| self.train_policy(id).freight == Some(Freight::Required))
            .collect();
        let mut degree = vec![0; self.network.problem.stops.len()];
        let mut parent: Vec<_> = (0..degree.len()).collect();
        for id in required {
            let [a, b] = self.candidates[id].ends.map(|end| end.stop);
            degree[a] += 1;
            degree[b] += 1;
            if degree[a] > 2 || degree[b] > 2 {
                return false;
            }
            let root = |mut node: usize, parent: &[usize]| {
                while parent[node] != node {
                    node = parent[node];
                }
                node
            };
            let left = root(a, &parent);
            let right = root(b, &parent);
            if left == right {
                return false;
            }
            parent[left] = right;
        }
        true
    }

    fn subsidy(&self) -> i32 {
        let mut amounts = vec![0; self.policy.coordinates.len()];
        for &id in &self.chosen {
            let amount = self.train_policy(id).hex_subsidy;
            for &hex in &self.candidates[id].hexes {
                amounts[hex] = amounts[hex].max(amount);
            }
        }
        amounts.into_iter().sum()
    }

    fn score_relaxed(&self) -> Score {
        self.coverage_bound(true)
    }

    fn coverage_bound(&self, include_bonus: bool) -> Score {
        let ends: Vec<_> = self
            .chosen
            .iter()
            .enumerate()
            .filter(|(_, id)| self.train_policy(**id).freight.is_some())
            .flat_map(|(position, &id)| self.candidates[id].ends.map(|end| (position, end)))
            .collect();
        Score {
            revenue: self.payments(&ends)
                + if include_bonus {
                    self.chosen
                        .iter()
                        .map(|&id| self.candidates[id].bonus_bound)
                        .sum::<i32>()
                } else {
                    0
                },
            subsidy: self.subsidy(),
        }
    }

    fn payments(&self, ends: &[(usize, End)]) -> i32 {
        let n = self.network.problem.stops.len();
        let groups = if self.policy.pay_once {
            n
        } else {
            n * self.chosen.len()
        };
        let group = |position: usize, stop: usize| {
            self.policy.payment_groups[stop]
                + if self.policy.pay_once {
                    0
                } else {
                    position * n
                }
        };
        let mut base = vec![0; groups];
        let mut limited = vec![];
        let mut capacities = vec![];
        for (position, &id) in self.chosen.iter().enumerate() {
            let train = self.train(id);
            let policy = self.train_policy(id);
            if policy.freight.is_some() {
                continue;
            }
            let mut offers = vec![0; groups];
            for &stop in &self.candidates[id].stops {
                if !policy.paying[stop] {
                    continue;
                }
                let g = group(position, stop);
                if policy.limited[stop] && policy.paying_limit.is_some() {
                    offers[g] = offers[g].max(train.revenues[stop]);
                } else {
                    base[g] = base[g].max(train.revenues[stop]);
                }
            }
            if offers.iter().any(|&value| value > 0) {
                limited.push(offers);
                capacities.push(policy.paying_limit.unwrap());
            }
        }
        for &(position, end) in ends {
            let g = group(position, end.stop);
            base[g] = base[g].max(self.train(self.chosen[position]).revenues[end.stop]);
        }
        for offers in &mut limited {
            for (offer, &base) in offers.iter_mut().zip(&base) {
                *offer = (*offer - base).max(0);
            }
        }
        base.iter().sum::<i32>() + assignment_value(&limited, &capacities, groups)
    }

    fn chain(&self, positions: &[usize]) -> Option<[(usize, End); 2]> {
        let mut incident: HashMap<usize, Vec<usize>> = HashMap::new();
        for &position in positions {
            for end in self.candidates[self.chosen[position]].ends {
                incident.entry(end.stop).or_default().push(position);
            }
        }
        if incident.values().any(|entries| entries.len() > 2) {
            return None;
        }
        let outer: Vec<_> = positions
            .iter()
            .flat_map(|&position| {
                self.candidates[self.chosen[position]]
                    .ends
                    .map(|end| (position, end))
            })
            .filter(|(_, end)| incident[&end.stop].len() == 1)
            .collect();
        if outer.len() != 2 {
            return None;
        }
        let mut seen = HashSet::new();
        let mut pending = vec![outer[0].0];
        while let Some(position) = pending.pop() {
            if !seen.insert(position) {
                continue;
            }
            for end in self.candidates[self.chosen[position]].ends {
                pending.extend(&incident[&end.stop]);
            }
        }
        (seen.len() == positions.len()).then_some([outer[0], outer[1]])
    }

    fn chain_bonus(&self, ends: [(usize, End); 2]) -> i32 {
        let [(_, a), (_, b)] = ends;
        let distance = (self.policy.coordinates[a.hex].distance(self.policy.coordinates[b.hex])
            - 1
            + i32::from(a.offboard)
            + i32::from(b.offboard))
        .max(0);
        distance
            * self
                .policy
                .bonus_per_hex
                .max(self.policy.end_rates[a.stop])
                .max(self.policy.end_rates[b.stop])
    }

    fn settle(&self) -> Option<Score> {
        let mut best = None;
        self.groupings(&mut |ends, bonus| {
            let revenue = self.payments(ends) + bonus;
            best = Some(best.unwrap_or(0).max(revenue));
        });
        best.map(|revenue| Score {
            revenue,
            subsidy: self.subsidy(),
        })
    }

    fn groupings(&self, visit: &mut impl FnMut(&[(usize, End)], i32)) {
        let required: Vec<_> = self
            .chosen
            .iter()
            .enumerate()
            .filter(|(_, id)| self.train_policy(**id).freight == Some(Freight::Required))
            .map(|(p, _)| p)
            .collect();
        let optional: Vec<_> = self
            .chosen
            .iter()
            .enumerate()
            .filter(|(_, id)| self.train_policy(**id).freight == Some(Freight::Optional))
            .map(|(p, _)| p)
            .collect();
        if !required.is_empty() && self.chain(&required).is_none() {
            return;
        }
        let anchors: Vec<_> = if !required.is_empty() && !optional.is_empty() {
            optional.iter().copied().map(Some).collect()
        } else {
            vec![None]
        };
        for anchor in anchors {
            let mut ends = vec![];
            let mut bonus = 0;
            if !required.is_empty() {
                let mut main = required.clone();
                main.extend(anchor);
                let Some(pair) = self.chain(&main) else {
                    continue;
                };
                bonus = self.chain_bonus(pair);
                ends.extend(pair);
            }
            let remaining: Vec<_> = optional
                .iter()
                .copied()
                .filter(|&p| Some(p) != anchor)
                .collect();
            self.group_optional(&remaining, &mut vec![], &ends, bonus, visit);
        }
    }

    fn group_optional(
        &self,
        remaining: &[usize],
        blocks: &mut Vec<Vec<usize>>,
        ends: &[(usize, End)],
        bonus: i32,
        visit: &mut impl FnMut(&[(usize, End)], i32),
    ) {
        if let Some((&first, rest)) = remaining.split_first() {
            blocks.push(vec![first]);
            self.group_optional(rest, blocks, ends, bonus, visit);
            blocks.pop();
            for index in 0..blocks.len() {
                blocks[index].push(first);
                self.group_optional(rest, blocks, ends, bonus, visit);
                blocks[index].pop();
            }
        } else {
            let mut all_ends = ends.to_vec();
            let mut bonus = bonus;
            for block in blocks {
                let Some(pair) = self.chain(block) else {
                    return;
                };
                bonus += self.chain_bonus(pair);
                all_ends.extend(pair);
            }
            visit(&all_ends, bonus);
        }
    }

    fn prepare_completions(&mut self, budget: usize) {
        let mut count = 1usize;
        let mut trains = 0;
        let mut ids = vec![];
        for profile in &self.profiles {
            if self.network.problem.trains[profile.trains[0]]
                .fleet
                .as_ref()
                .unwrap()
                .freight
                .is_none()
            {
                continue;
            }
            trains += profile.trains.len();
            ids.extend(&profile.candidates);
            let mut choices = 1usize;
            for slot in 1..=profile.trains.len() {
                choices = choices.saturating_mul(profile.candidates.len() + slot) / slot;
            }
            count = count.saturating_mul(choices);
        }
        if count.saturating_mul(
            std::mem::size_of::<Completion>() + trains * std::mem::size_of::<usize>() + ALLOCATION,
        ) > budget
        {
            return;
        }
        let deadline = milliseconds() + (self.deadline - milliseconds()).max(0.0) * 0.2;
        let mut completions = vec![];
        let mut visits = 0;
        if self.enumerate_completions(&ids, 0, deadline, &mut visits, &mut completions) {
            self.completions = Some(completions);
        }
    }

    fn enumerate_completions(
        &mut self,
        ids: &[usize],
        start: usize,
        deadline: f64,
        visits: &mut usize,
        completions: &mut Vec<Completion>,
    ) -> bool {
        *visits += 1;
        if visits.is_multiple_of(64) && milliseconds() > deadline {
            return false;
        }
        if !self.required_can_extend() {
            return true;
        }
        let mut bonus = None;
        self.groupings(&mut |_, amount| bonus = Some(bonus.unwrap_or(0).max(amount)));
        if let Some(bonus) = bonus {
            completions.push(Completion {
                members: self.chosen.clone(),
                bonus,
            });
        }
        for (index, &id) in ids.iter().enumerate().skip(start) {
            if !self.available(id) {
                continue;
            }
            let next = if self.policy.shared_track
                && self.train_policy(id).freight == Some(Freight::Optional)
            {
                index
            } else {
                index + 1
            };
            self.push(id);
            let complete = self.enumerate_completions(ids, next, deadline, visits, completions);
            self.pop();
            if !complete {
                return false;
            }
        }
        true
    }

    fn completion_bonus(&mut self) -> Option<i32> {
        let completions = self.completions.as_ref()?;
        let mut required: Vec<_> = self
            .chosen
            .iter()
            .copied()
            .filter(|&id| self.train_policy(id).freight.is_some())
            .collect();
        required.sort_unstable();
        let mut key = required.clone();
        key.push(UNREACHED);
        key.extend(
            (0..self.candidates.len())
                .filter(|&id| self.excluded[id] && self.train_policy(id).freight.is_some()),
        );
        if let Some(value) = self.completion_cache.get(&key) {
            return *value;
        }
        let mut best = None;
        for completion in completions {
            let mut position = 0;
            let mut allowed = true;
            for &id in &completion.members {
                if required.get(position) == Some(&id) {
                    position += 1;
                } else if self.excluded[id]
                    || required
                        .get(position)
                        .is_some_and(|&required| required < id)
                {
                    allowed = false;
                    break;
                }
            }
            if allowed && position == required.len() {
                best = Some(best.unwrap_or(0).max(completion.bonus));
            }
        }
        let bytes = 2 * (key.capacity() * std::mem::size_of::<usize>() + 128);
        if self.cache_bytes + bytes > self.cache_limit {
            self.completion_cache = HashMap::new();
            self.cache_bytes = 0;
        }
        if bytes <= self.cache_limit {
            self.cache_bytes += bytes;
            self.completion_cache.insert(key, best);
        }
        best
    }
}

fn assignment_value(offers: &[Vec<i32>], capacities: &[usize], groups: usize) -> i32 {
    let routes = offers.len();
    let mut owner = vec![None; groups];
    let mut used = vec![0; routes];
    let mut total = 0;
    loop {
        let mut distance = vec![i32::MIN / 2; routes + groups];
        let mut parent = vec![UNREACHED; groups];
        let mut route_parent = vec![None; routes];
        for route in 0..routes {
            if used[route] < capacities[route] {
                distance[route] = 0;
            }
        }
        for _ in 0..=routes {
            let mut changed = false;
            for route in 0..routes {
                if distance[route] == i32::MIN / 2 {
                    continue;
                }
                for group in 0..groups {
                    if owner[group] == Some(route) {
                        continue;
                    }
                    let gain = distance[route] + offers[route][group];
                    if gain <= distance[routes + group] {
                        continue;
                    }
                    distance[routes + group] = gain;
                    parent[group] = route;
                    if let Some(previous) = owner[group] {
                        let remaining = gain - offers[previous][group];
                        if remaining > distance[previous] {
                            distance[previous] = remaining;
                            route_parent[previous] = Some(group);
                            changed = true;
                        }
                    }
                }
            }
            if !changed {
                break;
            }
        }
        let Some(group) = (0..groups)
            .filter(|&group| owner[group].is_none())
            .max_by_key(|&group| distance[routes + group])
        else {
            break;
        };
        let gain = distance[routes + group];
        if gain <= 0 {
            break;
        }
        total += gain;
        let mut at = group;
        loop {
            let route = parent[at];
            let previous = route_parent[route];
            owner[at] = Some(route);
            if let Some(previous) = previous {
                owner[previous] = None;
                at = previous;
            } else {
                used[route] += 1;
                break;
            }
        }
    }
    total
}
