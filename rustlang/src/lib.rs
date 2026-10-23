//! Fireargs builds CLIs from typed structs: typed input and output, JSON I/O and
//! LLM-ready manifests, on top of clap and serde. The Rust twin of the `fireargs` npm
//! and PyPI packages.

mod actions {
    pub(crate) mod command {
        pub(crate) mod compile;
        pub(crate) mod create;
        pub(crate) mod manifest;
        pub(crate) mod report;
        pub(crate) mod run;
    }
    pub(crate) mod error {
        pub(crate) mod handle;
    }
    pub(crate) mod field {
        pub(crate) mod read;
    }
    pub(crate) mod program {
        pub(crate) mod compile;
        pub(crate) mod create;
    }
    pub(crate) mod route {
        pub(crate) mod run;
    }
}
mod models {
    pub(crate) mod command;
    pub(crate) mod config;
    pub(crate) mod context;
    pub(crate) mod error;
    pub(crate) mod field;
    pub(crate) mod input;
    pub(crate) mod program;
    pub(crate) mod route;
}
mod settings;

pub use actions::command::create::{CommandBuilder, create_command as command};
pub use actions::command::manifest::{Manifest, Tool};
pub use actions::program::create::create_program as program;
pub use clap;
pub use fireargs_macros::{input, output, value};
pub use models::command::Command;
pub use models::config::FlagConfig;
pub use models::context::{Context, RenderContext};
pub use models::error::{Error, InputError, Issue, OutputError, PathSegment};
pub use models::input::Input;
pub use models::program::Program;
pub use settings::FIREARGS_META_KEY;

/// A handler's result: `Result<O>` is `Result<O, fireargs::Error>`.
pub type Result<T, E = Error> = std::result::Result<T, E>;

/// What the macros expand to; not public API.
#[doc(hidden)]
pub mod __private {
    pub use crate::models::field::ParseFn;
    pub use crate::models::input::{
        FieldSpec, Probe, ProbePlain, ProbeValue, ValueSpec, merge_meta, wrap_parse,
    };
    pub use schemars;
    pub use serde;
    pub use serde_json;
}
