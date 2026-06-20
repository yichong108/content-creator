/** 会话 / 直播会话新建编辑表单的本地 state 结构 */
export interface ChatSessionFormValues {
  title: string;
  description: string;
  chatItemsJson: string;
  npcIds?: number[];
}
