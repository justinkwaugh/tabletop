//! Generated networks hold the searches that prune to a listing of every route: a train's one
//! best route, found with a bound on what the rest of a route can earn and without connections
//! that differ from one already walked only in track nothing needed, and two trains' best pair,
//! found from each one's best route and by keeping them apart.

use super::*;
use serde_json::{Value, json};

struct Random(u64);

impl Random {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }

    fn below(&mut self, limit: usize) -> usize {
        (self.next() % limit as u64) as usize
    }

    fn one_in(&mut self, chances: usize) -> bool {
        self.below(chances) == 0
    }

    fn pick<T: Copy>(&mut self, items: &[T]) -> T {
        items[self.below(items.len())]
    }
}

const EXITS: usize = 3;
const MIDDLES: usize = 6;

/// A network of stops with a few ways out each, joined by links that leave one stop by one of its
/// ways out, run over up to two shared pieces of plain track, each in a hex of its own, and
/// enter the other stop by one of its ways in. Links between the same stops differ in track and
/// in the hexes they run through.
fn network(random: &mut Random, stops: usize, links: usize) -> Value {
    let hexes = stops + MIDDLES;
    let exit = |stop: usize, way: usize| stop * EXITS + way;
    let middle = |piece: usize| stops * EXITS + piece;
    let mut arcs: Vec<Value> = vec![];
    for _ in 0..links {
        let from = random.below(stops);
        let to = (from + 1 + random.below(stops - 1)) % stops;
        let mut pieces = vec![(exit(from, random.below(EXITS)), from)];
        for _ in 0..random.below(3) {
            let piece = random.below(MIDDLES);
            pieces.push((middle(piece), stops + piece));
        }
        pieces.push((exit(to, random.below(EXITS)), to));
        let first = arcs.len();
        let last = first + 2 * (pieces.len() - 1);
        let terminus = random.one_in(12);
        let crossings = random.below(2);
        for (index, &(resource, hex)) in pieces.iter().enumerate() {
            let forward = first + 2 * index;
            let arc = |from: Value, to: Value, next: Vec<usize>, terminal: bool, departs: bool| {
                json!({
                    "from": from, "to": to, "next": next, "resources": [resource],
                    "junctions": [], "path": forward / 2, "hex": hex, "crossings": crossings,
                    "terminal": terminal, "departs_terminal": departs,
                })
            };
            let begins = (index == 0).then_some(from);
            let ends = (forward == last).then_some(to);
            arcs.push(arc(
                json!(begins),
                json!(ends),
                if forward == last {
                    vec![]
                } else {
                    vec![forward + 2]
                },
                terminus && forward == last,
                false,
            ));
            arcs.push(arc(
                json!(ends),
                json!(begins),
                if index == 0 {
                    vec![]
                } else {
                    vec![forward - 1]
                },
                false,
                terminus && forward == last,
            ));
        }
    }
    let bonuses: Vec<i64> = (0..hexes)
        .map(|_| random.pick(&[0, 0, 0, 10, 20, 20, -10]))
        .collect();
    json!({
        "version": 12, "junction_count": 1, "budget_ms": 30000, "memory_budget_bytes": 48_000_000,
        "resource_count": stops * EXITS + MIDDLES, "group_count": 2,
        "no_reentry_hexes": (0..hexes)
            .map(|hex| if random.one_in(4) { random.one_in(2) } else { bonuses[hex] > 0 })
            .collect::<Vec<_>>(),
        "hex_bonuses": bonuses,
        "minimum_cities_and_towns": if random.one_in(6) { 2 } else { 0 },
        "longest_route_bonus_per_stop": if random.one_in(8) { 10 } else { 0 },
        "stops": (0..stops).map(|id| json!({
            "token": id == 0 || random.one_in(5), "blocked": random.one_in(4),
            "endpoint": !random.one_in(6), "allowed": !random.one_in(12),
            "city": !random.one_in(4), "town": false, "hex": id,
            "groups": if random.one_in(5) { vec![random.below(2)] } else { vec![] },
        })).collect::<Vec<_>>(),
        "arcs": arcs,
        "trains": [],
    })
}

fn train(random: &mut Random, id: &str, stops: usize) -> Value {
    let amounts = |random: &mut Random| -> Vec<Option<i64>> {
        (0..stops)
            .map(|_| random.one_in(3).then(|| 10 * random.below(4) as i64))
            .collect()
    };
    let distance = 2 + random.below(5);
    let counts_crossings = random.one_in(8);
    let limit = random.one_in(3).then(|| 1 + random.below(distance));
    let mut train = json!({
        "id": id, "distance": distance + if counts_crossings { 2 } else { 0 },
        "crossing_costs": if counts_crossings { [1, 1, 1] } else { [0, 0, 0] },
        "requires_city": random.one_in(6),
        "visit_costs": (0..stops)
            .map(|_| if random.one_in(5) { 0 } else { 1 })
            .collect::<Vec<_>>(),
        "revenues": (0..stops).map(|_| 10 * random.below(10)).collect::<Vec<_>>(),
        "first_bonus": (0..stops)
            .map(|_| if random.one_in(10) { 10 } else { 0 })
            .collect::<Vec<_>>(),
        "paying_stop_limit": limit,
        "require_paying_token": limit.is_some() && random.one_in(3),
        "blocked_passes": random.below(2),
        "bonuses_along_route": random.one_in(6),
    });
    if limit.is_some() && random.one_in(2) {
        train["uncounted"] = json!((0..stops).map(|_| random.one_in(4)).collect::<Vec<_>>());
    }
    if random.one_in(3) {
        train["connection_bonuses"] = (0..1 + random.below(2))
            .map(|_| {
                let mut bonus = json!({
                    "from": amounts(random), "to": amounts(random), "ends_only": random.one_in(4),
                });
                if random.one_in(2) {
                    let needed = random.below(stops);
                    bonus["requires"] =
                        json!([(0..stops).map(|id| id == needed).collect::<Vec<_>>()]);
                }
                bonus
            })
            .collect();
    }
    if random.one_in(5) {
        train["major_limit"] = json!(1 + random.below(distance));
    }
    if random.one_in(8) {
        train["allowed_stops"] = json!((0..stops).map(|_| !random.one_in(6)).collect::<Vec<_>>());
    }
    if random.one_in(10) {
        train["optional"] = json!((0..stops).map(|_| random.one_in(3)).collect::<Vec<_>>());
        // The game chooses the stops such a train calls at by what they pay alone.
        train["connection_bonuses"] = json!([]);
        train["paying_stop_limit"] = Value::Null;
        train["require_paying_token"] = json!(false);
    }
    train
}

/// PRUNING_CASES=n runs n generated cases of each kind in place of the few of the default suite,
/// PRUNING_SEED=n a different series of them, and PRUNING_STOPS=n networks of up to n stops.
fn setting(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn generated(random: &mut Random, trains: usize) -> Value {
    let stops = 4 + random.below(setting("PRUNING_STOPS", 7) - 3);
    let links = stops + 2 + random.below(2 * stops);
    let mut problem = network(random, stops, links);
    for stop in problem["stops"].as_array_mut().unwrap() {
        stop["town"] = json!(stop["city"] == false && random.one_in(2));
    }
    problem["trains"] = (0..trains)
        .map(|id| train(random, &id.to_string(), stops))
        .collect();
    problem
}

/// A route as the unpruned search lists it: what it is worth, its stops, its track, and the
/// groups of its stops.
struct Listed {
    revenue: i32,
    visits: usize,
    track: Vec<u64>,
    groups: Vec<usize>,
}

/// Every route of the train, none dropped for what it is worth: listed in one go, or with a
/// number of steps given, in slices of so many, each taken up where the last stopped.
fn listed_in(problem: &Problem, train: usize, slice: Option<u64>) -> Vec<Listed> {
    let compiled = Compiled::new(problem, f64::INFINITY);
    let network = compiled.network(problem);
    let train = &problem.trains[train];
    let profile = Rc::new(network.profile(train));
    let whole = Limit::until(f64::INFINITY);
    let mut carried = None;
    let candidates = loop {
        let search = network.search(
            train,
            SearchPlan {
                profile: Rc::clone(&profile),
                closed: None,
                limit: slice.map_or(whole, |steps| whole.steps_on(network.taken.get(), steps)),
                memory_budget: usize::MAX,
                selection_bytes_per_candidate: 0,
                best_only: false,
                floor: None,
                streaming: None,
                listed: carried.take(),
                when_full: WhenFull::Halve,
            },
        );
        assert!(!search.limited);
        if !search.exhausted {
            break search.candidates;
        }
        carried = Some((search.candidates, search.cut));
    };
    candidates
        .iter()
        .map(|candidate| {
            let mut track = vec![0; problem.resource_count.div_ceil(64)];
            candidates.resource_bits(candidate, network, &mut track);
            let links = || candidates.connection_ids(candidate);
            let first = links().next().map(|id| compiled.connections[id].from);
            Listed {
                revenue: candidate.revenue,
                visits: candidate.visits,
                track,
                groups: first
                    .into_iter()
                    .chain(links().map(|id| compiled.connections[id].to))
                    .flat_map(|stop| problem.stops[stop].groups.iter().copied())
                    .collect(),
            }
        })
        .collect()
}

fn listed(problem: &Problem, train: usize) -> Vec<Listed> {
    listed_in(problem, train, None)
}

/// The most the trains earn on routes clear of each other, any of them idle, with no more of
/// them stopping in a group than its limit, by trying every choice of listed routes. The problem
/// is one whose limited groups have no pieces, so that the routes' track is only track.
fn most(problem: &Problem) -> i32 {
    assert!(problem.quotas.is_empty());
    let lists: Vec<Vec<Listed>> = (0..problem.trains.len())
        .map(|train| listed(problem, train))
        .collect();
    struct Limits<'a> {
        most: &'a [GroupRouteLimit],
        stopping: Vec<usize>,
        bonus: i32,
    }
    fn choose(lists: &[Vec<Listed>], used: &[u64], longest: usize, limits: &mut Limits) -> i32 {
        let Some((routes, others)) = lists.split_first() else {
            return longest as i32 * limits.bonus;
        };
        let mut best = choose(others, used, longest, limits);
        for route in routes {
            let stops_in: Vec<bool> = limits
                .most
                .iter()
                .map(|limit| route.groups.contains(&limit.group))
                .collect();
            let full = (0..stops_in.len())
                .any(|at| stops_in[at] && limits.stopping[at] == limits.most[at].routes);
            if full || !route.track.iter().zip(used).all(|(a, b)| a & b == 0) {
                continue;
            }
            for (stopping, &stops_in) in limits.stopping.iter_mut().zip(&stops_in) {
                *stopping += usize::from(stops_in);
            }
            let used: Vec<u64> = route.track.iter().zip(used).map(|(a, b)| a | b).collect();
            best =
                best.max(route.revenue + choose(others, &used, longest.max(route.visits), limits));
            for (stopping, &stops_in) in limits.stopping.iter_mut().zip(&stops_in) {
                *stopping -= usize::from(stops_in);
            }
        }
        best
    }
    choose(
        &lists,
        &vec![0; problem.resource_count.div_ceil(64)],
        0,
        &mut Limits {
            most: &problem.group_route_limits,
            stopping: vec![0; problem.group_route_limits.len()],
            bonus: problem.longest_route_bonus_per_stop,
        },
    )
}

fn solved(problem: &Problem) -> i32 {
    validate(problem).unwrap();
    let solution = routed(problem);
    assert!(solution.exhaustive);
    solution.revenue
}

/// What two trains earn by their outline, as a pair that listing its routes outright did not
/// settle, and what they earn where every stage stops after a few steps and is taken up again.
fn outlined(problem: &Problem, slices: pair::Slices) -> i32 {
    let started = milliseconds();
    let compiled = Compiled::new(problem, f64::INFINITY);
    let clock = Clock {
        started,
        compile_ms: 0.0,
        budget_ms: problem.budget_ms,
        pace_ms: problem.budget_ms,
    };
    let operation = pair::sliced(problem, &compiled, clock, slices);
    assert!(operation.exhaustive);
    operation.revenue
}

/// The operation of two trains whose lists have so little memory, in short slices.
fn cramped(generated: &Value, bytes: usize) -> Solution {
    let mut cramped = generated.clone();
    cramped["memory_budget_bytes"] = json!(bytes);
    let problem = with_quotas(&cramped);
    let compiled = Compiled::new(&problem, f64::INFINITY);
    let clock = Clock {
        started: milliseconds(),
        compile_ms: 0.0,
        budget_ms: problem.budget_ms,
        pace_ms: problem.budget_ms,
    };
    pair::sliced(&problem, &compiled, clock, SHORT)
}

const WHOLE: pair::Slices = pair::Slices {
    first: None,
    slice: 200_000,
};
const SHORT: pair::Slices = pair::Slices {
    first: Some(7),
    slice: 5,
};

#[test]
fn one_train_earns_what_listing_every_route_finds() {
    let mut random = Random(7 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 1500);
    let mut earning = 0;
    for case in 0..cases {
        let generated = generated(&mut random, 1);
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let found = solved(&problem);
        assert_eq!(found, most(&problem), "case {case}: {generated}");
        earning += usize::from(found > 0);
    }
    assert!(2 * earning > cases, "{earning} of the cases earn anything");
}

#[test]
fn a_listing_taken_up_in_slices_lists_what_one_run_lists() {
    let mut random = Random(17 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 300);
    let mut listed_any = 0;
    for case in 0..cases {
        let generated = generated(&mut random, 1);
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let routes = |slice| {
            let mut routes: Vec<_> = listed_in(&problem, 0, slice)
                .into_iter()
                .map(|route| (route.revenue, route.visits, route.track))
                .collect();
            routes.sort_unstable();
            routes
        };
        let whole = routes(None);
        for slice in [1, 3, 8] {
            assert_eq!(
                routes(Some(slice)),
                whole,
                "in slices of {slice}, case {case}: {generated}"
            );
        }
        listed_any += usize::from(!whole.is_empty());
    }
    assert!(
        2 * listed_any > cases,
        "{listed_any} of the cases list a route"
    );
}

#[test]
fn two_trains_earn_what_listing_every_route_finds() {
    let mut random = Random(11 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 500);
    let mut apart = 0;
    let mut cut = 0;
    for case in 0..cases {
        let mut generated = generated(&mut random, 2);
        if case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let found = solved(&problem);
        assert_eq!(found, most(&problem), "case {case}: {generated}");
        assert_eq!(
            outlined(&problem, WHOLE),
            found,
            "outlined, case {case}: {generated}"
        );
        assert_eq!(
            outlined(&problem, SHORT),
            found,
            "in short slices, case {case}: {generated}"
        );
        // Lists that memory cuts short prove nothing they should not, and earn no more than
        // there is.
        for bytes in [6_000, 12_000] {
            let cramped = cramped(&generated, bytes);
            assert!(
                cramped.revenue <= found && (!cramped.exhaustive || cramped.revenue == found),
                "with {bytes} bytes, case {case}: {generated}"
            );
            cut += usize::from(cramped.memory_limited);
        }
        // The longest route's bonus is no sum of two routes' worth, so the trains are not kept
        // apart: their routes are listed above what the outline leaves worth listing.
        let mut longest = generated.clone();
        longest["longest_route_bonus_per_stop"] = json!(10);
        let longest: Problem = serde_json::from_value(longest).unwrap();
        assert_eq!(
            outlined(&longest, WHOLE),
            most(&longest),
            "outlined with a longest-route bonus, case {case}: {generated}"
        );
        assert_eq!(
            outlined(&longest, SHORT),
            most(&longest),
            "in short slices with a longest-route bonus, case {case}: {generated}"
        );
        let alone: i32 = (0..2)
            .map(|train| {
                listed(&problem, train)
                    .iter()
                    .map(|route| {
                        route.revenue + route.visits as i32 * problem.longest_route_bonus_per_stop
                    })
                    .max()
                    .unwrap_or(0)
                    .max(0)
            })
            .sum();
        apart += usize::from(found < alone);
    }
    assert!(
        8 * apart > cases,
        "{apart} of the cases have routes in each other's way"
    );
    assert!(20 * cut > cases, "{cut} lists were cut for memory");
}

/// What the second train's routes earn streamed through the most valuable so many of the first
/// train's, in slices of so many steps, and what trying every such pair finds: the best of a
/// leading route alone, a streamed route alone, and the two of them clear of each other.
fn through_leading(problem: &Problem, leading: usize, slice: u64) -> Option<(i32, i32, bool)> {
    let compiled = Compiled::new(problem, f64::INFINITY);
    let network = compiled.network(problem);
    let whole = Limit::until(f64::INFINITY);
    let plan = |train: usize, limit, streaming, listed| SearchPlan {
        profile: Rc::new(network.profile(&problem.trains[train])),
        closed: None,
        limit,
        memory_budget: usize::MAX,
        selection_bytes_per_candidate: 0,
        best_only: false,
        floor: None,
        streaming,
        listed,
        when_full: WhenFull::Halve,
    };
    let mut routes = network
        .search(&problem.trains[0], plan(0, whole, None, None))
        .candidates;
    if routes.is_empty() {
        return None;
    }
    let leading = 1 + leading % routes.len();
    routes.rank_leading(leading);
    let routes = Rc::new(routes);
    let bonus = problem.longest_route_bonus_per_stop;
    let stored: Vec<Listed> = routes[..leading]
        .iter()
        .map(|candidate| {
            let mut track = vec![0; problem.resource_count.div_ceil(64)];
            routes.resource_bits(candidate, network, &mut track);
            Listed {
                revenue: candidate.revenue,
                visits: candidate.visits,
                track,
                groups: vec![],
            }
        })
        .collect();
    let streamed = listed(problem, 1);
    let alone = |route: &Listed| route.revenue + route.visits as i32 * bonus;
    let pairs = stored.iter().flat_map(|kept| {
        streamed
            .iter()
            .filter(|route| route.track.iter().zip(&kept.track).all(|(a, b)| a & b == 0))
            .map(|route| {
                kept.revenue + route.revenue + kept.visits.max(route.visits) as i32 * bonus
            })
    });
    let most = stored
        .iter()
        .map(alone)
        .chain(streamed.iter().map(alone))
        .chain(pairs)
        .max()
        .unwrap_or(0)
        .max(0);
    let mut selection = StreamingSelection::leading(
        Rc::clone(&routes),
        leading,
        network,
        f64::INFINITY,
        usize::MAX,
    );
    let every_stop = selection.few();
    let mut resume = Resume::default();
    loop {
        selection.go_on(f64::INFINITY);
        let search = network.search(
            &problem.trains[1],
            plan(
                1,
                whole.steps_on(network.taken.get(), slice),
                Some(selection),
                Some((Candidates::new(network), std::mem::take(&mut resume))),
            ),
        );
        selection = search
            .streaming
            .expect("a streamed search keeps its selection");
        if !search.exhausted {
            break;
        }
        resume = search.cut;
    }
    Some((selection.revenue, most, every_stop))
}

#[test]
fn a_stream_through_the_leading_routes_of_a_list_finds_their_best_pair() {
    let mut random = Random(19 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 500);
    let mut searched_at_every_stop = 0;
    for case in 0..cases {
        let mut generated = generated(&mut random, 2);
        if case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let leading = random.below(1 << 16);
        for slice in [u64::MAX / 2, 4] {
            let Some((found, most, every_stop)) = through_leading(&problem, leading, slice) else {
                continue;
            };
            assert_eq!(
                found, most,
                "in slices of {slice}, case {case}: {generated}"
            );
            searched_at_every_stop += usize::from(every_stop);
        }
    }
    assert!(
        searched_at_every_stop > cases,
        "{searched_at_every_stop} streams had their partners sought at every stop"
    );
}

#[test]
fn keeping_two_trains_apart_settles_what_listing_every_route_finds() {
    let mut random = Random(13 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 500);
    let mut settled = 0;
    for case in 0..cases {
        let mut generated = generated(&mut random, 2);
        generated["longest_route_bonus_per_stop"] = json!(0);
        if case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let problem: Problem = serde_json::from_value(generated.clone()).unwrap();
        let compiled = Compiled::new(&problem, f64::INFINITY);
        let network = compiled.network(&problem);
        let previous: Vec<Option<usize>> = (0..2).map(|id| same_profile(&problem, id)).collect();
        let first = Rc::new(network.profile(&problem.trains[0]));
        let second = match previous[1] {
            Some(_) => Rc::clone(&first),
            None => Rc::new(network.profile(&problem.trains[1])),
        };
        let profiles = [first, second];
        let limits = (Limit::until(f64::INFINITY), usize::MAX);
        let mut outline = network.outline(&profiles, &previous, limits.0, limits);
        let Some(mut settling) = Settling::new(&problem, &profiles, &outline) else {
            continue;
        };
        settled += 1;
        assert!(
            network.settle(&profiles, &mut outline, &mut settling, limits, None),
            "case {case}: {generated}"
        );
        assert_eq!(outline.revenue, most(&problem), "case {case}: {generated}");
        let routes: Vec<&Lone> = outline.routes.iter().flatten().collect();
        assert_eq!(
            routes.iter().map(|lone| lone.revenue).sum::<i32>(),
            outline.revenue
        );
        if let [first, second] = routes[..] {
            assert!(
                first
                    .track
                    .iter()
                    .zip(&second.track)
                    .all(|(ours, theirs)| ours & theirs == 0),
                "case {case}: {generated}"
            );
        }
    }
    assert!(
        4 * settled > cases,
        "{settled} of the cases have two trains that run"
    );
}

/// A generated problem with stop groups on more of its stops, and for most groups a limit on
/// the routes that may stop in one: from none to as many as the trains, which bounds nothing.
fn limited(random: &mut Random, trains: usize) -> Value {
    let mut problem = generated(random, trains);
    for stop in problem["stops"].as_array_mut().unwrap() {
        if random.one_in(2) {
            stop["groups"] = json!([random.below(2)]);
        }
    }
    let mut limits = vec![];
    for group in 0..2 {
        if !random.one_in(4) {
            limits.push(json!({"group": group, "routes": random.below(trains + 1)}));
        }
    }
    problem["group_route_limits"] = json!(limits);
    problem
}

/// The problem as the solver takes it, its limited groups given their pieces.
fn with_quotas(generated: &Value) -> Problem {
    let mut problem: Problem = serde_json::from_value(generated.clone()).unwrap();
    problem.limit_groups();
    problem
}

/// What three trains or more earn by their outline, as a fleet that listing its routes outright
/// did not settle.
fn outlined_fleet(problem: &Problem) -> i32 {
    let compiled = Compiled::new(problem, f64::INFINITY);
    let clock = Clock {
        started: milliseconds(),
        compile_ms: 0.0,
        budget_ms: problem.budget_ms,
        pace_ms: problem.budget_ms,
    };
    let (operation, _) = operate(problem, &compiled, clock, clock.whole(), Some((0, vec![])));
    assert!(operation.exhaustive);
    operation.revenue
}

#[test]
fn trains_earn_what_listing_every_route_finds_within_limits_on_stop_groups() {
    let mut random = Random(23 + setting("PRUNING_SEED", 0) as u64);
    let cases = setting("PRUNING_CASES", 400);
    let mut bound = [0; 5];
    for case in 0..cases {
        let trains = 1 + case % 4;
        let mut generated = limited(&mut random, trains);
        if trains > 1 && case % 3 == 0 {
            generated["trains"][1] = generated["trains"][0].clone();
            generated["trains"][1]["id"] = json!("1");
        }
        let plain: Problem = serde_json::from_value(generated.clone()).unwrap();
        let within = most(&plain);
        let problem = with_quotas(&generated);
        assert_eq!(solved(&problem), within, "case {case}: {generated}");
        let mut longest = generated.clone();
        longest["longest_route_bonus_per_stop"] = json!(10);
        let plain_longest: Problem = serde_json::from_value(longest.clone()).unwrap();
        let within_longest = most(&plain_longest);
        let longest = with_quotas(&longest);
        if trains == 2 {
            for (slices, name) in [(WHOLE, "outlined"), (SHORT, "in short slices")] {
                assert_eq!(
                    outlined(&problem, slices),
                    within,
                    "{name}, case {case}: {generated}"
                );
            }
            for (slices, name) in [(WHOLE, "outlined"), (SHORT, "in short slices")] {
                assert_eq!(
                    outlined(&longest, slices),
                    within_longest,
                    "{name} with a longest-route bonus, case {case}: {generated}"
                );
            }
            for bytes in [6_000, 12_000] {
                let cut = cramped(&generated, bytes);
                assert!(
                    cut.revenue <= within && (!cut.exhaustive || cut.revenue == within),
                    "with {bytes} bytes, case {case}: {generated}"
                );
            }
        }
        if trains > 2 {
            assert_eq!(
                outlined_fleet(&problem),
                within,
                "outlined, case {case}: {generated}"
            );
            assert_eq!(
                outlined_fleet(&longest),
                within_longest,
                "outlined with a longest-route bonus, case {case}: {generated}"
            );
        }
        let mut unlimited = generated.clone();
        unlimited["group_route_limits"] = json!([]);
        let unlimited: Problem = serde_json::from_value(unlimited).unwrap();
        bound[trains] += usize::from(within < most(&unlimited));
    }
    for (trains, bound) in bound.iter().enumerate().skip(1) {
        assert!(
            40 * bound > cases,
            "a limit bound {bound} of the cases of {trains} trains"
        );
    }
}
