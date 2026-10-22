//! Fireargs builds CLIs from serde structs: typed input and output, JSON I/O and
//! LLM-ready manifests, on top of clap. The Rust twin of the `fireargs` npm and PyPI
//! packages.

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
    pub(crate) mod program;
    pub(crate) mod route;
}
mod settings;

pub use actions::command::create::{
    CommandBuilder, InputBuilder, OutputBuilder, create_command as command,
};
pub use actions::command::manifest::{Manifest, Tool};
pub use actions::program::create::{ProgramBuilder, create_program as program};
pub use models::command::Command;
pub use models::config::{CommandConfig, FlagConfig, ProgramConfig, RenderError};
pub use models::context::{Context, RenderContext};
pub use models::error::{Error, InputError, Issue, OutputError, PathSegment};
pub use models::program::Program;
pub use models::route::Route;
pub use settings::FIREARGS_META_KEY;
