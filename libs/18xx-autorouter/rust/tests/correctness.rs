use rail_route_solver::solve_json;
use serde_json::{Value, json};

fn solve(problem: &Value) -> Value {
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(problem).unwrap())).unwrap();
    assert!(result.get("error").is_none(), "{result}");
    assert_eq!(result["exhaustive"], true);
    result
}

fn graph(nodes: usize, edges: &[(usize, usize)], trains: &[u32]) -> Value {
    json!({
        "version": 4, "junction_count": 1, "budget_ms": 30000,
        "resource_count": edges.len(), "group_count": 1, "hex_bonuses": vec![0; edges.len()],
        "stops": (0..nodes).map(|id| json!({
            "token": id == 0, "blocked": false, "endpoint": true, "allowed": true,
            "city": true, "groups": [],
        })).collect::<Vec<_>>(),
        "trains": trains.iter().enumerate().map(|(id, distance)| json!({
            "id": id.to_string(), "distance": distance, "counts_crossings": false, "requires_city": false, "visit_costs": vec![1; nodes],
            "revenues": (0..nodes).map(|n| 10 * (n + 1)).collect::<Vec<_>>(),
            "first_bonus": vec![0; nodes],
        })).collect::<Vec<_>>(),
        "arcs": edges.iter().enumerate().flat_map(|(id, &(a, b))| [(a,b),(b,a)].map(|(from,to)| json!({
            "from": from, "to": to, "next": [], "junctions": [], "resources": [id], "path": id, "hex": id, "crossings": 0, "terminal": false,
        }))).collect::<Vec<_>>(),
    })
}

#[test]
fn station_can_be_interior_and_routes_may_share_the_station() {
    let p = graph(3, &[(0, 1), (0, 2)], &[3]);
    assert_eq!(solve(&p)["revenue"], 60);
    let p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    assert_eq!(solve(&p)["revenue"], 70);
}

#[test]
fn track_cannot_be_reused_across_trains() {
    let p = graph(3, &[(0, 1), (1, 2)], &[3, 3]);
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn express_trains_pay_a_station_and_optimize_paid_connection_bonuses() {
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[5]);
    p["trains"][0]["revenues"] = json!([10, 30, 40, 50, 60]);
    p["trains"][0]["paying_stop_limit"] = json!(3);
    p["trains"][0]["require_paying_token"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 120);
    p["trains"][0]["connection_bonuses"] = json!([{
        "from": [null, 70, null, null, null],
        "to": [null, null, null, null, 50],
    }]);
    assert_eq!(solve(&p)["revenue"], 220);
    p["trains"][0]["paying_stop_limit"] = json!(2);
    assert_eq!(solve(&p)["revenue"], 70);
    p["trains"][0]["require_paying_token"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 210);
}

#[test]
fn longest_route_bonus_is_paid_once_for_the_fleet() {
    let mut p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    p["longest_route_bonus_per_stop"] = json!(10);
    assert_eq!(solve(&p)["revenue"], 90);
}

#[test]
fn longest_route_bonus_influences_single_train_candidate_selection() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["revenues"] = json!([10, 20, 0]);
    p["longest_route_bonus_per_stop"] = json!(10);
    assert_eq!(solve(&p)["revenue"], 60);
    assert_eq!(
        solve(&p)["routes"][0]["connections"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn blocked_city_is_an_endpoint_and_cannot_be_crossed() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][1]["blocked"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn forbidden_endpoints_may_be_visited_internally() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][1]["endpoint"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 60);
    p["stops"][2]["allowed"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 0);
}

#[test]
fn groups_and_weighted_visits_limit_paths() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["stops"][0]["groups"] = json!([0]);
    p["stops"][2]["groups"] = json!([0]);
    assert_eq!(solve(&p)["revenue"], 30);
    p["stops"][2]["groups"] = json!([]);
    p["trains"][0]["visit_costs"][2] = json!(2);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn traversal_bonuses_are_paid_once_per_hex() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["hex_bonuses"] = json!([25]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["hex"] = json!(0);
    }
    assert_eq!(solve(&p)["revenue"], 85);
}

#[test]
fn first_bonus_respects_route_direction() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["first_bonus"] = json!([10, 0, 40]);
    let result = solve(&p);
    assert_eq!(result["revenue"], 100);
    assert_eq!(result["routes"][0]["connections"][0]["from"], 2);
}

#[test]
fn edge_ports_only_connect_through_the_neighbor() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["trains"][0]["revenues"] = json!([10, 100, 30]);
    p["arcs"] = json!([
        {"from": 0, "to": null, "next": [4], "junctions": [], "resources": [0], "path": 0, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 0, "next": [], "junctions": [], "resources": [0], "path": 0, "hex": 0, "crossings": 0, "terminal": false},
        {"from": 1, "to": null, "next": [4], "junctions": [], "resources": [0], "path": 1, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 1, "next": [], "junctions": [], "resources": [0], "path": 1, "hex": 0, "crossings": 0, "terminal": false},
        {"from": null, "to": 2, "next": [], "junctions": [], "resources": [1], "path": 2, "hex": 1, "crossings": 0, "terminal": false},
        {"from": 2, "to": null, "next": [1,3], "junctions": [], "resources": [1], "path": 2, "hex": 1, "crossings": 0, "terminal": false}
    ]);
    assert_eq!(solve(&p)["revenue"], 40);
}

#[test]
fn terminal_track_may_be_last_but_not_internal() {
    let mut p = graph(3, &[(0, 1), (1, 2)], &[3]);
    p["arcs"][2]["terminal"] = json!(true);
    p["arcs"][3]["terminal"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 60);
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[4]);
    p["arcs"][2]["terminal"] = json!(true);
    p["arcs"][3]["terminal"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 60);
}

fn permutations(remaining: &mut Vec<usize>, prefix: &mut Vec<usize>, result: &mut Vec<Vec<usize>>) {
    if prefix.len() >= 2 {
        result.push(prefix.clone());
    }
    for i in 0..remaining.len() {
        let item = remaining.remove(i);
        prefix.push(item);
        permutations(remaining, prefix, result);
        prefix.pop();
        remaining.insert(i, item);
    }
}

fn exhaustive_oracle(p: &Value, edges: &[(usize, usize)]) -> i64 {
    let stops = p["stops"].as_array().unwrap();
    let mut paths = vec![];
    permutations(&mut (0..stops.len()).collect(), &mut vec![], &mut paths);
    let mut candidates = vec![];
    for train in p["trains"].as_array().unwrap() {
        let mut choices = vec![(0, 0u64, 0usize)];
        for path in &paths {
            if !path.iter().any(|&n| stops[n]["token"] == true)
                || path.iter().any(|&n| stops[n]["allowed"] == false)
                || stops[path[0]]["endpoint"] == false
                || stops[*path.last().unwrap()]["endpoint"] == false
                || path[1..path.len() - 1]
                    .iter()
                    .any(|&n| stops[n]["blocked"] == true)
                || path
                    .iter()
                    .map(|&n| train["visit_costs"][n].as_u64().unwrap())
                    .sum::<u64>()
                    > train["distance"].as_u64().unwrap()
            {
                continue;
            }
            let all_groups: Vec<_> = path
                .iter()
                .flat_map(|&n| {
                    stops[n]["groups"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|g| g.as_u64().unwrap())
                })
                .collect();
            if all_groups
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                != all_groups.len()
            {
                continue;
            }
            let route_edges: Option<Vec<_>> = path
                .windows(2)
                .map(|pair| {
                    edges.iter().position(|&(a, b)| {
                        (a == pair[0] && b == pair[1]) || (a == pair[1] && b == pair[0])
                    })
                })
                .collect();
            let Some(route_edges) = route_edges else {
                continue;
            };
            let paying_count = train["paying_stop_limit"]
                .as_u64()
                .map_or(path.len(), |n| n as usize)
                .min(path.len());
            let paid_revenue = (0u64..1 << path.len())
                .filter(|bits| bits.count_ones() as usize == paying_count)
                .filter_map(|bits| {
                    let paid: Vec<_> = path
                        .iter()
                        .enumerate()
                        .filter(|(index, _)| bits & (1 << index) != 0)
                        .map(|(_, &node)| node)
                        .collect();
                    if train["require_paying_token"] == true
                        && !paid.iter().any(|&node| stops[node]["token"] == true)
                    {
                        return None;
                    }
                    let mut revenue = paid
                        .iter()
                        .map(|&node| train["revenues"][node].as_i64().unwrap())
                        .sum::<i64>();
                    if let Some(bonuses) = train["connection_bonuses"].as_array() {
                        for bonus in bonuses {
                            let from = paid
                                .iter()
                                .filter_map(|&node| bonus["from"][node].as_i64())
                                .max();
                            let to = paid
                                .iter()
                                .filter_map(|&node| bonus["to"][node].as_i64())
                                .max();
                            if let (Some(from), Some(to)) = (from, to) {
                                revenue += from + to;
                            }
                        }
                    }
                    Some(revenue)
                })
                .max()
                .unwrap();
            let revenue: i64 = paid_revenue
                + route_edges
                    .iter()
                    .map(|&e| p["hex_bonuses"][e].as_i64().unwrap())
                    .sum::<i64>()
                + path
                    .iter()
                    .map(|&n| train["first_bonus"][n].as_i64().unwrap())
                    .find(|&b| b != 0)
                    .unwrap_or(0);
            choices.push((
                revenue,
                route_edges.iter().fold(0u64, |bits, &e| bits | (1 << e)),
                path.len(),
            ));
        }
        candidates.push(choices);
    }
    fn product(lists: &[Vec<(i64, u64, usize)>], used: u64, longest: usize, bonus: i64) -> i64 {
        if lists.is_empty() {
            return longest as i64 * bonus;
        }
        lists[0]
            .iter()
            .filter(|(_, bits, _)| bits & used == 0)
            .map(|&(value, bits, visits)| {
                value + product(&lists[1..], used | bits, longest.max(visits), bonus)
            })
            .max()
            .unwrap()
    }
    product(
        &candidates,
        0,
        0,
        p["longest_route_bonus_per_stop"].as_i64().unwrap_or(0),
    )
}

#[test]
fn agrees_with_unpruned_permutation_oracle_on_200_graphs() {
    let mut seed = 91u64;
    let mut random = || {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        seed >> 32
    };
    for case in 0..200 {
        let mut edges = vec![];
        for a in 0..5 {
            for b in a + 1..5 {
                if random() % 3 != 0 {
                    edges.push((a, b));
                }
            }
        }
        let mut p = graph(
            5,
            &edges,
            &[2 + (random() % 4) as u32, 2 + (random() % 4) as u32],
        );
        for stop in p["stops"].as_array_mut().unwrap() {
            stop["blocked"] = json!(random() % 5 == 0);
            stop["endpoint"] = json!(random() % 5 != 0);
            stop["allowed"] = json!(random() % 8 != 0);

            if random() % 3 == 0 {
                stop["groups"] = json!([0]);
            }
        }
        for bonus in p["hex_bonuses"].as_array_mut().unwrap() {
            *bonus = json!(random() % 3 * 10);
        }
        for train in p["trains"].as_array_mut().unwrap() {
            for cost in train["visit_costs"].as_array_mut().unwrap() {
                *cost = json!(random() % 3);
            }
            for revenue in train["revenues"].as_array_mut().unwrap() {
                *revenue = json!(10 + random() % 10 * 10);
            }
            for bonus in train["first_bonus"].as_array_mut().unwrap() {
                *bonus = json!(random() % 3 * 10);
            }
        }
        assert_eq!(
            solve(&p)["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &edges),
            "case {case}: {p}"
        );
        p["longest_route_bonus_per_stop"] = json!((case % 3) * 10);
        for (id, train) in p["trains"].as_array_mut().unwrap().iter_mut().enumerate() {
            train["paying_stop_limit"] = json!(1 + (case + id) % 4);
            train["require_paying_token"] = json!(case % 2 == 0);
            train["connection_bonuses"] = json!([{
                "from": [0, 30, null, null, null],
                "to": [null, null, 20, null, 50],
            }]);
        }
        assert_eq!(
            solve(&p)["revenue"].as_i64().unwrap(),
            exhaustive_oracle(&p, &edges),
            "scored case {case}: {p}"
        );
    }
}

#[test]
fn asymmetric_connectivity_is_rejected() {
    let mut p = graph(2, &[(0, 1)], &[2]);
    p["arcs"][1]["to"] = json!(1);
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert_eq!(result["error"], "Track connectivity must be reversible");
}

#[test]
fn interrupted_search_does_not_claim_exhaustion() {
    let edges: Vec<_> = (0..9)
        .flat_map(|a| (a + 1..9).map(move |b| (a, b)))
        .collect();
    let mut p = graph(9, &edges, &[9, 9]);
    p["budget_ms"] = json!(0.001);
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(&p).unwrap())).unwrap();
    assert!(result.get("error").is_none());
    assert_eq!(result["exhaustive"], false);
    assert_eq!(result["path_exhaustive"], false);
}

#[test]
fn zero_cost_towns_do_not_consume_city_capacity() {
    let mut p = graph(5, &[(0, 1), (1, 2), (2, 3), (3, 4)], &[2]);
    p["trains"][0]["visit_costs"] = json!([0, 1, 0, 1, 0]);
    assert_eq!(solve(&p)["revenue"], 150);
}

#[test]
fn crossing_capacity_is_independent_of_visits() {
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[2]);
    p["trains"][0]["counts_crossings"] = json!(true);
    p["trains"][0]["visit_costs"] = json!([0, 0, 0, 0]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["crossings"] = json!(1);
    }
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn required_city_is_separate_from_the_station_requirement() {
    let mut p = graph(2, &[(0, 1)], &[2]);
    p["trains"][0]["requires_city"] = json!(true);
    for stop in p["stops"].as_array_mut().unwrap() {
        stop["city"] = json!(false);
    }
    assert_eq!(solve(&p)["revenue"], 0);
    p["stops"][1]["city"] = json!(true);
    assert_eq!(solve(&p)["revenue"], 30);
}

#[test]
fn junction_cannot_be_revisited_between_stops() {
    let mut p = graph(2, &[(0, 1); 4], &[2]);
    for id in 0..4 {
        let fwd = id * 2;
        let rev = fwd + 1;
        p["arcs"][fwd]["from"] = if id == 0 { json!(0) } else { Value::Null };
        p["arcs"][fwd]["to"] = if id == 3 { json!(1) } else { Value::Null };
        p["arcs"][fwd]["next"] = if id == 3 { json!([]) } else { json!([fwd + 2]) };
        p["arcs"][rev]["to"] = p["arcs"][fwd]["from"].clone();
        p["arcs"][rev]["from"] = p["arcs"][fwd]["to"].clone();
        p["arcs"][rev]["next"] = if id == 0 { json!([]) } else { json!([rev - 2]) };
    }
    p["arcs"][0]["junctions"] = json!([0]);
    p["arcs"][1]["junctions"] = json!([0]);
    p["arcs"][2]["junctions"] = json!([0]);
    p["arcs"][3]["junctions"] = json!([0]);
    assert_eq!(solve(&p)["revenue"], 30);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 0);
}

#[test]
fn junction_can_be_revisited_after_another_stop_and_by_another_train() {
    let mut p = graph(4, &[(0, 1), (1, 2), (2, 3)], &[4]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 100);
    let mut p = graph(3, &[(0, 1), (0, 2)], &[2, 2]);
    for arc in p["arcs"].as_array_mut().unwrap() {
        arc["junctions"] = json!([0]);
    }
    assert_eq!(solve(&p)["revenue"], 70);
}
