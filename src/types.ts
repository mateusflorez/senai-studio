export type SubjectSummary = {
  id: string;
  slug: string;
  displayName: string;
  color: string;
  lessonCount: number;
  activityCount: number;
  hasContext: boolean;
  hasPlan: boolean;
  updatedAtMs: number | null;
};

export type SubjectDetail = {
  id: string;
  slug: string;
  displayName: string;
  color: string;
  hasContext: boolean;
  hasPlan: boolean;
  lessons: ContentItem[];
  activities: ContentItem[];
};

export type ContentItem = {
  file: string;
  relativePath: string;
  title: string;
  status: "ok" | "outdated" | "none";
  updatedAtMs: number | null;
};

export type EditableContentFile = {
  file: string;
  relativePath: string;
  title: string;
  content: string;
  updatedAtMs: number | null;
};

export type SaveContentResult = {
  updatedAtMs: number | null;
};

export type ContentFileSnapshot = {
  content: string;
  updatedAtMs: number | null;
};

export type CreateTemplateSubjectResult = {
  slug: string;
};

export type CreateSubjectResult = {
  slug: string;
};

export type CreateContentItemResult = {
  relativePath: string;
};

export type RenameContentItemResult = {
  relativePath: string;
};

export type GlobalSearchResult = {
  kind: "subject" | "lesson" | "activity" | "context" | "plan";
  subjectSlug: string;
  subjectDisplayName: string;
  relativePath: string | null;
  title: string;
  snippet: string;
};

export type AssetSettingsState = {
  appDataDir: string;
  fallbackDir: string | null;
  logoPath: string | null;
  logoSource: string;
  backgroundPath: string | null;
  backgroundSource: string;
  colorThemeId: string;
};

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type DeleteTarget =
  | { kind: "subject"; slug: string; name: string }
  | {
      kind: "content";
      relativePath: string;
      title: string;
      label: "aula" | "atividade";
    };
