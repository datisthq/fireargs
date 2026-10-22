use fireargs::{self as f, CommandConfig, Error, Program, ProgramConfig};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
enum Role {
    Admin,
    User,
}

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct EchoInput {
    /// Path to read
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    path: String,
    /// Rows to read
    #[serde(default = "twenty")]
    #[schemars(range(min = 1), extend("fireargs" = {"kind": "option", "short": "l"}))]
    limit: u32,
    /// Role filter
    #[serde(default, skip_serializing_if = "Option::is_none")]
    role: Option<Role>,
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "v"}))]
    verbose: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    header_rows: Option<i64>,
}

fn twenty() -> u32 {
    20
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct StrictInput {
    #[schemars(range(min = 10))]
    count: f64,
}

#[derive(Deserialize, Serialize, JsonSchema)]
struct ResetInput {
    #[serde(default)]
    force: bool,
}

fn describe(description: &str) -> CommandConfig {
    CommandConfig {
        description: Some(description.to_owned()),
        ..Default::default()
    }
}

/// The CLI every `testsuite/` case runs against; `typescript/-test/fixture.ts` is its twin.
pub fn create_fixture() -> Program {
    let echo = f::command(describe("Echo the input back"))
        .input::<EchoInput>()
        .output::<EchoInput>()
        .handler(|input, _| async move { Ok::<_, Error>(input) });
    let strict = f::command(describe("Require a count of at least 10"))
        .input::<StrictInput>()
        .output::<StrictInput>()
        .handler(|input, _| async move { Ok::<_, Error>(input) });
    let reset = f::command(describe("Reset everything"))
        .input::<ResetInput>()
        .output::<ResetInput>()
        .handler(|input, _| async move { Ok::<_, Error>(input) });
    let admin = ProgramConfig {
        description: Some("Admin tasks".into()),
        ..Default::default()
    };
    f::program(ProgramConfig {
        name: Some("fixture".into()),
        ..Default::default()
    })
    .router([
        ("echo", echo.into()),
        ("strict", strict.into()),
        (
            "admin",
            f::program(admin).router([("reset", reset.into())]).into(),
        ),
    ])
}
