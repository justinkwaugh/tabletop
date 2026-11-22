//! A single train's search drops routes it cannot keep and connections that differ from one
//! already walked only in track nothing needed: the cases here are the ones that pruning must
//! not lose. Generated networks are held to a listing of every route in the crate's own tests.

use rail_route_solver::solve_json;
use serde_json::{Value, json};

fn solve(problem: &Value) -> Value {
    let result: Value =
        serde_json::from_slice(&solve_json(&serde_json::to_vec(problem).unwrap())).unwrap();
    assert!(result.get("error").is_none(), "{result}: {problem}");
    assert_eq!(result["exhaustive"], true, "{problem}");
    result
}

/// A line of stops 0 – 1 – 2, each link a single piece of track unless given more.
fn line(links: &[(usize, usize, &[usize], usize)], stops: usize, hexes: usize) -> Value {
    let resources = links
        .iter()
        .flat_map(|link| link.2)
        .max()
        .map_or(0, |most| most + 1);
    json!({
        "version": 12, "junction_count": 1, "budget_ms": 30000, "memory_budget_bytes": 48_000_000,
        "resource_count": resources, "group_count": 1, "hex_bonuses": vec![0; hexes],
        "stops": (0..stops).map(|id| json!({
            "token": id == 0, "blocked": false, "endpoint": true, "allowed": true,
            "city": true, "town": false, "hex": 0, "groups": [],
        })).collect::<Vec<_>>(),
        "trains": [{
            "id": "0", "distance": stops, "crossing_costs": [0, 0, 0], "requires_city": false,
            "visit_costs": vec![1; stops],
            "revenues": (0..stops).map(|id| 10 * (id + 1)).collect::<Vec<_>>(),
            "first_bonus": vec![0; stops],
        }],
        "arcs": links.iter().enumerate().flat_map(|(id, &(a, b, track, hex))| {
            [(a, b), (b, a)].map(|(from, to)| json!({
                "from": from, "to": to, "next": [], "junctions": [], "resources": track,
                "path": id, "hex": hex, "crossings": 0, "terminal": false,
            }))
        }).collect::<Vec<_>>(),
    })
}

#[test]
fn a_second_way_into_a_stop_is_walked_for_the_way_out_the_first_one_took() {
    // Stop 1 has two ways out, track 1 and track 2; the only link on to stop 2 leaves by track 1.
    // The first link from stop 0 enters by track 1, so the whole line needs the second.
    let p = line(
        &[(0, 1, &[0, 1], 0), (0, 1, &[0, 2], 0), (1, 2, &[1, 3], 0)],
        3,
        1,
    );
    assert_eq!(solve(&p)["revenue"], 60);
    // Shared track in the middle of the first link keeps the link on out just the same.
    let p = line(
        &[
            (0, 1, &[0, 4, 1], 0),
            (0, 1, &[5, 2], 0),
            (1, 2, &[6, 4, 3], 0),
        ],
        3,
        1,
    );
    assert_eq!(solve(&p)["revenue"], 60);
}

#[test]
fn a_link_that_pays_less_is_walked_when_the_better_one_closes_a_hex_the_route_needs() {
    // Both links 0 – 1 run to stop 1; the first runs through hex 1, which pays 20 and may be
    // entered once. The only link on to stop 2 runs through hex 1 too.
    let mut p = line(
        &[(0, 1, &[0, 1], 1), (0, 1, &[2, 3], 0), (1, 2, &[4, 5], 1)],
        3,
        2,
    );
    p["hex_bonuses"] = json!([0, 20]);
    p["no_reentry_hexes"] = json!([false, true]);
    p["trains"][0]["revenues"] = json!([10, 10, 50]);
    assert_eq!(solve(&p)["revenue"], 90);
    // Without the stop beyond, the paying link is the better one.
    p["stops"][2]["allowed"] = json!(false);
    assert_eq!(solve(&p)["revenue"], 40);
}

#[test]
fn a_connection_bonus_outweighs_better_paying_stops() {
    // Stops 3 and 4 pay most; the bonus needs stops 1 and 2, with stop 0 also in the route.
    let mut p = line(
        &[
            (0, 1, &[0], 0),
            (1, 2, &[1], 0),
            (0, 3, &[2], 0),
            (3, 4, &[3], 0),
        ],
        5,
        1,
    );
    p["trains"][0]["distance"] = json!(3);
    p["trains"][0]["revenues"] = json!([10, 10, 10, 40, 40]);
    assert_eq!(solve(&p)["revenue"], 90);
    p["trains"][0]["connection_bonuses"] = json!([{
        "from": [null, 30, null, null, null], "to": [null, null, 40, null, null],
        "requires": [[true, false, false, false, false]],
    }]);
    assert_eq!(solve(&p)["revenue"], 100);
}

#[test]
fn a_train_running_through_a_blocked_city_is_bound_by_what_its_other_stops_pay() {
    // 0 – 1 – 2 – 3 with stop 2 blocked and worth most: the train may run through it for nothing
    // and reach stop 3, or end at it.
    let mut p = line(&[(0, 1, &[0], 0), (1, 2, &[1], 0), (2, 3, &[2], 0)], 4, 1);
    p["stops"][2]["blocked"] = json!(true);
    p["trains"][0]["revenues"] = json!([10, 10, 60, 30]);
    assert_eq!(solve(&p)["revenue"], 80);
    p["trains"][0]["blocked_passes"] = json!(1);
    p["trains"][0]["paying_stop_limit"] = json!(3);
    assert_eq!(solve(&p)["revenue"], 80);
    p["trains"][0]["revenues"] = json!([10, 10, 60, 70]);
    assert_eq!(solve(&p)["revenue"], 90);
}
