use std::fmt;

use serde::Serialize;
use serde::ser;
use serde_json::Value;

use crate::models::error::{Issue, read_path};

/// Serialize a handler's output to JSON, failing at the path of the first non-finite
/// number: `serde_json` would silently write it as `null`.
pub(crate) fn serialize_output<O: Serialize>(output: &O) -> Result<Value, Issue> {
    if let Err(error) = serde_path_to_error::serialize(output, FiniteProbe) {
        let path = read_path(error.path());
        let message = error.into_inner().0;
        return Err(Issue { path, message });
    }
    serde_json::to_value(output).map_err(|error| Issue {
        path: vec![],
        message: error.to_string(),
    })
}

#[derive(Debug)]
struct ProbeError(String);

impl fmt::Display for ProbeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ProbeError {}

impl ser::Error for ProbeError {
    fn custom<T: fmt::Display>(message: T) -> Self {
        ProbeError(message.to_string())
    }
}

// Walks the output without building anything, so only a non-finite float fails it
struct FiniteProbe;

fn check_float(number: f64) -> Result<(), ProbeError> {
    match number.is_finite() {
        true => Ok(()),
        false => Err(ProbeError(format!("{number} is not a finite number"))),
    }
}

impl ser::Serializer for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    type SerializeSeq = Self;
    type SerializeTuple = Self;
    type SerializeTupleStruct = Self;
    type SerializeTupleVariant = Self;
    type SerializeMap = Self;
    type SerializeStruct = Self;
    type SerializeStructVariant = Self;

    fn serialize_bool(self, _: bool) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_i8(self, _: i8) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_i16(self, _: i16) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_i32(self, _: i32) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_i64(self, _: i64) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_i128(self, _: i128) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_u8(self, _: u8) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_u16(self, _: u16) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_u32(self, _: u32) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_u64(self, _: u64) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_u128(self, _: u128) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_f32(self, number: f32) -> Result<(), ProbeError> {
        check_float(f64::from(number))
    }
    fn serialize_f64(self, number: f64) -> Result<(), ProbeError> {
        check_float(number)
    }
    fn serialize_char(self, _: char) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_str(self, _: &str) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_bytes(self, _: &[u8]) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_none(self) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_some<T: ?Sized + Serialize>(self, value: &T) -> Result<(), ProbeError> {
        value.serialize(self)
    }
    fn serialize_unit(self) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_unit_struct(self, _: &'static str) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_unit_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
    ) -> Result<(), ProbeError> {
        Ok(())
    }
    fn serialize_newtype_struct<T: ?Sized + Serialize>(
        self,
        _: &'static str,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(self)
    }
    fn serialize_newtype_variant<T: ?Sized + Serialize>(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(self)
    }
    fn serialize_seq(self, _: Option<usize>) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_tuple(self, _: usize) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_tuple_struct(
        self,
        _: &'static str,
        _: usize,
    ) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_tuple_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        _: usize,
    ) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_map(self, _: Option<usize>) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_struct(self, _: &'static str, _: usize) -> Result<Self, ProbeError> {
        Ok(self)
    }
    fn serialize_struct_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        _: usize,
    ) -> Result<Self, ProbeError> {
        Ok(self)
    }
}

impl ser::SerializeSeq for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_element<T: ?Sized + Serialize>(
        &mut self,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeTuple for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_element<T: ?Sized + Serialize>(
        &mut self,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeTupleStruct for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeTupleVariant for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeMap for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    // serde_path_to_error reads the key's name while it serializes
    fn serialize_key<T: ?Sized + Serialize>(
        &mut self,
        key: &T,
    ) -> Result<(), ProbeError> {
        key.serialize(FiniteProbe)
    }
    fn serialize_value<T: ?Sized + Serialize>(
        &mut self,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeStruct for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        _: &'static str,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

impl ser::SerializeStructVariant for FiniteProbe {
    type Ok = ();
    type Error = ProbeError;
    fn serialize_field<T: ?Sized + Serialize>(
        &mut self,
        _: &'static str,
        value: &T,
    ) -> Result<(), ProbeError> {
        value.serialize(FiniteProbe)
    }
    fn end(self) -> Result<(), ProbeError> {
        Ok(())
    }
}

#[cfg(test)]
#[path = "serialize_unit.rs"]
mod unit;
