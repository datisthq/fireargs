/// What a handler and a `render_error` hook receive besides the input.
#[derive(Clone, Debug)]
pub struct Context {
    /// `true` under `--json`, with or without a value: write nothing else to stdout.
    pub json: bool,
    /// The space-separated route path of the running command, such as `"admin reset"`.
    pub command: String,
}

/// What `render` receives besides the output: the context plus the parsed input.
#[derive(Debug)]
pub struct RenderContext<'a, I> {
    /// Always `false`: `render` never runs under `--json`.
    pub json: bool,
    /// The space-separated route path of the running command.
    pub command: String,
    /// The parsed input the handler received.
    pub input: &'a I,
}
