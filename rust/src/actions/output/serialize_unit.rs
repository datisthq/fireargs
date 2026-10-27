#![allow(clippy::unwrap_used)]
use std::collections::BTreeMap;

use serde_json::json;

use super::*;
use crate::models::error::PathSegment;

#[derive(Serialize)]
struct Report {
    rows: Vec<f64>,
    totals: BTreeMap<String, f32>,
}

#[test]
fn serializes_finite_output() {
    let report = Report {
        rows: vec![1.0, 2.5],
        totals: BTreeMap::from([("a".to_owned(), 1.0)]),
    };
    let value = serialize_output(&report).unwrap();
    assert_eq!(value, json!({"rows": [1.0, 2.5], "totals": {"a": 1.0}}));
}

#[test]
fn fails_at_the_path_of_a_non_finite_number() {
    let report = Report {
        rows: vec![1.0, f64::NAN],
        totals: BTreeMap::new(),
    };
    let issue = serialize_output(&report).unwrap_err();
    assert_eq!(
        issue.path,
        [PathSegment::Key("rows".to_owned()), PathSegment::Index(1)]
    );
    assert_eq!(issue.message, "NaN is not a finite number");

    let report = Report {
        rows: vec![],
        totals: BTreeMap::from([("a".to_owned(), f32::INFINITY)]),
    };
    let issue = serialize_output(&report).unwrap_err();
    assert_eq!(
        issue.path,
        [
            PathSegment::Key("totals".to_owned()),
            PathSegment::Key("a".to_owned())
        ]
    );
}
