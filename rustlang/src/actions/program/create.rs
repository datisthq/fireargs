use crate::models::config::ProgramConfig;
use crate::models::program::Program;
use crate::models::route::Route;

/// Open a program builder; `.router(...)` mounts commands and nested programs.
pub fn create_program(config: ProgramConfig) -> ProgramBuilder {
    ProgramBuilder { config }
}

/// A program waiting for its routes.
pub struct ProgramBuilder {
    config: ProgramConfig,
}

impl ProgramBuilder {
    /// Mount each route under its key, which is its name on the command line and its
    /// path segment in the `--llms` manifest.
    pub fn router<K: Into<String>>(
        self,
        routes: impl IntoIterator<Item = (K, Route)>,
    ) -> Program {
        let routes = routes.into_iter().map(|(key, route)| (key.into(), route));
        Program {
            config: self.config,
            routes: routes.collect(),
        }
    }
}
