// Typed input: doc comments, defaults and bounds become arguments and options
#[fireargs::input]
struct GreetInput {
    /// The user's name.
    #[fireargs(argument)]
    name: String,
    /// Repeat it n times.
    #[fireargs(default = 1, range(min = 1))]
    times: u32,
    /// Use capitals.
    #[fireargs(short = 's', default)]
    shout: bool,
}

// Typed output, validated on every run
#[fireargs::output]
struct Greeting {
    greeting: String,
}

// A clap command, typed from the handler's signature
fn greet() -> fireargs::Command<GreetInput, Greeting> {
    fireargs::command()
        .name("greet")
        .description("Greet someone politely.")
        .handler(async |input: GreetInput, _| {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            let mut greeting = words.join(" ");
            if input.shout {
                greeting = greeting.to_uppercase();
            }
            Ok(Greeting { greeting })
        })
        // Output for humans; --json prints the data instead
        .render(|output, _| output.greeting.clone())
}

// Parse argv, run the handler and return the exit code
fn main() -> std::process::ExitCode {
    greet().run()
}
