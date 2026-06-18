/**
 * NPC 标签列表展示。
 */
export function NpcTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
        </span>
      ))}
    </div>
  );
}
