use std::fmt;

/// Any error a handler returns; `?` converts every `std::error::Error` into it.
pub type Error = Box<dyn std::error::Error + Send + Sync>;

/// One segment of the path to a failing value.
#[derive(Clone, Debug, PartialEq)]
pub enum PathSegment {
    Key(String),
    Index(usize),
}

/// One validation failure: where it is and what is wrong.
#[derive(Clone, Debug)]
pub struct Issue {
    pub path: Vec<PathSegment>,
    pub message: String,
}

/// Input that failed before the handler ran: bad `--json` text or a schema mismatch.
/// A `render_error` hook can downcast the `Error` it receives to this.
#[derive(Clone, Debug)]
pub enum InputError {
    InvalidJson(String),
    Invalid(Vec<Issue>),
}

/// A handler result that does not match the output schema.
#[derive(Clone, Debug)]
pub struct OutputError {
    pub issues: Vec<Issue>,
}

impl fmt::Display for InputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InputError::InvalidJson(message) => write!(f, "invalid JSON: {message}"),
            InputError::Invalid(issues) => write_issues(f, "invalid input", issues),
        }
    }
}

impl fmt::Display for OutputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write_issues(f, "invalid output", &self.issues)
    }
}

impl std::error::Error for InputError {}
impl std::error::Error for OutputError {}

fn write_issues(
    f: &mut fmt::Formatter<'_>,
    title: &str,
    issues: &[Issue],
) -> fmt::Result {
    write!(f, "{title}")?;
    for issue in issues {
        match format_path(&issue.path) {
            path if path.is_empty() => write!(f, "; {}", issue.message)?,
            path => write!(f, "; at '{path}': {}", issue.message)?,
        }
    }
    Ok(())
}

/// Write a path as zod's dot path: `rows[0].name`.
pub(crate) fn format_path(path: &[PathSegment]) -> String {
    let mut text = String::new();
    for segment in path {
        match segment {
            PathSegment::Key(key) if text.is_empty() => text.push_str(key),
            PathSegment::Key(key) => text.push_str(&format!(".{key}")),
            PathSegment::Index(index) => text.push_str(&format!("[{index}]")),
        }
    }
    text
}
