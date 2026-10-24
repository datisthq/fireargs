use crate::models::program::Program;

/// Open a program; `.command(...)` and `.program(...)` mount its routes.
pub fn create_program() -> Program {
    Program::default()
}
