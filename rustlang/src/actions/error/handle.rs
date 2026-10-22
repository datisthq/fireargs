use std::io::Write;

use crate::models::config::RenderError;
use crate::models::context::Context;
use crate::models::error::Error;

/// Route a failed run to the nearest `render_error` hook (`hooks` runs nearest first),
/// write what it returns and give exit code 1; with no hook, hand the error back.
pub(crate) fn handle_error(
    hooks: &[RenderError],
    error: Error,
    context: &Context,
    out: &mut dyn Write,
    err: &mut dyn Write,
) -> Result<u8, Error> {
    let Some(render_error) = hooks.first() else {
        return Err(error);
    };
    match (render_error(&error, context), context.json) {
        (Some(value), true) => {
            writeln!(out, "{}", serde_json::to_string_pretty(&value)?)?
        }
        (Some(serde_json::Value::String(text)), false) => writeln!(err, "{text}")?,
        _ => {}
    }
    Ok(1)
}
