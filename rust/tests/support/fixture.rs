use fireargs::{Command, Program};

#[fireargs::option]
enum Role {
    Admin,
    User,
}

#[fireargs::input]
struct EchoInput {
    /// Path to read
    #[fireargs(argument)]
    path: String,
    /// Rows to read
    #[fireargs(short = 'l', default = 20, range(min = 1))]
    limit: u32,
    /// Role filter
    role: Option<Role>,
    #[fireargs(short = 'v', default)]
    verbose: bool,
    header_rows: Option<i64>,
}

#[fireargs::input]
struct StrictInput {
    #[fireargs(range(min = 10))]
    count: f64,
}

#[fireargs::input]
struct TagsInput {
    #[fireargs(default, parse = split_commas)]
    tags: Vec<String>,
    #[fireargs(default)]
    rows: Vec<i64>,
    #[fireargs(conflicts = quiet, implies(level = 3))]
    loud: Option<bool>,
    quiet: Option<bool>,
    level: Option<i64>,
}

#[fireargs::input]
struct ResetInput {
    #[fireargs(default)]
    force: bool,
}

#[fireargs::input]
pub struct SoloInput {
    /// Who to greet
    #[fireargs(argument, default = "world")]
    name: String,
    /// Greetings to print
    #[fireargs(short = 't', env = "SOLO_TIMES", default = 1, range(min = 1))]
    times: u32,
    #[fireargs(default)]
    loud: bool,
}

fn split_commas(text: &str) -> fireargs::Result<Vec<String>, String> {
    Ok(text.split(',').map(str::to_owned).collect())
}

/// The program `conformance/` cases run against by default; `typescript/-test/fixture.ts` is its twin.
pub fn create_fixture() -> Program {
    let echo = fireargs::command()
        .description("Echo the input back")
        .handler(async |input: EchoInput, _| Ok(input));
    let strict = fireargs::command()
        .description("Require a count of at least 10")
        .handler(async |input: StrictInput, _| Ok(input));
    let tags = fireargs::command()
        .description("Collect tags and rows")
        .handler(async |input: TagsInput, _| Ok(input));
    let reset = fireargs::command()
        .description("Reset everything")
        .handler(async |input: ResetInput, _| Ok(input));
    let admin = fireargs::program()
        .description("Admin tasks")
        .command("reset", reset);
    fireargs::program()
        .name("fixture")
        .command("echo", echo)
        .command("strict", strict)
        .command("tags", tags)
        .program("admin", admin)
}

/// The standalone command `"fixture": "command"` cases run against.
pub fn create_solo() -> Command<SoloInput, SoloInput> {
    fireargs::command()
        .name("solo")
        .description("Greet someone")
        .version("1.2.3")
        .handler(async |input: SoloInput, _| Ok(input))
        .render(|output, _| {
            vec![format!("Hello, {}!", output.name); output.times as usize].join("\n")
        })
}
