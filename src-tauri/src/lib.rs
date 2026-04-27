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
struct CreateContentItemResult {
    relative_path: String,
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

#[tauri::command]
fn get_content_file_snapshot(
    workspace_path: String,
    subject_slug: String,
    relative_path: String,
) -> Result<ContentFileSnapshot, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let content_path = resolve_content_path(&subject_path, &relative_path)?;

    if !content_path.is_file() {
        return Err(format!("Arquivo nao encontrado: {}", relative_path));
    }

    let content = fs::read_to_string(&content_path)
        .map_err(|error| format!("Nao foi possivel ler {}: {}", relative_path, error))?;

    Ok(ContentFileSnapshot {
        content,
        updated_at_ms: fs::metadata(&content_path)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(system_time_to_ms),
    })
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
        .map_err(|error| format!("Nao foi possivel criar a disciplina modelo: {}", error))?;

    fs::write(
        subject_path.join(".conf"),
        r##"{"nome":"Disciplina Modelo","cor":"#F97316"}"##,
    )
    .map_err(|error| format!("Nao foi possivel criar .conf: {}", error))?;

    fs::write(subject_path.join("contexto.md"), template_context())
        .map_err(|error| format!("Nao foi possivel criar contexto.md: {}", error))?;
    fs::write(subject_path.join("plano_geral.md"), template_plan())
        .map_err(|error| format!("Nao foi possivel criar plano_geral.md: {}", error))?;
    fs::write(&lesson_path, template_lesson())
        .map_err(|error| format!("Nao foi possivel criar aula modelo: {}", error))?;
    fs::write(&activity_path, template_activity())
        .map_err(|error| format!("Nao foi possivel criar atividade modelo: {}", error))?;
    fs::write(models_dir.join("modelo_aula_marp.md"), template_lesson_model())
        .map_err(|error| format!("Nao foi possivel criar modelo_aula_marp.md: {}", error))?;
    fs::write(models_dir.join("modelo_plano_geral.md"), template_plan_model())
        .map_err(|error| format!("Nao foi possivel criar modelo_plano_geral.md: {}", error))?;
    fs::write(references_dir.join("notas.md"), template_notes())
        .map_err(|error| format!("Nao foi possivel criar notas.md: {}", error))?;
    fs::write(assets_dir.join("exemplo_fluxo.svg"), template_flow_svg())
        .map_err(|error| format!("Nao foi possivel criar exemplo_fluxo.svg: {}", error))?;
    fs::write(assets_dir.join("exemplo_interface.svg"), template_ui_svg())
        .map_err(|error| format!("Nao foi possivel criar exemplo_interface.svg: {}", error))?;

    Ok(CreateTemplateSubjectResult { slug })
}

#[tauri::command]
fn create_lesson_draft(
    workspace_path: String,
    subject_slug: String,
) -> Result<CreateContentItemResult, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let next_number = next_content_number(&subject_path.join("aulas"), "aula_");
    let file_name = format!("aula_{:02}_novo_tema.md", next_number);
    let relative_path = format!("aulas/{}", file_name);

    fs::write(subject_path.join(&relative_path), template_lesson_draft(next_number))
        .map_err(|error| format!("Nao foi possivel criar a aula: {}", error))?;

    Ok(CreateContentItemResult { relative_path })
}

#[tauri::command]
fn create_activity_draft(
    workspace_path: String,
    subject_slug: String,
) -> Result<CreateContentItemResult, String> {
    let subject_path = resolve_subject_path(&workspace_path, &subject_slug)?;
    let next_number = next_content_number(&subject_path.join("atividades"), "atividade_");
    let file_name = format!("atividade_{:02}_novo_tema.md", next_number);
    let relative_path = format!("atividades/{}", file_name);

    fs::write(subject_path.join(&relative_path), template_activity_draft(next_number))
        .map_err(|error| format!("Nao foi possivel criar a atividade: {}", error))?;

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
    "# Disciplina Modelo\n\n## Proposito\n\nEsta disciplina foi gerada para demonstrar o fluxo completo do SENAI Studio com arquivos reais, uma aula Marp e uma atividade em Markdown.\n\n## O que voce encontra aqui\n\n- uma aula com capa, topicos, tabela, imagem e notas do apresentador\n- uma atividade com marcacao, tabela, imagem, campos de preenchimento e questoes discursivas\n- estrutura completa de disciplina para servir como ponto de partida\n"
}

fn template_plan() -> &'static str {
    "# Plano Geral — Disciplina Modelo\n\n## Objetivo geral\n\nApresentar uma estrutura de exemplo que ajude o professor a entender como organizar conteudo, aula e atividade dentro do SENAI Studio.\n\n## Sequencia sugerida\n\n1. Aula 01 — Visao geral do Studio\n2. Atividade 01 — Mapeamento de fluxo\n\n## Resultados esperados\n\n- Entender a estrutura da disciplina\n- Reconhecer os tipos de conteudo que o editor suporta\n- Usar a disciplina como base para criar novas materias\n"
}

fn template_lesson() -> &'static str {
    "---\nmarp: true\ntheme: default\npaginate: true\ntitle: Aula 01 - Visao geral do SENAI Studio\n---\n\n<style>\nsection.capa {\n  text-align: center;\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n}\nsection.capa h1 {\n  color: #1f4f99;\n  margin-bottom: 0;\n}\nsection.capa h2 {\n  color: #4b77b8;\n  margin-top: 0.25rem;\n}\n.table-compact table {\n  font-size: 0.72em;\n}\n.highlight {\n  color: #c2410c;\n  font-weight: 700;\n}\n</style>\n\n<!-- _class: capa -->\n<!-- _paginate: false -->\n\n# Disciplina Modelo\n## Aula 01 — Visao geral do SENAI Studio\n\nExemplo de aula com recursos variados\n\n---\n\n## Objetivos da aula\n\n- Conhecer a estrutura de uma disciplina\n- Visualizar exemplos de escrita para slides\n- Usar imagens, tabelas e anotacoes do apresentador\n\n---\n\n## Topicos do encontro\n\n- Estrutura da pasta da disciplina\n- Diferenca entre aula e atividade\n- Recursos visuais no Markdown\n- Fluxo de edicao e revisao\n\n<!--\nAbrir a aula explicando que este arquivo foi pensado para mostrar o maximo de possibilidades com o minimo de friccao para o professor.\nCada topico pode virar uma aula real depois.\n-->\n\n---\n\n## Estrutura basica da disciplina\n\n| Pasta ou arquivo | Funcao |\n|---|---|\n| `contexto.md` | descreve a disciplina |\n| `plano_geral.md` | organiza a sequencia de conteudo |\n| `aulas/` | guarda os slides Marp |\n| `atividades/` | guarda as atividades |\n| `referencias/` | notas e apoio |\n\n---\n\n## Exemplo de imagem no slide\n\n![h:260](../assets/exemplo_fluxo.svg)\n\n<!--\nUsar este slide para mostrar que o professor pode incorporar diagramas simples no proprio material da disciplina.\n-->\n\n---\n\n## Exemplo de interface ou wireframe\n\n![h:250](../assets/exemplo_interface.svg)\n\n---\n\n<!-- _class: table-compact -->\n## Comparando tipos de conteudo\n\n| Tipo | Melhor uso | Saida comum |\n|---|---|---|\n| Aula | explicar, demonstrar, apresentar | slide |\n| Atividade | praticar, revisar, avaliar | PDF |\n| Referencia | apoiar o preparo do docente | Markdown interno |\n\n---\n\n## Destaques para a escrita\n\n- Use titulos curtos e objetivos\n- Prefira um ponto principal por slide\n- Marque trechos importantes com destaque como <span class=\"highlight\">conceito-chave</span>\n- Deixe anotacoes para voce em comentarios HTML\n\n<!--\nReforcar que o aluno ve o slide renderizado, mas o docente pode manter seu roteiro dentro do proprio arquivo.\n-->\n\n---\n\n## Mini atividade em sala\n\n1. Abra o arquivo da atividade modelo\n2. Identifique os blocos de marcacao, tabela e imagem\n3. Edite uma pergunta com sua propria linguagem\n4. Salve e volte para comparar o resultado\n\n---\n\n## Fechamento\n\n- Esta disciplina foi criada para servir como base inicial\n- Voce pode duplicar a estrutura e adaptar para sua materia\n- O proximo passo natural e substituir os exemplos pelo seu conteudo real\n"
}

fn template_lesson_draft(number: usize) -> String {
    format!(
        "---\nmarp: true\ntheme: default\npaginate: true\ntitle: Aula {0:02} - Novo tema\n---\n\n# Aula {0:02} - Novo tema\n\n## Objetivos da aula\n\n- Objetivo 1\n- Objetivo 2\n- Objetivo 3\n\n---\n\n## Topicos da aula\n\n- Topico 1\n- Topico 2\n- Topico 3\n\n<!--\nRoteiro do apresentador.\nEscreva aqui as orientacoes que nao devem aparecer no slide.\n-->\n\n---\n\n## Exemplo ou demonstracao\n\n- Inserir exemplo pratico\n\n---\n\n## Atividade em sala\n\n- Inserir exercicio, desafio ou estudo de caso\n\n---\n\n## Fechamento\n\n- Retomar aprendizados\n- Indicar o proximo passo\n",
        number
    )
}

fn template_activity() -> &'static str {
    "---\ntitle: Atividade 01 - Mapeamento de fluxo e leitura de interface\nsubtitle: Disciplina Modelo\n---\n\n<style>\n.fill-box {\n  display: block;\n  width: 100%;\n  min-height: 120px;\n  border: 1px solid #cbd5e1;\n  border-radius: 12px;\n  margin-top: 12px;\n}\n.fill-box.small {\n  min-height: 64px;\n}\n.answer-line {\n  display: block;\n  border-bottom: 1px solid #94a3b8;\n  height: 24px;\n  margin-top: 12px;\n}\n.tip {\n  padding: 10px 12px;\n  border-left: 4px solid #2563eb;\n  background: #eff6ff;\n  margin: 12px 0;\n}\n</style>\n\n# Atividade 01 - Mapeamento de fluxo e leitura de interface\n\n## Objetivos\n\n- Ler e interpretar estruturas de conteudo\n- Relacionar fluxo, interface e instrucao\n- Registrar respostas discursivas, objetivas e visuais\n\n## Instrucoes\n\n- Leia todas as questoes antes de responder.\n- Marque as alternativas com atencao.\n- Quando solicitado, use frases curtas e objetivas.\n\n<div class=\"tip\">\nDica: esta atividade foi desenhada para demonstrar varios formatos uteis no seu material.\n</div>\n\n## 1. Marque as estruturas que normalmente fazem parte de uma disciplina\n\n- [ ] `contexto.md`\n- [ ] `plano_geral.md`\n- [ ] `aulas/`\n- [ ] `atividades/`\n- [ ] `aprovacoes_final.zip`\n\n## 2. Complete as frases\n\nA pasta `aulas/` normalmente contem arquivos de __________________.\n\n<span class=\"answer-line\"></span>\n\nA pasta `atividades/` normalmente contem arquivos de __________________.\n\n<span class=\"answer-line\"></span>\n\n## 3. Observe a imagem e responda\n\n![w:520](../assets/exemplo_interface.svg)\n\nQual informacao da interface ajuda o professor a entender em que etapa do trabalho ele esta?\n\n<span class=\"fill-box small\"></span>\n\n## 4. Relacione cada item ao seu papel\n\n| Item | Papel |\n|---|---|\n| Aula | ______________________________ |\n| Atividade | ______________________________ |\n| Referencias | ______________________________ |\n\n## 5. Analise o fluxo abaixo\n\n![w:520](../assets/exemplo_fluxo.svg)\n\nAssinale a alternativa mais adequada.\n\n- ( ) O fluxo representa somente exportacao de PDF.\n- ( ) O fluxo mostra a passagem entre escrever, revisar e publicar.\n- ( ) O fluxo serve apenas para design visual.\n- ( ) O fluxo nao se aplica ao trabalho docente.\n\n## 6. Resposta curta\n\nEm duas ou tres linhas, explique por que separar aula e atividade ajuda na organizacao do planejamento.\n\n<span class=\"fill-box\"></span>\n\n## 7. Planejamento rapido\n\nPreencha a tabela com uma ideia inicial para sua propria disciplina.\n\n| Elemento | Sua ideia |\n|---|---|\n| Nome da disciplina | ______________________________ |\n| Tema da primeira aula | ______________________________ |\n| Tema da primeira atividade | ______________________________ |\n| Recurso visual que quer usar | ______________________________ |\n"
}

fn template_activity_draft(number: usize) -> String {
    format!(
        "---\ntitle: Atividade {0:02} - Novo tema\nsubtitle: Nome da disciplina\n---\n\n# Atividade {0:02} - Novo tema\n\n## Objetivos\n\n- Verificar a compreensao do conteudo\n- Exigir resposta curta e aplicacao pratica\n\n## Instrucoes\n\n- Leia cada item com atencao.\n- Responda com clareza.\n\n## Questoes\n\n### 1. Questao discursiva\n\nExplique com suas palavras a ideia principal da aula.\n\n<span class=\"fill-box\"></span>\n\n### 2. Questao objetiva\n\nMarque a alternativa correta.\n\n- ( ) Alternativa A\n- ( ) Alternativa B\n- ( ) Alternativa C\n- ( ) Alternativa D\n",
        number
    )
}

fn template_lesson_model() -> &'static str {
    "---\nmarp: true\ntheme: default\npaginate: true\ntitle: Aula XX - Titulo da aula\n---\n\n# Nome da disciplina\n## Aula XX — Titulo da aula\n\n## Objetivos da aula\n\n- Objetivo 1\n- Objetivo 2\n- Objetivo 3\n\n---\n\n## Topicos da aula\n\n- Topico 1\n- Topico 2\n- Topico 3\n\n<!--\nRoteiro do apresentador.\n-->\n"
}

fn template_plan_model() -> &'static str {
    "# Plano Geral\n\n## Objetivo geral\n\nDescreva aqui o objetivo principal da disciplina.\n\n## Sequencia de aulas\n\n1. Aula 01\n2. Aula 02\n3. Aula 03\n"
}

fn template_notes() -> &'static str {
    "# Notas do docente\n\n- Esta disciplina foi gerada automaticamente pelo SENAI Studio.\n- Use este arquivo para rascunhos, links e observacoes de apoio.\n"
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_subjects,
            get_subject_detail,
            read_content_file,
            save_content_file,
            get_content_file_snapshot,
            create_template_subject,
            create_lesson_draft,
            create_activity_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
