use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::SystemTime,
};

#[derive(Debug, Deserialize)]
struct SubjectConfig {
    nome: Option<String>,
    cor: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubjectSummary {
    id: String,
    slug: String,
    display_name: String,
    color: String,
    lesson_count: usize,
    activity_count: usize,
    has_context: bool,
    has_plan: bool,
    updated_at_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubjectDetail {
    id: String,
    slug: String,
    display_name: String,
    color: String,
    has_context: bool,
    has_plan: bool,
    lessons: Vec<ContentItem>,
    activities: Vec<ContentItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentItem {
    file: String,
    relative_path: String,
    title: String,
    status: String,
    updated_at_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EditableContentFile {
    file: String,
    relative_path: String,
    title: String,
    content: String,
    updated_at_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveContentResult {
    updated_at_ms: Option<u64>,
}

#[tauri::command]
fn list_subjects(workspace_path: String) -> Result<Vec<SubjectSummary>, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let entries = fs::read_dir(&root)
        .map_err(|error| format!("Nao foi possivel ler o workspace {:?}: {}", root, error))?;

    let mut subjects = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| subject_summary_from_dir(entry.path()))
        .collect::<Vec<_>>();

    subjects.sort_by(|left, right| left.display_name.cmp(&right.display_name));

    Ok(subjects)
}

#[tauri::command]
fn get_subject_detail(workspace_path: String, subject_slug: String) -> Result<SubjectDetail, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let config = read_subject_config(&subject_path);
    let display_name = config
        .as_ref()
        .and_then(|cfg| cfg.nome.as_ref())
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| humanize_slug(&subject_slug));

    let color = config
        .as_ref()
        .and_then(|cfg| cfg.cor.as_ref())
        .filter(|value| is_hex_color(value))
        .cloned()
        .unwrap_or_else(|| fallback_color(&subject_slug));

    Ok(SubjectDetail {
        id: subject_slug.clone(),
        slug: subject_slug,
        display_name,
        color,
        has_context: subject_path.join("contexto.md").is_file(),
        has_plan: subject_path.join("plano_geral.md").is_file(),
        lessons: list_content_items(&subject_path, "aulas", Some(("slides", "pptx"))),
        activities: list_content_items(&subject_path, "atividades", Some(("atividades/pdfs", "pdf"))),
    })
}

#[tauri::command]
fn read_content_file(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<EditableContentFile, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;

    if !content_path.is_file() {
        return Err(format!("Arquivo nao encontrado: {}", relative_path));
    }

    let content = fs::read_to_string(&content_path)
        .map_err(|error| format!("Nao foi possivel abrir {}: {}", relative_path, error))?;
    let file = content_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    let title = display_title(&content, &humanize_slug(&file_stem(&file)));

    Ok(EditableContentFile {
        file,
        relative_path,
        title,
        content,
        updated_at_ms: fs::metadata(&content_path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_ms),
    })
}

#[tauri::command]
fn save_content_file(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
    content: String,
) -> Result<SaveContentResult, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;

    if !content_path.is_file() {
        return Err(format!("Arquivo nao encontrado: {}", relative_path));
    }

    fs::write(&content_path, content)
        .map_err(|error| format!("Nao foi possivel salvar {}: {}", relative_path, error))?;

    Ok(SaveContentResult {
        updated_at_ms: fs::metadata(&content_path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_ms),
    })
}

fn subject_summary_from_dir(path: PathBuf) -> Option<SubjectSummary> {
    if !is_subject_directory(&path) {
        return None;
    }

    let slug = path.file_name()?.to_string_lossy().to_string();
    let config = read_subject_config(&path);
    let display_name = config
        .as_ref()
        .and_then(|cfg| cfg.nome.as_ref())
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| humanize_slug(&slug));

    let color = config
        .as_ref()
        .and_then(|cfg| cfg.cor.as_ref())
        .filter(|value| is_hex_color(value))
        .cloned()
        .unwrap_or_else(|| fallback_color(&slug));

    let lesson_count = count_markdown_files(&path.join("aulas"));
    let activity_count = count_markdown_files(&path.join("atividades"));
    let has_context = path.join("contexto.md").is_file();
    let has_plan = path.join("plano_geral.md").is_file();

    Some(SubjectSummary {
        id: slug.clone(),
        slug,
        display_name,
        color,
        lesson_count,
        activity_count,
        has_context,
        has_plan,
        updated_at_ms: latest_timestamp_ms(&path),
    })
}

fn list_content_items(
    subject_path: &Path,
    folder_name: &str,
    output_rule: Option<(&str, &str)>,
) -> Vec<ContentItem> {
    let content_dir = subject_path.join(folder_name);
    let mut items = fs::read_dir(&content_dir)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter(|entry| entry.path().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("md"))
        })
        .filter_map(|entry| {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path();
            let content = fs::read_to_string(&file_path).ok()?;
            let title = display_title(&content, &humanize_slug(&file_stem(&file_name)));

            let status = output_rule
                .map(|(output_folder, output_extension)| {
                    let output_path = subject_path
                        .join(output_folder)
                        .join(format!("{}.{}", file_stem(&file_name), output_extension));
                    file_status(&file_path, &output_path)
                })
                .unwrap_or_else(|| "none".to_string());

            Some(ContentItem {
                file: file_name.clone(),
                relative_path: format!("{}/{}", folder_name, file_name),
                title,
                status,
                updated_at_ms: fs::metadata(&file_path)
                    .ok()
                    .and_then(|metadata| metadata.modified().ok())
                    .and_then(system_time_to_ms),
            })
        })
        .collect::<Vec<_>>();

    items.sort_by(|left, right| left.file.cmp(&right.file));
    items
}

fn file_status(source_path: &Path, output_path: &Path) -> String {
    if !output_path.is_file() {
        return "none".to_string();
    }

    let source_mtime = fs::metadata(source_path)
        .ok()
        .and_then(|metadata| metadata.modified().ok());
    let output_mtime = fs::metadata(output_path)
        .ok()
        .and_then(|metadata| metadata.modified().ok());

    match (source_mtime, output_mtime) {
        (Some(source), Some(output)) if source > output => "outdated".to_string(),
        (Some(_), Some(_)) => "ok".to_string(),
        _ => "none".to_string(),
    }
}

fn display_title(content: &str, fallback: &str) -> String {
    extract_frontmatter(content, "title")
        .or_else(|| extract_first_heading(content))
        .unwrap_or_else(|| fallback.to_string())
}

fn extract_frontmatter(content: &str, key: &str) -> Option<String> {
    let frontmatter = content.strip_prefix("---")?;
    let closing = frontmatter.find("\n---")?;
    let block = &frontmatter[..closing];

    block.lines().find_map(|line| {
        let trimmed = line.trim();
        let prefix = format!("{}:", key);
        trimmed.strip_prefix(&prefix).map(|value| {
            value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string()
        })
    })
}

fn extract_first_heading(content: &str) -> Option<String> {
    strip_frontmatter(content).lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") || trimmed.starts_with("## ") {
            Some(trimmed.trim_start_matches('#').trim().to_string())
        } else {
            None
        }
    })
}

fn strip_frontmatter(content: &str) -> &str {
    if let Some(frontmatter) = content.strip_prefix("---") {
        if let Some(closing) = frontmatter.find("\n---") {
            let index = closing + "\n---".len();
            return frontmatter.get(index..).unwrap_or_default();
        }
    }

    content
}

fn file_stem(file_name: &str) -> String {
    Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name)
        .to_string()
}

fn is_subject_directory(path: &Path) -> bool {
    if path
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.starts_with('.'))
    {
        return false;
    }

    path.join(".conf").is_file()
        || path.join("contexto.md").is_file()
        || path.join("plano_geral.md").is_file()
        || path.join("aulas").is_dir()
}

fn read_subject_config(path: &Path) -> Option<SubjectConfig> {
    let content = fs::read_to_string(path.join(".conf")).ok()?;
    serde_json::from_str(&content).ok()
}

fn count_markdown_files(path: &Path) -> usize {
    fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter(|entry| entry.path().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("md"))
        })
        .count()
}

fn latest_timestamp_ms(path: &Path) -> Option<u64> {
    let candidates = [
        path.join(".conf"),
        path.join("contexto.md"),
        path.join("plano_geral.md"),
        path.join("aulas"),
        path.join("atividades"),
    ];

    candidates
        .iter()
        .filter_map(|candidate| fs::metadata(candidate).ok())
        .filter_map(|metadata| metadata.modified().ok())
        .filter_map(system_time_to_ms)
        .max()
}

fn system_time_to_ms(value: SystemTime) -> Option<u64> {
    value
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn humanize_slug(slug: &str) -> String {
    slug.split('_')
        .filter(|part| !part.is_empty())
        .map(capitalize)
        .collect::<Vec<_>>()
        .join(" ")
}

fn capitalize(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => String::new(),
    }
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.chars().skip(1).all(|char| char.is_ascii_hexdigit())
}

fn fallback_color(slug: &str) -> String {
    const PALETTE: [&str; 6] = ["#FFB938", "#22C55E", "#F97316", "#06B6D4", "#EAB308", "#A855F7"];

    let index = slug.bytes().fold(0usize, |acc, byte| acc + byte as usize) % PALETTE.len();
    PALETTE[index].to_string()
}

fn resolve_workspace_root(workspace_path: &str) -> Result<PathBuf, String> {
    let trimmed = workspace_path.trim();
    if trimmed.is_empty() {
        return Err("Nenhum workspace foi selecionado.".to_string());
    }

    let path = PathBuf::from(trimmed);
    if !path.is_dir() {
        return Err(format!("O caminho selecionado nao existe ou nao e uma pasta: {}", trimmed));
    }

    Ok(path)
}

fn resolve_subject_path(workspace_path: &str, subject_slug: &str) -> Result<PathBuf, String> {
    let root = resolve_workspace_root(workspace_path)?;
    let subject_path = root.join(subject_slug);

    if !subject_path.is_dir() || !is_subject_directory(&subject_path) {
        return Err(format!("Disciplina nao encontrada: {}", subject_slug));
    }

    Ok(subject_path)
}

fn resolve_content_path(subject_path: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("Nenhum arquivo foi selecionado.".to_string());
    }

    let relative = Path::new(trimmed);
    if relative.components().any(|component| !matches!(component, Component::Normal(_))) {
        return Err(format!("Caminho invalido: {}", relative_path));
    }

    if !relative
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("md"))
    {
        return Err(format!("Somente arquivos Markdown podem ser editados: {}", relative_path));
    }

    Ok(subject_path.join(relative))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_subjects,
            get_subject_detail,
            read_content_file,
            save_content_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
