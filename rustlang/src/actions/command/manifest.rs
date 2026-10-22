use serde::Serialize;
use serde_json::{Value, json};

use crate::models::command::Command;

/// One MCP-style tool entry in a `--llms` manifest. `name` is the space-separated path
/// beneath the binary; both schemas are JSON Schemas with fireargs meta stripped.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: Value,
    pub output_schema: Value,
}

/// The top-level shape of `--llms` output, MCP's `tools/list` response.
#[derive(Clone, Debug, Serialize)]
pub struct Manifest {
    pub tools: Vec<Tool>,
}

/// Build a manifest: the reserved `help` tool, then the given tools.
pub(crate) fn build_manifest(tools: Vec<Tool>) -> Manifest {
    let mut all = vec![build_help_tool()];
    all.extend(tools);
    Manifest { tools: all }
}

/// The reserved `help` tool that prefaces every manifest; its description carries the
/// calling convention, since MCP clients always show descriptions to the model.
fn build_help_tool() -> Tool {
    Tool {
        name: "help".to_owned(),
        description: Some(
            "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`."
                .to_owned(),
        ),
        input_schema: json!({"type": "object", "properties": {}}),
        output_schema: json!({"type": "object", "properties": {}}),
    }
}

/// Build a leaf's tool under its route path.
pub(crate) fn build_leaf_tool(command: &Command, name: &str) -> Tool {
    Tool {
        name: name.to_owned(),
        description: command.config.description.clone().filter(|d| !d.is_empty()),
        input_schema: command.input_schema.clone(),
        output_schema: command.output_schema.clone(),
    }
}
