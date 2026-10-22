use super::command::Command;
use super::program::Program;

/// What a router mounts under a key: a leaf command or a nested program.
#[derive(Clone)]
pub enum Route {
    Command(Box<Command>),
    Program(Box<Program>),
}

impl From<Command> for Route {
    fn from(command: Command) -> Self {
        Route::Command(Box::new(command))
    }
}

impl From<Program> for Route {
    fn from(program: Program) -> Self {
        Route::Program(Box::new(program))
    }
}
