use super::command::Leaf;
use super::program::Program;

/// What a router mounts under a key: a leaf command or a nested program.
#[derive(Clone)]
pub(crate) enum Route {
    Command(Box<Leaf>),
    Program(Box<Program>),
}
