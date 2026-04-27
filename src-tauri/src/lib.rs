use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
    time::SystemTime,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentFileSnapshot {
    content: String,
    updated_at_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateTemplateSubjectResult {
    slug: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateSubjectResult {
    slug: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateContentItemResult {
    relative_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetSettingsState {
    app_data_dir: String,
    fallback_dir: Option<String>,
    logo_path: Option<String>,
    logo_source: String,
    background_path: Option<String>,
    background_source: String,
    color_theme_id: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssetSettingsFile {
    logo_file_name: Option<String>,
    background_file_name: Option<String>,
    color_theme_id: Option<String>,
}

#[derive(Debug, Clone)]
struct ResolvedAssetSettings {
    logo_path: Option<PathBuf>,
    logo_source: &'static str,
    background_path: Option<PathBuf>,
    background_source: &'static str,
    app_data_dir: PathBuf,
    fallback_dir: Option<PathBuf>,
    color_theme: &'static ColorThemePreset,
}

#[derive(Debug)]
struct ColorThemePreset {
    id: &'static str,
    name: &'static str,
    title_dark: &'static str,
    title_mid: &'static str,
    line: &'static str,
    activity_title: &'static str,
    activity_subtitle: &'static str,
    activity_rule: &'static str,
    activity_label: &'static str,
    activity_box_border: &'static str,
    activity_box_bg: &'static str,
    activity_table_bg: &'static str,
    activity_tip_bg: &'static str,
}

const COLOR_THEME_PRESETS: [ColorThemePreset; 10] = [
    ColorThemePreset { id: "azul", name: "Azul", title_dark: "#1a5fa8", title_mid: "#3a7fc1", line: "#3a7fc1", activity_title: "#1f5fb8", activity_subtitle: "#334155", activity_rule: "#2f6fcb", activity_label: "#2f6fcb", activity_box_border: "#d4deed", activity_box_bg: "#f6f9ff", activity_table_bg: "#f3f7fd", activity_tip_bg: "#eaf2ff" },
    ColorThemePreset { id: "preto", name: "Preto", title_dark: "#111111", title_mid: "#4a4a4a", line: "#1f2937", activity_title: "#111111", activity_subtitle: "#374151", activity_rule: "#1f2937", activity_label: "#111111", activity_box_border: "#d1d5db", activity_box_bg: "#f8fafc", activity_table_bg: "#f3f4f6", activity_tip_bg: "#f3f4f6" },
    ColorThemePreset { id: "vermelho", name: "Vermelho", title_dark: "#b42318", title_mid: "#e11d48", line: "#ef4444", activity_title: "#b42318", activity_subtitle: "#4b5563", activity_rule: "#ef4444", activity_label: "#b42318", activity_box_border: "#fecdd3", activity_box_bg: "#fff1f2", activity_table_bg: "#fff1f2", activity_tip_bg: "#ffe4e6" },
    ColorThemePreset { id: "verde", name: "Verde", title_dark: "#166534", title_mid: "#16a34a", line: "#22c55e", activity_title: "#166534", activity_subtitle: "#3f3f46", activity_rule: "#22c55e", activity_label: "#166534", activity_box_border: "#bbf7d0", activity_box_bg: "#f0fdf4", activity_table_bg: "#f0fdf4", activity_tip_bg: "#dcfce7" },
    ColorThemePreset { id: "roxo", name: "Roxo", title_dark: "#6d28d9", title_mid: "#8b5cf6", line: "#a78bfa", activity_title: "#6d28d9", activity_subtitle: "#475569", activity_rule: "#8b5cf6", activity_label: "#6d28d9", activity_box_border: "#ddd6fe", activity_box_bg: "#f5f3ff", activity_table_bg: "#f5f3ff", activity_tip_bg: "#ede9fe" },
    ColorThemePreset { id: "laranja", name: "Laranja", title_dark: "#c2410c", title_mid: "#f97316", line: "#fb923c", activity_title: "#c2410c", activity_subtitle: "#44403c", activity_rule: "#f97316", activity_label: "#c2410c", activity_box_border: "#fed7aa", activity_box_bg: "#fff7ed", activity_table_bg: "#fff7ed", activity_tip_bg: "#ffedd5" },
    ColorThemePreset { id: "bege", name: "Bege", title_dark: "#92400e", title_mid: "#b45309", line: "#d97706", activity_title: "#92400e", activity_subtitle: "#57534e", activity_rule: "#d97706", activity_label: "#92400e", activity_box_border: "#e7d7bf", activity_box_bg: "#faf6ee", activity_table_bg: "#faf6ee", activity_tip_bg: "#f5ead7" },
    ColorThemePreset { id: "teal", name: "Teal", title_dark: "#0f766e", title_mid: "#14b8a6", line: "#2dd4bf", activity_title: "#0f766e", activity_subtitle: "#334155", activity_rule: "#14b8a6", activity_label: "#0f766e", activity_box_border: "#99f6e4", activity_box_bg: "#f0fdfa", activity_table_bg: "#f0fdfa", activity_tip_bg: "#ccfbf1" },
    ColorThemePreset { id: "rosa", name: "Rosa", title_dark: "#be185d", title_mid: "#ec4899", line: "#f472b6", activity_title: "#be185d", activity_subtitle: "#475569", activity_rule: "#ec4899", activity_label: "#be185d", activity_box_border: "#fbcfe8", activity_box_bg: "#fdf2f8", activity_table_bg: "#fdf2f8", activity_tip_bg: "#fce7f3" },
    ColorThemePreset { id: "cinza", name: "Cinza", title_dark: "#334155", title_mid: "#64748b", line: "#94a3b8", activity_title: "#334155", activity_subtitle: "#475569", activity_rule: "#64748b", activity_label: "#334155", activity_box_border: "#cbd5e1", activity_box_bg: "#f8fafc", activity_table_bg: "#f8fafc", activity_tip_bg: "#eef2f7" },
];

#[tauri::command]
fn list_subjects(workspace_path: String) -> Result<Vec<SubjectSummary>, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let entries = fs::read_dir(&root)
        .map_err(|error| format!("Não foi possível ler o workspace {:?}: {}", root, error))?;

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
        return Err(format!("Arquivo não encontrado: {}", relative_path));
    }

    let content = fs::read_to_string(&content_path)
        .map_err(|error| format!("Não foi possível abrir {}: {}", relative_path, error))?;
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
        return Err(format!("Arquivo não encontrado: {}", relative_path));
    }

    fs::write(&content_path, content)
        .map_err(|error| format!("Não foi possível salvar {}: {}", relative_path, error))?;

    Ok(SaveContentResult {
        updated_at_ms: fs::metadata(&content_path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_ms),
    })
}

#[tauri::command]
fn get_content_file_snapshot(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<ContentFileSnapshot, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;

    if !content_path.is_file() {
        return Err(format!("Arquivo não encontrado: {}", relative_path));
    }

    let content = fs::read_to_string(&content_path)
        .map_err(|error| format!("Não foi possível ler {}: {}", relative_path, error))?;

    Ok(ContentFileSnapshot {
        content,
        updated_at_ms: fs::metadata(&content_path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_ms),
    })
}

#[tauri::command]
fn delete_subject(workspace_path: String, subject_slug: String) -> Result<(), String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;

    fs::remove_dir_all(&subject_path)
        .map_err(|error| format!("Não foi possível excluir a disciplina: {}", error))?;

    Ok(())
}

#[tauri::command]
fn delete_content_item(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<(), String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;

    if !content_path.is_file() {
        return Err(format!("Arquivo não encontrado: {}", relative_path));
    }

    fs::remove_file(&content_path)
        .map_err(|error| format!("Não foi possível excluir o arquivo: {}", error))?;

    Ok(())
}

#[tauri::command]
fn generate_content_output(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<(), String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let tool_root = resolve_generation_tool_root(&root)?;
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;
    let file_name = content_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Nome de arquivo inválido.".to_string())?;

    if relative_path.starts_with("aulas/") {
        generate_lesson_output(&tool_root, &content_path, file_name)?;
        return Ok(());
    }

    if relative_path.starts_with("atividades/") {
        generate_activity_output(&tool_root, &subject_path, &content_path, file_name)?;
        return Ok(());
    }

    Err("Esse tipo de arquivo não possui geração configurada.".to_string())
}

#[tauri::command]
fn open_content_output_folder(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<(), String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let output_dir = output_dir_for_relative_path(&subject_path, &relative_path)
        .ok_or_else(|| "Esse tipo de arquivo não possui pasta de saída.".to_string())?;

    if !output_dir.is_dir() {
        return Err("A pasta de saída ainda não existe para este arquivo.".to_string());
    }

    Command::new("explorer")
        .arg(&output_dir)
        .spawn()
        .map_err(|error| format!("Não foi possível abrir a pasta de saída: {}", error))?;

    Ok(())
}

#[tauri::command]
fn create_template_subject(
    workspace_path: String,
) -> Result<CreateTemplateSubjectResult, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let slug = next_available_subject_slug(&root, "disciplina_modelo");
    let subject_path = root.join(&slug);
    let lesson_path = subject_path.join("aulas").join("aula_01_visao_geral_studio.md");
    let activity_path = subject_path
        .join("atividades")
        .join("atividade_01_mapeamento_de_fluxo.md");
    let models_dir = subject_path.join("modelos");
    let references_dir = subject_path.join("referencias");
    let assets_dir = subject_path.join("assets");

    fs::create_dir_all(subject_path.join("aulas"))
        .and_then(|_| fs::create_dir_all(subject_path.join("atividades")))
        .and_then(|_| fs::create_dir_all(&models_dir))
        .and_then(|_| fs::create_dir_all(&references_dir))
        .and_then(|_| fs::create_dir_all(&assets_dir))
        .map_err(|error| format!("Não foi possível criar a disciplina modelo: {}", error))?;

    fs::write(
        subject_path.join(".conf"),
        r##"{"nome":"Disciplina Modelo","cor":"#F97316"}"##,
    )
    .map_err(|error| format!("Não foi possível criar .conf: {}", error))?;

    fs::write(subject_path.join("contexto.md"), template_context())
        .map_err(|error| format!("Não foi possível criar contexto.md: {}", error))?;
    fs::write(subject_path.join("plano_geral.md"), template_plan())
        .map_err(|error| format!("Não foi possível criar plano_geral.md: {}", error))?;
    fs::write(&lesson_path, template_lesson())
        .map_err(|error| format!("Não foi possível criar aula modelo: {}", error))?;
    fs::write(&activity_path, template_activity())
        .map_err(|error| format!("Não foi possível criar atividade modelo: {}", error))?;
    fs::write(models_dir.join("modelo_aula_marp.md"), template_lesson_model())
        .map_err(|error| format!("Não foi possível criar modelo_aula_marp.md: {}", error))?;
    fs::write(models_dir.join("modelo_plano_geral.md"), template_plan_model())
        .map_err(|error| format!("Não foi possível criar modelo_plano_geral.md: {}", error))?;
    fs::write(references_dir.join("notas.md"), template_notes())
        .map_err(|error| format!("Não foi possível criar notas.md: {}", error))?;
    fs::write(assets_dir.join("exemplo_fluxo.svg"), template_flow_svg())
        .map_err(|error| format!("Não foi possível criar exemplo_fluxo.svg: {}", error))?;
    fs::write(assets_dir.join("exemplo_interface.svg"), template_ui_svg())
        .map_err(|error| format!("Não foi possível criar exemplo_interface.svg: {}", error))?;

    Ok(CreateTemplateSubjectResult { slug })
}

#[tauri::command]
fn create_subject(
    workspace_path: String,
    name: String,
    color: String,
) -> Result<CreateSubjectResult, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome da disciplina.".to_string());
    }

    if !is_hex_color(&color) {
        return Err("Selecione uma cor valida.".to_string());
    }

    let base_slug = to_snake_case(trimmed_name);
    if base_slug.is_empty() {
        return Err("Não foi possível gerar um nome de pasta válido para a disciplina.".to_string());
    }

    let slug = next_available_subject_slug(&root, &base_slug);
    let subject_path = root.join(&slug);

    fs::create_dir_all(subject_path.join("aulas"))
        .and_then(|_| fs::create_dir_all(subject_path.join("atividades")))
        .and_then(|_| fs::create_dir_all(subject_path.join("modelos")))
        .and_then(|_| fs::create_dir_all(subject_path.join("referencias")))
        .map_err(|error| format!("Não foi possível criar a disciplina: {}", error))?;

    fs::write(
        subject_path.join(".conf"),
        format!(r##"{{"nome":"{}","cor":"{}"}}"##, escape_json(trimmed_name), color),
    )
    .map_err(|error| format!("Não foi possível criar .conf: {}", error))?;

    fs::write(subject_path.join("contexto.md"), empty_context_template(trimmed_name))
        .map_err(|error| format!("Não foi possível criar contexto.md: {}", error))?;
    fs::write(subject_path.join("plano_geral.md"), empty_plan_template(trimmed_name))
        .map_err(|error| format!("Não foi possível criar plano_geral.md: {}", error))?;

    Ok(CreateSubjectResult { slug })
}

#[tauri::command]
fn update_subject(
    workspace_path: String,
    subject_slug: String,
    name: String,
    color: String,
) -> Result<(), String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Informe o nome da disciplina.".to_string());
    }

    if !is_hex_color(&color) {
        return Err("Selecione uma cor válida.".to_string());
    }

    fs::write(
        subject_path.join(".conf"),
        format!(
            r##"{{"nome":"{}","cor":"{}"}}"##,
            escape_json(trimmed_name),
            color
        ),
    )
    .map_err(|error| format!("Não foi possível atualizar a disciplina: {}", error))?;

    Ok(())
}

#[tauri::command]
fn create_lesson(
    workspace_path: String,
    subject_slug: String,
    theme: String,
) -> Result<CreateContentItemResult, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let trimmed_theme = theme.trim();
    if trimmed_theme.is_empty() {
        return Err("Informe o tema da aula.".to_string());
    }

    let next_number = next_content_number(&subject_path.join("aulas"), "aula_");
    let theme_slug = {
        let slug = to_snake_case(trimmed_theme);
        if slug.is_empty() { "tema".to_string() } else { slug }
    };
    let file_name = format!("aula_{:02}_{}.md", next_number, theme_slug);
    let relative_path = format!("aulas/{}", file_name);

    fs::write(
        subject_path.join(&relative_path),
        template_lesson_draft(next_number, trimmed_theme),
    )
        .map_err(|error| format!("Não foi possível criar a aula: {}", error))?;

    Ok(CreateContentItemResult { relative_path })
}

#[tauri::command]
fn create_activity(
    workspace_path: String,
    subject_slug: String,
    theme: String,
) -> Result<CreateContentItemResult, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let trimmed_theme = theme.trim();
    if trimmed_theme.is_empty() {
        return Err("Informe o tema da atividade.".to_string());
    }

    let next_number = next_content_number(&subject_path.join("atividades"), "atividade_");
    let theme_slug = {
        let slug = to_snake_case(trimmed_theme);
        if slug.is_empty() { "tema".to_string() } else { slug }
    };
    let file_name = format!("atividade_{:02}_{}.md", next_number, theme_slug);
    let relative_path = format!("atividades/{}", file_name);

    fs::write(
        subject_path.join(&relative_path),
        template_activity_draft(next_number, trimmed_theme),
    )
        .map_err(|error| format!("Não foi possível criar a atividade: {}", error))?;

    Ok(CreateContentItemResult { relative_path })
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

fn to_snake_case(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_separator = false;

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            last_was_separator = false;
        } else if !last_was_separator {
            slug.push('_');
            last_was_separator = true;
        }
    }

    slug.trim_matches('_').to_string()
}

fn escape_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
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
        return Err(format!("O caminho selecionado não existe ou não é uma pasta: {}", trimmed));
    }

    Ok(path)
}

fn resolve_subject_path(workspace_path: &str, subject_slug: &str) -> Result<PathBuf, String> {
    let root = resolve_workspace_root(workspace_path)?;
    let subject_path = root.join(subject_slug);

    if !subject_path.is_dir() || !is_subject_directory(&subject_path) {
        return Err(format!("Disciplina não encontrada: {}", subject_slug));
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
        return Err(format!("Caminho inválido: {}", relative_path));
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

fn output_dir_for_relative_path(subject_path: &Path, relative_path: &str) -> Option<PathBuf> {
    if relative_path.starts_with("aulas/") {
        return Some(subject_path.join("slides"));
    }

    if relative_path.starts_with("atividades/") {
        return Some(subject_path.join("atividades").join("pdfs"));
    }

    None
}

fn resolve_generation_tool_root(workspace_root: &Path) -> Result<PathBuf, String> {
    let mut candidates = vec![workspace_root.to_path_buf()];

    if let Some(parent) = workspace_root.parent() {
        candidates.push(parent.to_path_buf());
        candidates.push(parent.join("Senai"));
        candidates.push(parent.join("senai"));
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.clone());
        if let Some(parent) = current_dir.parent() {
            candidates.push(parent.to_path_buf());
            candidates.push(parent.join("Senai"));
            candidates.push(parent.join("senai"));
        }
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.to_path_buf());
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.to_path_buf());
            }
        }
    }

    for candidate in candidates {
        let marp = candidate.join("node_modules").join(".bin").join("marp.cmd");
        let markdown_it = candidate.join("node_modules").join("markdown-it");

        if marp.is_file() && markdown_it.exists() {
            return Ok(candidate);
        }
    }

    Err("Não encontrei as ferramentas de geração. Esperava encontrar node_modules com Marp e markdown-it no projeto base do SENAI.".to_string())
}

fn generate_lesson_output(
    root: &Path,
    content_path: &Path,
    file_name: &str,
) -> Result<(), String> {
    let marp_bin = root.join("node_modules").join(".bin").join("marp.cmd");
    if !marp_bin.is_file() {
        return Err("Marp CLI não encontrado em node_modules/.bin/marp.cmd.".to_string());
    }

    let subject_path = content_path
        .parent()
        .and_then(|path| path.parent())
        .ok_or_else(|| "Não foi possível localizar a disciplina da aula.".to_string())?;
    let output_dir = subject_path.join("slides");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Não foi possível criar a pasta de slides: {}", error))?;

    let output_file = output_dir.join(format!("{}.pptx", file_stem(file_name)));
    let content = fs::read_to_string(content_path)
        .map_err(|error| format!("Não foi possível ler a aula para gerar o slide: {}", error))?;
    let resolved_assets = resolve_asset_settings()?;
    let prepared_content = prepare_lesson_markdown_for_render(&content, &resolved_assets)?;
    let temp_input = std::env::temp_dir().join(format!(
        "lumen_generate_{}_{}.md",
        file_stem(file_name),
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    fs::write(&temp_input, prepared_content)
        .map_err(|error| format!("Não foi possível preparar a aula para exportação: {}", error))?;

    let marp_bin_string = marp_bin.to_string_lossy().to_string();
    let output_file_string = output_file.to_string_lossy().to_string();
    let content_path_string = temp_input.to_string_lossy().to_string();

    let status = Command::new("cmd")
        .args([
            "/C",
            marp_bin_string.as_str(),
            "--pptx",
            "--allow-local-files",
            "--output",
            output_file_string.as_str(),
            content_path_string.as_str(),
        ])
        .status()
        .map_err(|error| format!("Não foi possível executar o Marp CLI: {}", error))?;

    let _ = fs::remove_file(&temp_input);

    if !status.success() || !output_file.is_file() {
        return Err("Falha ao gerar o slide. Verifique se o Marp CLI está instalado corretamente.".to_string());
    }

    Ok(())
}

fn generate_activity_output(
    root: &Path,
    subject_path: &Path,
    content_path: &Path,
    file_name: &str,
) -> Result<(), String> {
    let markdown_it_module = root.join("node_modules").join("markdown-it");
    if !markdown_it_module.exists() {
        return Err("markdown-it não encontrado em node_modules.".to_string());
    }

    let browser_path = detect_browser_path()
        .ok_or_else(|| "Nenhum Chrome ou Edge local foi encontrado para gerar PDF.".to_string())?;
    let output_dir = subject_path.join("atividades").join("pdfs");
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Não foi possível criar a pasta de PDFs: {}", error))?;

    let output_file = output_dir.join(format!("{}.pdf", file_stem(file_name)));
    let temp_html = output_dir.join(format!("._tmp_{}.html", file_stem(file_name)));
    let title = file_stem(file_name);
    let resolved_assets = resolve_asset_settings()?;
    let logo_path = resolved_assets
        .logo_path
        .as_ref()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let theme_id = resolved_assets.color_theme.id.to_string();
    let markdown_it_string = markdown_it_module.to_string_lossy().to_string();
    let content_path_string = content_path.to_string_lossy().to_string();
    let temp_html_string = temp_html.to_string_lossy().to_string();
    let print_arg = format!("--print-to-pdf={}", output_file.to_string_lossy());

    let render_status = Command::new("node")
        .arg("-e")
        .arg(ACTIVITY_HTML_RENDER_SCRIPT)
        .arg(markdown_it_string.as_str())
        .arg(content_path_string.as_str())
        .arg(temp_html_string.as_str())
        .arg(title.as_str())
        .arg(logo_path.as_str())
        .arg(theme_id.as_str())
        .status()
        .map_err(|error| format!("Não foi possível preparar o HTML da atividade: {}", error))?;

    if !render_status.success() || !temp_html.is_file() {
        return Err("Falha ao preparar o HTML da atividade para exportação.".to_string());
    }

    let file_url = format!("file:///{}", temp_html.to_string_lossy().replace('\\', "/"));
    let pdf_status = Command::new(browser_path)
        .args([
            "--headless",
            "--disable-gpu",
            print_arg.as_str(),
            file_url.as_str(),
        ])
        .status()
        .map_err(|error| format!("Não foi possível gerar o PDF da atividade: {}", error))?;

    let _ = fs::remove_file(&temp_html);

    if !pdf_status.success() || !output_file.is_file() {
        return Err("Falha ao gerar o PDF da atividade.".to_string());
    }

    Ok(())
}

fn detect_browser_path() -> Option<PathBuf> {
    let candidates = [
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];

    candidates
        .iter()
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

fn local_app_assets_dir() -> Result<PathBuf, String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| "Não foi possível localizar o AppData local deste usuário.".to_string())?;
    Ok(PathBuf::from(local_app_data).join("lumen_studio").join("assets"))
}

fn program_files_assets_dir() -> Option<PathBuf> {
    std::env::var_os("ProgramFiles")
        .map(PathBuf::from)
        .map(|path| path.join("lumen_studio").join("assets"))
}

fn asset_settings_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.parent().unwrap_or(app_data_dir).join("settings.json")
}

fn read_asset_settings_file(app_data_dir: &Path) -> AssetSettingsFile {
    let file_path = asset_settings_file_path(app_data_dir);
    fs::read_to_string(file_path)
        .ok()
        .and_then(|content| serde_json::from_str::<AssetSettingsFile>(&content).ok())
        .unwrap_or_default()
}

fn write_asset_settings_file(app_data_dir: &Path, settings: &AssetSettingsFile) -> Result<(), String> {
    let parent_dir = app_data_dir.parent().unwrap_or(app_data_dir);
    fs::create_dir_all(parent_dir)
        .map_err(|error| format!("Não foi possível preparar a pasta de configurações: {}", error))?;
    fs::write(
        asset_settings_file_path(app_data_dir),
        serde_json::to_string_pretty(settings)
            .map_err(|error| format!("Não foi possível serializar as configurações: {}", error))?,
    )
    .map_err(|error| format!("Não foi possível salvar as configurações de assets: {}", error))
}

fn resolve_asset_settings() -> Result<ResolvedAssetSettings, String> {
    let app_data_dir = local_app_assets_dir()?;
    let fallback_dir = program_files_assets_dir();
    let stored = read_asset_settings_file(&app_data_dir);
    let color_theme = resolve_color_theme(
        stored
            .color_theme_id
            .as_deref()
            .unwrap_or("azul"),
    );

    let app_logo = stored
        .logo_file_name
        .as_ref()
        .map(|file_name| app_data_dir.join(file_name))
        .filter(|path| path.is_file())
        .or_else(|| find_default_asset(&app_data_dir, "logo"));
    let app_background = stored
        .background_file_name
        .as_ref()
        .map(|file_name| app_data_dir.join(file_name))
        .filter(|path| path.is_file())
        .or_else(|| find_default_asset(&app_data_dir, "background"));

    let fallback_logo = fallback_dir
        .as_ref()
        .and_then(|dir| find_default_asset(dir, "logo"));
    let fallback_background = fallback_dir
        .as_ref()
        .and_then(|dir| find_default_asset(dir, "background"));

    let (logo_path, logo_source) = if let Some(path) = app_logo {
        (Some(path), "appData")
    } else if let Some(path) = fallback_logo {
        (Some(path), "fallback")
    } else {
        (None, "none")
    };

    let (background_path, background_source) = if let Some(path) = app_background {
        (Some(path), "appData")
    } else if let Some(path) = fallback_background {
        (Some(path), "fallback")
    } else {
        (None, "none")
    };

    Ok(ResolvedAssetSettings {
        logo_path,
        logo_source,
        background_path,
        background_source,
        app_data_dir,
        fallback_dir,
        color_theme,
    })
}

fn resolve_color_theme(theme_id: &str) -> &'static ColorThemePreset {
    COLOR_THEME_PRESETS
        .iter()
        .find(|preset| preset.id == theme_id)
        .unwrap_or(&COLOR_THEME_PRESETS[0])
}

fn find_default_asset(dir: &Path, stem: &str) -> Option<PathBuf> {
    ["png", "jpg", "jpeg", "webp", "svg"]
        .iter()
        .map(|ext| dir.join(format!("{}.{}", stem, ext)))
        .find(|path| path.is_file())
}

fn prepare_lesson_markdown_for_render(
    content: &str,
    assets: &ResolvedAssetSettings,
) -> Result<String, String> {
    let logo_url = asset_data_url(assets.logo_path.as_deref())?;
    let background_url = asset_data_url(assets.background_path.as_deref())?;
    let theme = assets.color_theme;

    let mut lines = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("backgroundImage:") {
            if let Some(url) = &background_url {
                lines.push(format!("backgroundImage: url('{}')", url));
            }
            continue;
        }

        if trimmed.starts_with("backgroundSize:") {
            if background_url.is_some() {
                lines.push("backgroundSize: cover".to_string());
            }
            continue;
        }

        if trimmed.starts_with("footer:") {
            if let Some(url) = &logo_url {
                lines.push(format!("footer: '<img src=\"{}\" alt=\"logo\" />'", url));
            } else {
                lines.push("footer: ''".to_string());
            }
            continue;
        }

        if trimmed.contains("shared/senai_logo") {
            if let Some(url) = &logo_url {
                let width = if trimmed.contains("w:300px") {
                    "300"
                } else if trimmed.contains("w:180px") {
                    "180"
                } else {
                    "300"
                };
                lines.push(format!("<img src=\"{}\" alt=\"logo\" width=\"{}\" />", url, width));
            }
            continue;
        }

        let next_line = line
            .replace("../shared/background.jpg", background_url.as_deref().unwrap_or(""))
            .replace("../../shared/background.jpg", background_url.as_deref().unwrap_or(""))
            .replace("../shared/senai_logo.png", logo_url.as_deref().unwrap_or(""))
            .replace("../../shared/senai_logo.png", logo_url.as_deref().unwrap_or(""))
            .replace("#1a5fa8", theme.title_dark)
            .replace("#3a7fc1", theme.title_mid)
            .replace("#1f5fb8", theme.title_dark)
            .replace("#2f6fcb", theme.line);
        lines.push(next_line);
    }

    Ok(lines.join("\n"))
}

fn asset_data_url(path: Option<&Path>) -> Result<Option<String>, String> {
    let Some(path) = path else {
        return Ok(None);
    };
    let bytes = fs::read(path)
        .map_err(|error| format!("Não foi possível ler o asset {}: {}", path.display(), error))?;
    let mime = match path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };
    Ok(Some(format!("data:{};base64,{}", mime, BASE64.encode(bytes))))
}

fn next_available_subject_slug(root: &Path, base: &str) -> String {
    if !root.join(base).exists() {
        return base.to_string();
    }

    for index in 2..1000 {
        let candidate = format!("{}_{:02}", base, index);
        if !root.join(&candidate).exists() {
            return candidate;
        }
    }

    format!("{}_copia", base)
}

fn next_content_number(dir: &Path, prefix: &str) -> usize {
    let mut max_number = 0usize;

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(Result::ok) {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.ends_with(".md") || !file_name.starts_with(prefix) {
                continue;
            }

            let remainder = &file_name[prefix.len()..];
            let number = remainder
                .split('_')
                .next()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(0);

            if number > max_number {
                max_number = number;
            }
        }
    }

    max_number + 1
}

fn template_context() -> &'static str {
    "# Disciplina Modelo\n\n## Visão geral\n\nEsta disciplina modelo foi criada para servir como base de planejamento no Lumen Studio, reunindo contexto, plano geral, aula e atividade de exemplo.\n\n## Escopo do que a disciplina cobre\n\n- fundamentos conceituais do tema principal\n- progressão dos conteúdos do básico ao aplicado\n- momentos de revisão, prática e avaliação\n- espaço para observações pedagógicas e ajustes de turma\n\n## Conteúdos e conhecimentos previstos\n\n- Conceito central 1\n  - Subtema 1.1\n  - Subtema 1.2\n- Conceito central 2\n  - Subtema 2.1\n  - Subtema 2.2\n- Procedimentos e práticas\n  - Ferramentas\n  - Exercícios guiados\n- Consolidação e avaliação\n  - Revisões\n  - Atividades avaliativas\n\n## Materiais disponíveis\n\n- slides em `aulas/`\n- atividades em `atividades/`\n- modelos em `modelos/`\n- notas e referências em `referencias/`\n- imagens e recursos visuais em `assets/`\n\n## Competências e foco formativo\n\n- interpretar conceitos e problemas da disciplina\n- aplicar procedimentos passo a passo\n- registrar soluções com clareza\n- relacionar teoria, prática e linguagem técnica\n\n## Observações pedagógicas\n\n- adaptar o ritmo conforme a turma\n- prever momentos de retomada para conteúdos mais densos\n- registrar aqui combinados, pré-requisitos e dificuldades recorrentes\n"
}

fn template_plan() -> &'static str {
    "# Plano Geral — Disciplina Modelo\n\n## Visão geral\n\n- Disciplina: Disciplina Modelo\n- Carga horária: definir\n- Total de aulas: definir\n- Avaliações: definir\n- Observação inicial: usar a primeira aula para apresentação da disciplina e alinhamento de combinados\n\n## Objetivo da disciplina\n\nEstruturar uma sequência de aulas que combine explicação, prática, revisão e avaliação, com clareza sobre o que será abordado em cada etapa.\n\n---\n\n## Distribuição das aulas\n\n### Bloco 1 — Fundamentos e nivelamento\n\nAula 1\n- apresentação da disciplina e combinados\n- visão geral dos conteúdos\n- introdução ao tema central\n\nAula 2\n- conceito-chave 1\n- exemplos guiados\n- exercício inicial\n\nAula 3\n- conceito-chave 2\n- comparação entre abordagens\n- prática orientada\n\n---\n\n### Bloco 2 — Aplicação e aprofundamento\n\nAula 4\n- aplicação prática do conteúdo\n- resolução comentada\n- atividade curta de fixação\n\nAula 5\n- aprofundamento do conteúdo\n- erros comuns e boas práticas\n- exercício em sala\n\nAula 6\n- revisão do bloco\n- preparação para avaliação ou entrega\n\n---\n\n### Aula de revisão e avaliação\n\nAula 7\n- revisão dos pontos principais na primeira metade\n- avaliação, atividade valendo nota ou estudo dirigido na segunda metade\n\n---\n\n## Estrutura sugerida para cada aula\n\n- título e identificação da aula\n- objetivos da aula\n- tópicos centrais\n- roteiro de fala em comentário HTML\n- exemplo prático\n- exercício ou atividade\n- fechamento com revisão e próximos passos\n\n## Observações\n\n- ajustar a sequência conforme a turma, calendário e carga horária real\n- registrar aqui datas, blocos avaliativos e aulas especiais\n- quando necessário, separar claramente aulas de revisão e aulas de prova\n"
}

fn template_lesson() -> &'static str {
    "---\nmarp: true\ntheme: default\npaginate: true\nhtml: true\ntitle: Aula 01 - Visao geral do Lumen Studio\nbackgroundImage: url('../shared/background.jpg')\nbackgroundSize: cover\nfooter: '![logo](../shared/senai_logo.png)'\n---\n\n<style>\nfooter {\n  position: absolute;\n  bottom: 14px;\n  left: 20px;\n  right: auto;\n  padding: 0;\n  border: none;\n  background: none;\n}\nfooter img {\n  height: 50px;\n  width: auto;\n}\n\nsection.capa {\n  text-align: center;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n}\nsection.capa h1 {\n  font-size: 2em;\n  font-weight: 800;\n  color: #1a5fa8;\n  background: none;\n  padding: 8px 0 4px;\n  margin-bottom: 0;\n  width: 100%;\n}\nsection.capa h2 {\n  font-size: 1.15em;\n  font-weight: 600;\n  color: #3a7fc1;\n  background: none;\n  padding: 4px 0 12px;\n  margin-top: 0;\n  width: 100%;\n  border-bottom: 2px solid #3a7fc1;\n}\nsection.capa p {\n  font-size: 0.85em;\n  color: #444;\n  margin-top: 24px;\n  line-height: 1.8;\n}\n\nsection:not(.capa) h2 {\n  color: #1a5fa8;\n  font-size: 1.35em;\n  border-bottom: 2px solid #3a7fc1;\n  padding-bottom: 6px;\n  margin-bottom: 18px;\n}\n\nsection:not(.capa) strong {\n  color: #1a5fa8;\n}\n\nsection.compacto table {\n  font-size: 0.72em;\n  width: 60%;\n}\n\nsection.compacto p {\n  font-size: 0.85em;\n  margin-bottom: 6px;\n}\n</style>\n\n<!-- _class: capa -->\n<!-- _paginate: false -->\n<!-- _footer: '' -->\n\n![w:300px](../shared/senai_logo.png)\n\n# Disciplina Modelo\n## Aula 01 — Visao geral do Lumen Studio\n\nMateus Flores Paz\nmateus.flores@fiemg.com.br\n\n---\n\n## Objetivos da aula\n\n- Conhecer a estrutura de uma disciplina\n- Visualizar exemplos de escrita para slides\n- Usar imagens, tabelas e anotacoes do apresentador\n\n---\n\n## Topicos do encontro\n\n- Estrutura da pasta da disciplina\n- Diferenca entre aula e atividade\n- Recursos visuais no Markdown\n- Fluxo de edicao e revisao\n\n<!--\nAbrir a aula explicando que este arquivo foi pensado para mostrar o maximo de possibilidades com o minimo de friccao para o professor.\nCada topico pode virar uma aula real depois.\n-->\n\n---\n\n## Estrutura basica da disciplina\n\n| Pasta ou arquivo | Funcao |\n|---|---|\n| `contexto.md` | descreve a disciplina |\n| `plano_geral.md` | organiza a sequencia de conteudo |\n| `aulas/` | guarda os slides Marp |\n| `atividades/` | guarda as atividades |\n| `referencias/` | notas e apoio |\n\n---\n\n## Exemplo de imagem no slide\n\n![h:260](../assets/exemplo_fluxo.svg)\n\n<!--\nUsar este slide para mostrar que o professor pode incorporar diagramas simples no proprio material da disciplina.\n-->\n\n---\n\n## Exemplo de interface ou wireframe\n\n![h:250](../assets/exemplo_interface.svg)\n\n---\n\n<!-- _class: compacto -->\n## Comparando tipos de conteudo\n\n| Tipo | Melhor uso | Saida comum |\n|---|---|---|\n| Aula | explicar, demonstrar, apresentar | slide |\n| Atividade | praticar, revisar, avaliar | PDF |\n| Referencia | apoiar o preparo do docente | Markdown interno |\n\n---\n\n## Destaques para a escrita\n\n- Use titulos curtos e objetivos\n- Prefira um ponto principal por slide\n- Marque trechos importantes com destaque como **conceito-chave**\n- Deixe anotacoes para voce em comentarios HTML\n\n<!--\nReforcar que o aluno ve o slide renderizado, mas o docente pode manter seu roteiro dentro do proprio arquivo.\n-->\n\n---\n\n## Mini atividade em sala\n\n1. Abra o arquivo da atividade modelo\n2. Identifique os blocos de marcacao, tabela e imagem\n3. Edite uma pergunta com sua propria linguagem\n4. Salve e volte para comparar o resultado\n\n---\n\n## Fechamento\n\n- Esta disciplina foi criada para servir como base inicial\n- Voce pode duplicar a estrutura e adaptar para sua materia\n- O proximo passo natural e substituir os exemplos pelo seu conteudo real\n"
}

fn template_lesson_draft(number: usize, theme: &str) -> String {
    format!(
        "---\nmarp: true\ntheme: default\npaginate: true\nhtml: true\ntitle: Aula {0:02} - {1}\nbackgroundImage: url('../shared/background.jpg')\nbackgroundSize: cover\nfooter: '![logo](../shared/senai_logo.png)'\n---\n\n<style>\nfooter {{\n  position: absolute;\n  bottom: 14px;\n  left: 20px;\n  right: auto;\n  padding: 0;\n  border: none;\n  background: none;\n}}\nfooter img {{\n  height: 50px;\n  width: auto;\n}}\n\nsection.capa {{\n  text-align: center;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n}}\nsection.capa h1 {{\n  font-size: 2em;\n  font-weight: 800;\n  color: #1a5fa8;\n  background: none;\n  padding: 8px 0 4px;\n  margin-bottom: 0;\n  width: 100%;\n}}\nsection.capa h2 {{\n  font-size: 1.15em;\n  font-weight: 600;\n  color: #3a7fc1;\n  background: none;\n  padding: 4px 0 12px;\n  margin-top: 0;\n  width: 100%;\n  border-bottom: 2px solid #3a7fc1;\n}}\nsection.capa p {{\n  font-size: 0.85em;\n  color: #444;\n  margin-top: 24px;\n  line-height: 1.8;\n}}\n\nsection:not(.capa) h2 {{\n  color: #1a5fa8;\n  font-size: 1.35em;\n  border-bottom: 2px solid #3a7fc1;\n  padding-bottom: 6px;\n  margin-bottom: 18px;\n}}\n\nsection:not(.capa) strong {{\n  color: #1a5fa8;\n}}\n</style>\n\n<!-- _class: capa -->\n<!-- _paginate: false -->\n<!-- _footer: '' -->\n\n![w:300px](../shared/senai_logo.png)\n\n# Nome da disciplina\n## Aula {0:02} — {1}\n\nMateus Flores Paz\nmateus.flores@fiemg.com.br\n\n---\n\n## Objetivos da aula\n\n- Objetivo 1\n- Objetivo 2\n- Objetivo 3\n\n---\n\n## Tópicos da aula\n\n- Tópico 1\n- Tópico 2\n- Tópico 3\n\n<!--\nROTEIRO DE FALA\n\n1. Tópico 1\n   Oriente o que deve ser explicado, demonstrado ou contextualizado.\n\n2. Tópico 2\n   Registre a linha de fala principal para manter a sequência da apresentação.\n\n3. Tópico 3\n   Aponte exemplos, perguntas para a turma ou analogias úteis.\n-->\n\n---\n\n## Exemplo ou demonstração\n\n- Inserir exemplo prático\n\n---\n\n## Atividade\n\n- Inserir exercício, desafio ou estudo de caso\n\n---\n\n## Fechamento\n\n- Retomar os principais aprendizados\n- Registrar próximo assunto\n",
        number,
        theme
    )
}

fn template_activity() -> &'static str {
    "---\ntitle: Atividade 01 - Mapeamento de fluxo e leitura de interface\nsubtitle: Disciplina Modelo\n---\n\n<style>\n.fill-box {\n  display: block;\n  width: 100%;\n  min-height: 120px;\n  border: 1px solid #cbd5e1;\n  border-radius: 12px;\n  margin-top: 12px;\n}\n.fill-box.small {\n  min-height: 64px;\n}\n.answer-line {\n  display: block;\n  border-bottom: 1px solid #94a3b8;\n  height: 24px;\n  margin-top: 12px;\n}\n.tip {\n  padding: 10px 12px;\n  border-left: 4px solid #2563eb;\n  background: #eff6ff;\n  margin: 12px 0;\n}\n</style>\n\n# Atividade 01 - Mapeamento de fluxo e leitura de interface\n\n## Objetivos\n\n- Ler e interpretar estruturas de conteúdo\n- Relacionar fluxo, interface e instrução\n- Registrar respostas discursivas, objetivas e visuais\n\n## Instruções\n\n- Leia todas as questões antes de responder.\n- Marque as alternativas com atenção.\n- Quando solicitado, use frases curtas e objetivas.\n\n<div class=\"tip\">\nDica: esta atividade foi desenhada para demonstrar vários formatos úteis no seu material.\n</div>\n\n## 1. Marque as estruturas que normalmente fazem parte de uma disciplina\n\n- [ ] `contexto.md`\n- [ ] `plano_geral.md`\n- [ ] `aulas/`\n- [ ] `atividades/`\n- [ ] `aprovacoes_final.zip`\n\n## 2. Complete as frases\n\nA pasta `aulas/` normalmente contém arquivos de __________________.\n\n<span class=\"answer-line\"></span>\n\nA pasta `atividades/` normalmente contém arquivos de __________________.\n\n<span class=\"answer-line\"></span>\n\n## 3. Observe a imagem e responda\n\n![w:520](../assets/exemplo_interface.svg)\n\nQual informação da interface ajuda o professor a entender em que etapa do trabalho ele está?\n\n<span class=\"fill-box small\"></span>\n\n## 4. Relacione cada item ao seu papel\n\n| Item | Papel |\n|---|---|\n| Aula | ______________________________ |\n| Atividade | ______________________________ |\n| Referências | ______________________________ |\n\n## 5. Analise o fluxo abaixo\n\n![w:520](../assets/exemplo_fluxo.svg)\n\nAssinale a alternativa mais adequada.\n\n- ( ) O fluxo representa somente exportação de PDF.\n- ( ) O fluxo mostra a passagem entre escrever, revisar e publicar.\n- ( ) O fluxo serve apenas para design visual.\n- ( ) O fluxo não se aplica ao trabalho docente.\n\n## 6. Resposta curta\n\nEm duas ou três linhas, explique por que separar aula e atividade ajuda na organização do planejamento.\n\n<span class=\"fill-box\"></span>\n\n## 7. Planejamento rápido\n\nPreencha a tabela com uma ideia inicial para sua própria disciplina.\n\n| Elemento | Sua ideia |\n|---|---|\n| Nome da disciplina | ______________________________ |\n| Tema da primeira aula | ______________________________ |\n| Tema da primeira atividade | ______________________________ |\n| Recurso visual que quer usar | ______________________________ |\n"
}

fn template_activity_draft(number: usize, theme: &str) -> String {
    format!(
        "---\ntitle: Atividade {0:02} - {1}\nsubtitle: Nome da disciplina\n---\n\n# Atividade {0:02} - {1}\n\n## Objetivos\n\n- Verificar a compreensao do conteudo\n- Exigir resposta curta e aplicacao pratica\n\n## Instrucoes\n\n- Leia cada item com atencao.\n- Responda com clareza.\n\n## Questoes\n\n### 1. Questao discursiva\n\nExplique com suas palavras a ideia principal da aula.\n\n<span class=\"fill-box\"></span>\n\n### 2. Questao objetiva\n\nMarque a alternativa correta.\n\n- ( ) Alternativa A\n- ( ) Alternativa B\n- ( ) Alternativa C\n- ( ) Alternativa D\n",
        number,
        theme
    )
}

fn empty_context_template(subject_name: &str) -> String {
    format!(
        "# {0}\n\n## Visão geral\n\nDescreva aqui o foco da disciplina e o papel dela dentro do curso.\n\n## Escopo do que a disciplina cobre\n\n- tema central 1\n- tema central 2\n- tema central 3\n\n## Conteúdos e conhecimentos previstos\n\n- conteúdo 1\n  - subtópico\n  - subtópico\n- conteúdo 2\n  - subtópico\n  - subtópico\n- conteúdo 3\n  - subtópico\n  - subtópico\n\n## Materiais disponíveis\n\n- slides\n- atividades\n- referências\n- softwares, laboratórios ou recursos específicos\n\n## Competências e foco formativo\n\n- competência 1\n- competência 2\n- competência 3\n\n## Público e contexto\n\n- Curso:\n- Turma:\n- Carga horária:\n- Pré-requisitos:\n\n## Observações pedagógicas\n\n- registrar aqui detalhamentos, combinados, adaptações e pontos de atenção\n",
        subject_name
    )
}

fn empty_plan_template(subject_name: &str) -> String {
    format!(
        "# Plano Geral - {0}\n\n## Visão geral\n\n- Disciplina: {0}\n- Carga horária: definir\n- Total de aulas: definir\n- Avaliações: definir\n- Observações de calendário: definir\n\n## Objetivo da disciplina\n\nDescreva aqui o objetivo principal da disciplina e o resultado esperado para a turma.\n\n---\n\n## Distribuição das aulas\n\n### Bloco 1 — Base conceitual\n\nAula 1\n- apresentação da disciplina\n- visão geral do conteúdo\n- introdução ao tema inicial\n\nAula 2\n- desenvolvimento do conteúdo 1\n- exemplos guiados\n- exercício de fixação\n\n### Bloco 2 — Prática e aprofundamento\n\nAula 3\n- desenvolvimento do conteúdo 2\n- prática orientada\n- correção comentada\n\nAula 4\n- revisão do bloco\n- atividade avaliativa, estudo dirigido ou preparação para prova\n\n---\n\n## Estrutura sugerida para cada aula\n\n- título e identificação\n- objetivos\n- tópicos principais\n- prática ou exercício\n- fechamento\n\n## Observações\n\n- ajustar a sequência conforme a turma\n- registrar datas, provas, entregas e aulas especiais\n",
        subject_name
    )
}

fn template_lesson_model() -> &'static str {
    "---\nmarp: true\ntheme: default\npaginate: true\nhtml: true\ntitle: Aula XX - Titulo da aula\nbackgroundImage: url('../shared/background.jpg')\nbackgroundSize: cover\nfooter: '![logo](../shared/senai_logo.png)'\n---\n\n<style>\nfooter {\n  position: absolute;\n  bottom: 14px;\n  left: 20px;\n  right: auto;\n  padding: 0;\n  border: none;\n  background: none;\n}\nfooter img {\n  height: 50px;\n  width: auto;\n}\n\nsection.capa {\n  text-align: center;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n}\nsection.capa h1 {\n  font-size: 2em;\n  font-weight: 800;\n  color: #1a5fa8;\n  background: none;\n  padding: 8px 0 4px;\n  margin-bottom: 0;\n  width: 100%;\n}\nsection.capa h2 {\n  font-size: 1.15em;\n  font-weight: 600;\n  color: #3a7fc1;\n  background: none;\n  padding: 4px 0 12px;\n  margin-top: 0;\n  width: 100%;\n  border-bottom: 2px solid #3a7fc1;\n}\nsection.capa p {\n  font-size: 0.85em;\n  color: #444;\n  margin-top: 24px;\n  line-height: 1.8;\n}\n\nsection:not(.capa) h2 {\n  color: #1a5fa8;\n  font-size: 1.35em;\n  border-bottom: 2px solid #3a7fc1;\n  padding-bottom: 6px;\n  margin-bottom: 18px;\n}\n\nsection:not(.capa) strong {\n  color: #1a5fa8;\n}\n</style>\n\n<!-- _class: capa -->\n<!-- _paginate: false -->\n<!-- _footer: '' -->\n\n![w:300px](../shared/senai_logo.png)\n\n# Nome da disciplina\n## Aula XX — Titulo da aula\n\nMateus Flores Paz\nmateus.flores@fiemg.com.br\n\n---\n\n## Objetivos da aula\n\n- Objetivo 1\n- Objetivo 2\n- Objetivo 3\n\n---\n\n## Topicos da aula\n\n- Topico 1\n- Topico 2\n- Topico 3\n\n<!--\nROTEIRO DE FALA\n\n1. Topico 1\n   Oriente o que deve ser explicado, demonstrado ou contextualizado.\n\n2. Topico 2\n   Registre a linha de fala principal para manter a sequencia da apresentacao.\n\n3. Topico 3\n   Aponte exemplos, perguntas para a turma ou analogias uteis.\n-->\n"
}

fn template_plan_model() -> &'static str {
    "# Plano Geral\n\n## Visão geral\n\n- Disciplina: Nome da disciplina\n- Carga horária: definir\n- Total de aulas: definir\n- Avaliações: definir\n\n## Objetivo da disciplina\n\nDescreva aqui o objetivo principal da disciplina.\n\n---\n\n## Distribuição das aulas\n\n### Bloco 1 — Introdução e fundamentos\n\nAula 1\n- apresentação da disciplina\n- introdução ao tema\n- primeiro exercício\n\nAula 2\n- desenvolvimento do conteúdo\n- exemplos guiados\n- prática orientada\n\n### Bloco 2 — Consolidação\n\nAula 3\n- revisão dos principais pontos\n- atividade ou avaliação\n\n---\n\n## Estrutura sugerida para cada aula\n\n- título e identificação\n- objetivos\n- tópicos principais\n- prática\n- fechamento\n\n## Observações\n\n- adaptar a sequência conforme o calendário da turma\n"
}

fn template_notes() -> &'static str {
    "# Notas do docente\n\n- Esta disciplina foi gerada automaticamente pelo Lumen Studio.\n- Use este arquivo para rascunhos, links e observacoes de apoio.\n"
}

fn template_flow_svg() -> &'static str {
    r##"<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f8fafc"/>
  <rect x="70" y="250" width="260" height="120" rx="22" fill="#1d4ed8"/>
  <rect x="510" y="250" width="260" height="120" rx="22" fill="#0f766e"/>
  <rect x="950" y="250" width="260" height="120" rx="22" fill="#c2410c"/>
  <text x="200" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#ffffff">Escrever</text>
  <text x="640" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#ffffff">Revisar</text>
  <text x="1080" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="#ffffff">Publicar</text>
  <path d="M330 310 H510" stroke="#334155" stroke-width="12" stroke-linecap="round"/>
  <path d="M770 310 H950" stroke="#334155" stroke-width="12" stroke-linecap="round"/>
  <path d="M470 290 L510 310 L470 330" fill="none" stroke="#334155" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M910 290 L950 310 L910 330" fill="none" stroke="#334155" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="640" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" fill="#0f172a">Fluxo de criacao de conteudo</text>
  <text x="640" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#475569">Exemplo visual para aula e atividade modelo</text>
</svg>"##
}

fn template_ui_svg() -> &'static str {
    r##"<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#eef2ff"/>
  <rect x="120" y="80" width="1040" height="560" rx="28" fill="#111827"/>
  <rect x="160" y="130" width="200" height="460" rx="18" fill="#1f2937"/>
  <rect x="400" y="130" width="700" height="90" rx="18" fill="#1f2937"/>
  <rect x="400" y="250" width="320" height="300" rx="18" fill="#e5e7eb"/>
  <rect x="750" y="250" width="350" height="300" rx="18" fill="#e5e7eb"/>
  <circle cx="215" cy="185" r="26" fill="#f59e0b"/>
  <rect x="255" y="165" width="70" height="18" rx="9" fill="#fef3c7"/>
  <rect x="255" y="195" width="46" height="12" rx="6" fill="#9ca3af"/>
  <rect x="430" y="160" width="180" height="20" rx="10" fill="#fef3c7"/>
  <rect x="430" y="190" width="120" height="12" rx="6" fill="#6b7280"/>
  <rect x="430" y="280" width="160" height="18" rx="9" fill="#1d4ed8"/>
  <rect x="430" y="320" width="230" height="12" rx="6" fill="#6b7280"/>
  <rect x="430" y="350" width="200" height="12" rx="6" fill="#9ca3af"/>
  <rect x="780" y="280" width="180" height="18" rx="9" fill="#0f766e"/>
  <rect x="780" y="320" width="260" height="12" rx="6" fill="#6b7280"/>
  <rect x="780" y="350" width="220" height="12" rx="6" fill="#9ca3af"/>
  <text x="640" y="102" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#111827">Wireframe de exemplo para conteudo didatico</text>
</svg>"##
}

const ACTIVITY_HTML_RENDER_SCRIPT: &str = r#"
const fs = require('fs');
const MarkdownIt = require(process.argv[1]);
const inputPath = process.argv[2];
const outputPath = process.argv[3];
const fallbackTitle = process.argv[4];
const logoPath = process.argv[5];
const themeId = process.argv[6];
const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
const rawContent = fs.readFileSync(inputPath, 'utf8');
const themes = {
  azul: { title: '#1f5fb8', subtitle: '#334155', rule: '#2f6fcb', label: '#2f6fcb', boxBorder: '#d4deed', boxBg: '#f6f9ff', tableBg: '#f3f7fd', tipBg: '#eaf2ff' },
  preto: { title: '#111111', subtitle: '#374151', rule: '#1f2937', label: '#111111', boxBorder: '#d1d5db', boxBg: '#f8fafc', tableBg: '#f3f4f6', tipBg: '#f3f4f6' },
  vermelho: { title: '#b42318', subtitle: '#4b5563', rule: '#ef4444', label: '#b42318', boxBorder: '#fecdd3', boxBg: '#fff1f2', tableBg: '#fff1f2', tipBg: '#ffe4e6' },
  verde: { title: '#166534', subtitle: '#3f3f46', rule: '#22c55e', label: '#166534', boxBorder: '#bbf7d0', boxBg: '#f0fdf4', tableBg: '#f0fdf4', tipBg: '#dcfce7' },
  roxo: { title: '#6d28d9', subtitle: '#475569', rule: '#8b5cf6', label: '#6d28d9', boxBorder: '#ddd6fe', boxBg: '#f5f3ff', tableBg: '#f5f3ff', tipBg: '#ede9fe' },
  laranja: { title: '#c2410c', subtitle: '#44403c', rule: '#f97316', label: '#c2410c', boxBorder: '#fed7aa', boxBg: '#fff7ed', tableBg: '#fff7ed', tipBg: '#ffedd5' },
  bege: { title: '#92400e', subtitle: '#57534e', rule: '#d97706', label: '#92400e', boxBorder: '#e7d7bf', boxBg: '#faf6ee', tableBg: '#faf6ee', tipBg: '#f5ead7' },
  teal: { title: '#0f766e', subtitle: '#334155', rule: '#14b8a6', label: '#0f766e', boxBorder: '#99f6e4', boxBg: '#f0fdfa', tableBg: '#f0fdfa', tipBg: '#ccfbf1' },
  rosa: { title: '#be185d', subtitle: '#475569', rule: '#ec4899', label: '#be185d', boxBorder: '#fbcfe8', boxBg: '#fdf2f8', tableBg: '#fdf2f8', tipBg: '#fce7f3' },
  cinza: { title: '#334155', subtitle: '#475569', rule: '#64748b', label: '#334155', boxBorder: '#cbd5e1', boxBg: '#f8fafc', tableBg: '#f8fafc', tipBg: '#eef2f7' },
};
const theme = themes[themeId] || themes.azul;
function toDataUrl(filePath) {
  if (!filePath) return '';
  const ext = String(filePath).split('.').pop().toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'webp' ? 'image/webp' :
    ext === 'svg' ? 'image/svg+xml' :
    'application/octet-stream';
  const buffer = fs.readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
const logoSrc = toDataUrl(logoPath);

function parseFrontmatter(source) {
  if (!source.startsWith('---')) {
    return { body: source, title: fallbackTitle, subtitle: '' };
  }

  const closingIndex = source.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return { body: source, title: fallbackTitle, subtitle: '' };
  }

  const frontmatter = source.slice(3, closingIndex).trim();
  const body = source.slice(closingIndex + 4).trimStart();
  const meta = {};

  for (const line of frontmatter.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    meta[key] = value;
  }

  return {
    body,
    title: meta.title || fallbackTitle,
    subtitle: meta.subtitle || '',
  };
}

const parsed = parseFrontmatter(rawContent);
const renderedBody = md.render(parsed.body);
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${parsed.title}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      margin: 0;
      line-height: 1.45;
      background: #eef3f8;
    }
    .page {
      max-width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 28px 30px 40px;
      box-sizing: border-box;
      background: #ffffff;
    }
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 16px;
      margin-bottom: 10px;
    }
    .page-header img { max-height: 34px; width: auto; }
    .hero-title {
      margin: 0;
      color: ${theme.title};
      font-size: 24px;
      font-weight: 800;
      line-height: 1.15;
    }
    .hero-subtitle {
      margin: 4px 0 0;
      color: ${theme.subtitle};
      font-size: 11px;
    }
    .hero-rule {
      margin: 10px 0 18px;
      border: 0;
      border-top: 3px solid ${theme.rule};
    }
    .student-box {
      margin: 0 0 14px;
      padding: 10px 12px;
      border: 1px solid ${theme.boxBorder};
      border-radius: 8px;
      background: ${theme.boxBg};
    }
    .student-label {
      color: ${theme.label};
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .student-line {
      display: block;
      margin-top: 12px;
      border-bottom: 1px solid #b8c8df;
      height: 12px;
    }
    h1, h2, h3, h4 { color: ${theme.title}; }
    h1 {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.2;
      margin: 0 0 18px;
    }
    h2 {
      font-size: 14px;
      font-weight: 800;
      margin: 16px 0 10px;
    }
    h3 {
      font-size: 12px;
      font-weight: 700;
      margin: 10px 0 8px;
    }
    p, li, td, th {
      font-size: 11px;
      color: #111827;
    }
    ul, ol {
      margin: 8px 0 10px 20px;
      padding: 0;
    }
    li {
      margin: 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px;
    }
    th, td {
      border: 1px solid #d4deed;
      padding: 7px 8px;
      vertical-align: top;
      text-align: left;
    }
    th {
      color: ${theme.title};
      background: ${theme.tableBg};
      font-weight: 700;
    }
    img { max-width: 100%; height: auto; }
    code {
      background: #eef4fb;
      padding: 1px 4px;
      border-radius: 4px;
    }
    pre {
      background: #f8fafc;
      padding: 10px;
      border-radius: 8px;
      overflow: auto;
    }
    .fill-box {
      display: block;
      width: 100%;
      min-height: 96px;
      border-left: 2px solid #c9d7eb;
      margin-top: 8px;
    }
    .fill-box.small,
    .small-box {
      min-height: 42px;
    }
    .answer-line {
      display: block;
      border-bottom: 1px solid #94a3b8;
      height: 20px;
      margin-top: 8px;
    }
    .tip {
      padding: 10px 12px;
      border-left: 4px solid ${theme.rule};
      background: ${theme.tipBg};
      margin: 10px 0 14px;
      font-size: 11px;
      line-height: 1.55;
    }
  </style>
</head>
<body>
  <main class="page">
    ${logoSrc ? `<div class="page-header"><img src="${logoSrc}" alt="Logo" /></div>` : ''}
    <h1 class="hero-title">${parsed.title}</h1>
    ${parsed.subtitle ? `<p class="hero-subtitle">${parsed.subtitle}</p>` : ''}
    <hr class="hero-rule" />
    <section class="student-box">
      <span class="student-label">Aluno(a)</span>
      <span class="student-line"></span>
    </section>
    ${renderedBody}
  </main>
</body>
</html>`;
fs.writeFileSync(outputPath, html, 'utf8');
"#;

#[tauri::command]
fn render_marp_html(workspace_path: String, content: String) -> Result<String, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let tool_root = resolve_generation_tool_root(&root)
        .map_err(|_| "Ferramentas de geração não encontradas. Instale as dependências no workspace.".to_string())?;
    let assets = resolve_asset_settings()?;

    let marp_bin = tool_root.join("node_modules").join(".bin").join("marp.cmd");
    if !marp_bin.is_file() {
        return Err("Marp CLI não encontrado em node_modules/.bin/marp.cmd.".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let temp_input = temp_dir.join(format!("lumen_preview_{}.md", timestamp));
    let temp_output = temp_dir.join(format!("lumen_preview_{}.html", timestamp));

    let prepared_content = prepare_lesson_markdown_for_render(&content, &assets)?;
    fs::write(&temp_input, &prepared_content)
        .map_err(|e| format!("Falha ao criar arquivo temporário: {}", e))?;

    let marp_bin_str = marp_bin.to_string_lossy().to_string();
    let input_str = temp_input.to_string_lossy().to_string();
    let output_str = temp_output.to_string_lossy().to_string();

    let status = Command::new("cmd")
        .args(["/C", &marp_bin_str, "--html", "--allow-local-files", "--output", &output_str, &input_str])
        .status()
        .map_err(|e| format!("Falha ao executar o Marp CLI: {}", e))?;

    let _ = fs::remove_file(&temp_input);

    if !status.success() || !temp_output.is_file() {
        let _ = fs::remove_file(&temp_output);
        return Err("Falha ao renderizar os slides. Verifique se o Marp CLI está instalado corretamente.".to_string());
    }

    let html = fs::read_to_string(&temp_output)
        .map_err(|e| format!("Falha ao ler o HTML gerado: {}", e))?;

    let _ = fs::remove_file(&temp_output);

    Ok(html)
}

#[tauri::command]
fn render_activity_html(workspace_path: String, content: String) -> Result<String, String> {
    let root = resolve_workspace_root(&workspace_path)?;
    let tool_root = resolve_generation_tool_root(&root)
        .map_err(|_| "Ferramentas de geração não encontradas. Instale as dependências no workspace.".to_string())?;
    let markdown_it_module = tool_root.join("node_modules").join("markdown-it");

    if !markdown_it_module.exists() {
        return Err("markdown-it não encontrado em node_modules.".to_string());
    }
    let assets = resolve_asset_settings()?;
    let logo_path = assets
        .logo_path
        .as_ref()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let theme_id = assets.color_theme.id.to_string();
    let temp_dir = std::env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let temp_input = temp_dir.join(format!("lumen_activity_preview_{}.md", timestamp));
    let temp_output = temp_dir.join(format!("lumen_activity_preview_{}.html", timestamp));

    fs::write(&temp_input, &content)
        .map_err(|e| format!("Falha ao criar arquivo temporário: {}", e))?;

    let status = Command::new("node")
        .arg("-e")
        .arg(ACTIVITY_HTML_RENDER_SCRIPT)
        .arg(markdown_it_module.to_string_lossy().to_string())
        .arg(temp_input.to_string_lossy().to_string())
        .arg(temp_output.to_string_lossy().to_string())
        .arg("Preview da atividade")
        .arg(logo_path)
        .arg(theme_id)
        .status()
        .map_err(|e| format!("Falha ao renderizar a atividade: {}", e))?;

    let _ = fs::remove_file(&temp_input);

    if !status.success() || !temp_output.is_file() {
        let _ = fs::remove_file(&temp_output);
        return Err("Falha ao montar o preview da atividade.".to_string());
    }

    let html = fs::read_to_string(&temp_output)
        .map_err(|e| format!("Falha ao ler o HTML gerado: {}", e))?;

    let _ = fs::remove_file(&temp_output);

    Ok(html)
}

#[tauri::command]
fn get_asset_settings() -> Result<AssetSettingsState, String> {
    let resolved = resolve_asset_settings()?;
    Ok(AssetSettingsState {
        app_data_dir: resolved.app_data_dir.to_string_lossy().to_string(),
        fallback_dir: resolved
            .fallback_dir
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        logo_path: resolved
            .logo_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        logo_source: resolved.logo_source.to_string(),
        background_path: resolved
            .background_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        background_source: resolved.background_source.to_string(),
        color_theme_id: resolved.color_theme.id.to_string(),
    })
}

#[tauri::command]
fn set_color_theme(theme_id: String) -> Result<AssetSettingsState, String> {
    let app_data_dir = local_app_assets_dir()?;
    let normalized = theme_id.trim().to_lowercase();
    if COLOR_THEME_PRESETS.iter().all(|preset| preset.id != normalized) {
        return Err("Tema de cor inválido.".to_string());
    }

    let mut settings = read_asset_settings_file(&app_data_dir);
    settings.color_theme_id = Some(normalized);
    write_asset_settings_file(&app_data_dir, &settings)?;
    get_asset_settings()
}

#[tauri::command]
fn set_asset_file(asset_kind: String, source_path: String) -> Result<AssetSettingsState, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.is_file() {
        return Err("Selecione um arquivo válido.".to_string());
    }

    let app_data_dir = local_app_assets_dir()?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Não foi possível preparar a pasta de assets: {}", error))?;

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| ["png", "jpg", "jpeg", "webp", "svg"].contains(&value.as_str()))
        .ok_or_else(|| "Use um arquivo de imagem compatível: png, jpg, jpeg, webp ou svg.".to_string())?;

    let mut settings = read_asset_settings_file(&app_data_dir);
    let target_file_name = match asset_kind.as_str() {
        "logo" => format!("logo.{}", extension),
        "background" => format!("background.{}", extension),
        _ => return Err("Tipo de asset inválido.".to_string()),
    };

    if asset_kind == "logo" {
        if let Some(previous) = settings.logo_file_name.take() {
            let _ = fs::remove_file(app_data_dir.join(previous));
        }
        settings.logo_file_name = Some(target_file_name.clone());
    } else {
        if let Some(previous) = settings.background_file_name.take() {
            let _ = fs::remove_file(app_data_dir.join(previous));
        }
        settings.background_file_name = Some(target_file_name.clone());
    }

    fs::copy(&source, app_data_dir.join(&target_file_name))
        .map_err(|error| format!("Não foi possível copiar o arquivo selecionado: {}", error))?;
    write_asset_settings_file(&app_data_dir, &settings)?;
    get_asset_settings()
}

#[tauri::command]
fn clear_asset_file(asset_kind: String) -> Result<AssetSettingsState, String> {
    let app_data_dir = local_app_assets_dir()?;
    let mut settings = read_asset_settings_file(&app_data_dir);

    match asset_kind.as_str() {
        "logo" => {
            if let Some(previous) = settings.logo_file_name.take() {
                let _ = fs::remove_file(app_data_dir.join(previous));
            }
        }
        "background" => {
            if let Some(previous) = settings.background_file_name.take() {
                let _ = fs::remove_file(app_data_dir.join(previous));
            }
        }
        _ => return Err("Tipo de asset inválido.".to_string()),
    }

    write_asset_settings_file(&app_data_dir, &settings)?;
    get_asset_settings()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_icon(tauri::include_image!("icons/32x32.png"))?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_subjects,
            get_subject_detail,
            read_content_file,
            save_content_file,
            get_content_file_snapshot,
            delete_subject,
            delete_content_item,
            generate_content_output,
            open_content_output_folder,
            create_subject,
            update_subject,
            create_template_subject,
            create_lesson,
            create_activity,
            get_asset_settings,
            set_asset_file,
            clear_asset_file,
            set_color_theme,
            render_marp_html,
            render_activity_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
