use std::collections::HashMap;
use std::io::{self, Read, Seek};

use thiserror::Error;
use zip::{result::ZipError, ZipArchive};

#[derive(Debug, Error, PartialEq, Eq)]
pub enum FwmParseError {
    #[error("invalid line {line}: missing '=' separator")]
    InvalidLine { line: usize },
    #[error("duplicate key encountered: {0}")]
    DuplicateKey(String),
}

pub fn parse_fwm(input: &str) -> Result<HashMap<String, String>, FwmParseError> {
    let mut entries = HashMap::new();
    for (index, raw_line) in input.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(FwmParseError::InvalidLine { line: index + 1 });
        };
        let normalized_key = key.trim().to_ascii_uppercase();
        if entries.contains_key(&normalized_key) {
            return Err(FwmParseError::DuplicateKey(normalized_key));
        }
        entries.insert(normalized_key, value.trim().to_string());
    }
    Ok(entries)
}

#[derive(Debug, Error)]
pub enum FwzValidationError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Zip(#[from] ZipError),
    #[error("archive entry path is unsafe: {0}")]
    PathTraversal(String),
}

pub fn validate_fwz_archive<R: Read + Seek>(reader: R) -> Result<Vec<String>, FwzValidationError> {
    let mut archive = ZipArchive::new(reader)?;
    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let file = archive.by_index(i)?;
        let name = file.name().to_string();
        if name.starts_with('/')
            || name.contains("..")
            || name.contains('\0')
            || name.contains(':')
            || name.contains('\r')
        {
            return Err(FwzValidationError::PathTraversal(name));
        }
        entries.push(name);
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::collection::hash_map;
    use proptest::prelude::*;
    use std::io::{Cursor, Write};
    use zip::write::FileOptions;

    fn write_archive(entries: &[(String, Vec<u8>)]) -> Cursor<Vec<u8>> {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut writer = zip::ZipWriter::new(&mut buffer);
            let options = FileOptions::default();
            for (name, data) in entries {
                writer.start_file(name, options).unwrap();
                writer.write_all(data).unwrap();
            }
            writer.finish().unwrap();
        }
        buffer.set_position(0);
        buffer
    }

    proptest! {
        #[test]
        fn parse_fwm_round_trip(map in hash_map(
            "[A-Z]{1,8}",
            "[A-Za-z0-9 _-]{1,32}",
            1..16
        )) {
            let mut serialized = String::new();
            for (key, value) in &map {
                serialized.push_str(key);
                serialized.push('=');
                serialized.push_str(value);
                serialized.push('\n');
            }
            let parsed = parse_fwm(&serialized).unwrap();
            for (key, value) in map {
                prop_assert_eq!(parsed.get(&key), Some(&value.trim().to_string()));
            }
        }
    }

    proptest! {
        #[test]
        fn validate_fwz_accepts_safe_names(name in "[A-Za-z0-9/_-]{1,24}") {
            prop_assume!(!name.contains(".."));
            prop_assume!(!name.starts_with('/'));
            let buffer = write_archive(&[(name.clone(), vec![0u8; 4])]);
            let paths = validate_fwz_archive(buffer).unwrap();
            prop_assert!(paths.contains(&name));
        }
    }

    #[test]
    fn parse_fwm_rejects_duplicates() {
        let data = "KEY=value\nKEY=other";
        let err = parse_fwm(data).unwrap_err();
        assert!(matches!(err, FwmParseError::DuplicateKey(_)));
    }

    #[test]
    fn validate_fwz_rejects_traversal() {
        let buffer = write_archive(&[("../evil".into(), vec![1,2,3])]);
        let err = validate_fwz_archive(buffer).unwrap_err();
        match err {
            FwzValidationError::PathTraversal(name) => assert_eq!(name, "../evil"),
            _ => panic!("unexpected error"),
        }
    }
}
