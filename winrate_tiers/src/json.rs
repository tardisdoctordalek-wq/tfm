//! Minimal dependency-free JSON reader.
//!
//! The SDK crate keeps its own JSON helpers `pub(crate)` and carries zero
//! dependencies, so a mod that has to walk whole records brings its own.
//! This covers what the tier engine needs: parse a document, walk it by
//! path, read scalars, and pretty-print it for the schema dump.

use std::collections::BTreeMap;
use std::fmt::Write as _;

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(BTreeMap<String, Value>),
}

impl Value {
    pub fn parse(input: &str) -> Option<Value> {
        let bytes = input.as_bytes();
        let mut pos = 0usize;
        let value = parse_value(bytes, &mut pos, 0)?;
        skip_ws(bytes, &mut pos);
        (pos == bytes.len()).then_some(value)
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Value::Obj(map) => map.get(key),
            _ => None,
        }
    }

    pub fn at(&self, index: usize) -> Option<&Value> {
        match self {
            Value::Arr(items) => items.get(index),
            _ => None,
        }
    }

    /// Walks a dot-separated path, the same shape the host's JSON slots use:
    /// object keys descend objects, a numeric segment indexes an array.
    pub fn path(&self, path: &str) -> Option<&Value> {
        let mut cursor = self;
        for segment in path.split('.').filter(|s| !s.is_empty()) {
            cursor = match cursor {
                Value::Arr(_) => cursor.at(segment.parse::<usize>().ok()?)?,
                _ => cursor.get(segment)?,
            };
        }
        Some(cursor)
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Value::Num(n) => Some(*n),
            Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            // Records sometimes carry counts as strings; accept those too
            // rather than silently reading them as "no data".
            Value::Str(s) => s.trim().parse().ok(),
            _ => None,
        }
    }

    pub fn as_usize(&self) -> Option<usize> {
        let n = self.as_f64()?;
        (n.is_finite() && n >= 0.0).then_some(n as usize)
    }

    pub fn as_array(&self) -> Option<&[Value]> {
        match self {
            Value::Arr(items) => Some(items),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&BTreeMap<String, Value>> {
        match self {
            Value::Obj(map) => Some(map),
            _ => None,
        }
    }

    /// Short type name used by the schema dump.
    pub fn kind(&self) -> &'static str {
        match self {
            Value::Null => "null",
            Value::Bool(_) => "bool",
            Value::Num(_) => "number",
            Value::Str(_) => "string",
            Value::Arr(_) => "array",
            Value::Obj(_) => "object",
        }
    }
}

fn skip_ws(bytes: &[u8], pos: &mut usize) {
    while *pos < bytes.len() && matches!(bytes[*pos], b' ' | b'\t' | b'\n' | b'\r') {
        *pos += 1;
    }
}

/// Deeply nested input must not blow the stack — game records nest a few
/// levels, anything past this is malformed or hostile.
const MAX_DEPTH: usize = 96;

fn parse_value(bytes: &[u8], pos: &mut usize, depth: usize) -> Option<Value> {
    if depth > MAX_DEPTH {
        return None;
    }
    skip_ws(bytes, pos);
    match *bytes.get(*pos)? {
        b'{' => parse_object(bytes, pos, depth),
        b'[' => parse_array(bytes, pos, depth),
        b'"' => Some(Value::Str(parse_string(bytes, pos)?)),
        b't' => parse_literal(bytes, pos, "true", Value::Bool(true)),
        b'f' => parse_literal(bytes, pos, "false", Value::Bool(false)),
        b'n' => parse_literal(bytes, pos, "null", Value::Null),
        _ => parse_number(bytes, pos),
    }
}

fn parse_literal(bytes: &[u8], pos: &mut usize, word: &str, value: Value) -> Option<Value> {
    if bytes.len() - *pos < word.len() || &bytes[*pos..*pos + word.len()] != word.as_bytes() {
        return None;
    }
    *pos += word.len();
    Some(value)
}

fn parse_number(bytes: &[u8], pos: &mut usize) -> Option<Value> {
    let start = *pos;
    if bytes.get(*pos) == Some(&b'-') {
        *pos += 1;
    }
    while matches!(bytes.get(*pos), Some(b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-')) {
        *pos += 1;
    }
    if start == *pos {
        return None;
    }
    std::str::from_utf8(&bytes[start..*pos]).ok()?.parse().ok().map(Value::Num)
}

fn parse_string(bytes: &[u8], pos: &mut usize) -> Option<String> {
    if bytes.get(*pos) != Some(&b'"') {
        return None;
    }
    *pos += 1;
    let mut out = String::new();
    loop {
        match *bytes.get(*pos)? {
            b'"' => {
                *pos += 1;
                return Some(out);
            }
            b'\\' => {
                *pos += 1;
                match *bytes.get(*pos)? {
                    b'"' => out.push('"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'n' => out.push('\n'),
                    b't' => out.push('\t'),
                    b'r' => out.push('\r'),
                    b'b' => out.push('\u{0008}'),
                    b'f' => out.push('\u{000C}'),
                    b'u' => {
                        *pos += 1;
                        let unit = read_hex4(bytes, pos)?;
                        let code = if (0xD800..0xDC00).contains(&unit) {
                            // High surrogate: a low surrogate must follow.
                            if bytes.get(*pos) != Some(&b'\\') || bytes.get(*pos + 1) != Some(&b'u')
                            {
                                return None;
                            }
                            *pos += 2;
                            let low = read_hex4(bytes, pos)?;
                            if !(0xDC00..0xE000).contains(&low) {
                                return None;
                            }
                            0x10000 + ((unit as u32 - 0xD800) << 10) + (low as u32 - 0xDC00)
                        } else {
                            unit as u32
                        };
                        out.push(char::from_u32(code)?);
                        // `pos` already sits past the escape.
                        continue;
                    }
                    _ => return None,
                }
                *pos += 1;
            }
            _ => {
                // Copy one whole UTF-8 sequence so multi-byte text survives.
                let start = *pos;
                let len = utf8_len(bytes[*pos])?;
                *pos += len;
                out.push_str(std::str::from_utf8(bytes.get(start..*pos)?).ok()?);
            }
        }
    }
}

fn utf8_len(first: u8) -> Option<usize> {
    match first {
        0x00..=0x7F => Some(1),
        0xC2..=0xDF => Some(2),
        0xE0..=0xEF => Some(3),
        0xF0..=0xF4 => Some(4),
        _ => None,
    }
}

fn read_hex4(bytes: &[u8], pos: &mut usize) -> Option<u16> {
    let mut value = 0u16;
    for _ in 0..4 {
        let digit = (*bytes.get(*pos)? as char).to_digit(16)?;
        value = value.checked_mul(16)?.checked_add(digit as u16)?;
        *pos += 1;
    }
    Some(value)
}

fn parse_object(bytes: &[u8], pos: &mut usize, depth: usize) -> Option<Value> {
    *pos += 1; // '{'
    let mut map = BTreeMap::new();
    skip_ws(bytes, pos);
    if bytes.get(*pos) == Some(&b'}') {
        *pos += 1;
        return Some(Value::Obj(map));
    }
    loop {
        skip_ws(bytes, pos);
        let key = parse_string(bytes, pos)?;
        skip_ws(bytes, pos);
        if bytes.get(*pos) != Some(&b':') {
            return None;
        }
        *pos += 1;
        map.insert(key, parse_value(bytes, pos, depth + 1)?);
        skip_ws(bytes, pos);
        match *bytes.get(*pos)? {
            b',' => *pos += 1,
            b'}' => {
                *pos += 1;
                return Some(Value::Obj(map));
            }
            _ => return None,
        }
    }
}

fn parse_array(bytes: &[u8], pos: &mut usize, depth: usize) -> Option<Value> {
    *pos += 1; // '['
    let mut items = Vec::new();
    skip_ws(bytes, pos);
    if bytes.get(*pos) == Some(&b']') {
        *pos += 1;
        return Some(Value::Arr(items));
    }
    loop {
        items.push(parse_value(bytes, pos, depth + 1)?);
        skip_ws(bytes, pos);
        match *bytes.get(*pos)? {
            b',' => *pos += 1,
            b']' => {
                *pos += 1;
                return Some(Value::Arr(items));
            }
            _ => return None,
        }
    }
}

/// Quotes a string as a JSON string literal.
pub fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Renders a value as indented JSON, for the schema dump.
pub fn pretty(value: &Value) -> String {
    let mut out = String::new();
    write_pretty(value, 0, &mut out);
    out
}

fn write_pretty(value: &Value, indent: usize, out: &mut String) {
    let pad = "  ".repeat(indent);
    let inner_pad = "  ".repeat(indent + 1);
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Num(n) => {
            let _ = write!(out, "{n}");
        }
        Value::Str(s) => out.push_str(&quote(s)),
        Value::Arr(items) if items.is_empty() => out.push_str("[]"),
        Value::Arr(items) => {
            out.push_str("[\n");
            for (index, item) in items.iter().enumerate() {
                out.push_str(&inner_pad);
                write_pretty(item, indent + 1, out);
                if index + 1 < items.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            out.push_str(&pad);
            out.push(']');
        }
        Value::Obj(map) if map.is_empty() => out.push_str("{}"),
        Value::Obj(map) => {
            out.push_str("{\n");
            for (index, (key, item)) in map.iter().enumerate() {
                out.push_str(&inner_pad);
                out.push_str(&quote(key));
                out.push_str(": ");
                write_pretty(item, indent + 1, out);
                if index + 1 < map.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            out.push_str(&pad);
            out.push('}');
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_scalars_and_containers() {
        let doc = Value::parse(r#"{"a": 1, "b": [true, null, "x"], "c": {"d": -2.5e1}}"#).unwrap();
        assert_eq!(doc.path("a").unwrap().as_f64(), Some(1.0));
        assert_eq!(doc.path("b.0").unwrap(), &Value::Bool(true));
        assert_eq!(doc.path("b.2").unwrap().as_str(), Some("x"));
        assert_eq!(doc.path("c.d").unwrap().as_f64(), Some(-25.0));
        assert_eq!(doc.path("c.missing"), None);
    }

    #[test]
    fn parses_escapes_and_multibyte_text() {
        let doc = Value::parse(r#"{"k": "😀 \"q\"\n마법사"}"#).unwrap();
        assert_eq!(doc.get("k").unwrap().as_str(), Some("😀 \"q\"\n마법사"));
        let raw = Value::parse("\"직접 넣은 한글\"").unwrap();
        assert_eq!(raw.as_str(), Some("직접 넣은 한글"));
    }

    #[test]
    fn rejects_malformed_and_trailing_input() {
        assert_eq!(Value::parse("{\"a\": 1,}"), None);
        assert_eq!(Value::parse("{\"a\": 1} trailing"), None);
        assert_eq!(Value::parse("[1, 2"), None);
        assert_eq!(Value::parse(&"[".repeat(500)), None);
    }

    #[test]
    fn reads_numeric_strings_as_numbers() {
        let doc = Value::parse(r#"{"wins": "12"}"#).unwrap();
        assert_eq!(doc.get("wins").unwrap().as_usize(), Some(12));
    }

    #[test]
    fn pretty_round_trips() {
        let doc = Value::parse(r#"{"b":[1,{"c":"한"}],"a":null}"#).unwrap();
        assert_eq!(Value::parse(&pretty(&doc)).unwrap(), doc);
    }
}
