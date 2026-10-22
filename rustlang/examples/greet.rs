use std::process::ExitCode;

use fireargs::{self as f, CommandConfig, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// Typed input: doc comments, defaults and bounds become arguments and options
#[derive(Deserialize, JsonSchema)]
struct GreetInput {
    /// The user's name.
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    name: String,
    /// Repeat it n times.
    #[serde(default = "one")]
    #[schemars(range(min = 1))]
    times: u32,
    /// Use capitals.
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "s"}))]
    shout: bool,
}

fn one() -> u32 {
    1
}

// Typed output, validated on every run
#[derive(Serialize, JsonSchema)]
struct Greeting {
    greeting: String,
}

fn main() -> ExitCode {
    let config = CommandConfig {
        name: Some("greet".into()),
        description: Some("Greet someone politely.".into()),
        ..Default::default()
    };
    // A clap command, typed from the input and output structs
    let greet = f::command(config)
        .input::<GreetInput>()
        .output::<Greeting>()
        // Output for humans; --json prints the data instead
        .render(|output, _| Some(output.greeting.clone()))
        .handler(|input, _| async move {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            let mut greeting = words.join(" ");
            if input.shout {
                greeting = greeting.to_uppercase();
            }
            Ok::<_, Error>(Greeting { greeting })
        });
    // Parse argv, run the handler and return the exit code
    greet.run()
}
