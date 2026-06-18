/**
 * 将标签文本解析为标签数组。
 *
 * 支持英文逗号、中文逗号与空格分隔。
 *
 * @param value - 用户输入的标签文本
 * @returns 去重后的标签数组
 */
export function parseNpcTagsInput(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of value.split(/[,，\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    tags.push(trimmed);
  }

  return tags;
}

/**
 * 将标签数组格式化为表单输入文本。
 *
 * @param tags - 标签数组
 * @returns 逗号分隔的标签文本
 */
export function formatNpcTagsInput(tags: string[]): string {
  return tags.join("，");
}
