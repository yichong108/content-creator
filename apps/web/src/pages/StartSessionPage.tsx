import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { WechatStartSessionPage } from "@/components/WechatStartSessionPage";
import { useStartSession } from "@/contexts/StartSessionContext";

/**
 * 发起会话主页
 *
 * 展示已选对方/己方 NPC，点击行进入子页选择具体角色。
 */
export function StartSessionPage() {
  const navigate = useNavigate();
  const {
    npcs,
    loading,
    error,
    peerNpcIds,
    selfNpcId,
    removePeerNpcId,
    removeSelfNpc,
    submitting,
    submitError,
    handleSubmit,
  } = useStartSession();

  const peerNpcs = useMemo(
    () =>
      peerNpcIds
        .map((id) => npcs.find((npc) => npc.id === id))
        .filter((npc): npc is NonNullable<typeof npc> => npc != null),
    [npcs, peerNpcIds],
  );
  const selfNpc = selfNpcId != null ? (npcs.find((npc) => npc.id === selfNpcId) ?? null) : null;

  return (
    <WechatStartSessionPage
      peerNpcs={peerNpcs}
      selfNpc={selfNpc}
      loading={loading}
      error={error}
      submitting={submitting}
      submitError={submitError}
      onRemovePeerNpc={removePeerNpcId}
      onRemoveSelfNpc={removeSelfNpc}
      onSelectPeer={() => navigate("/start-session/select/peer")}
      onSelectSelf={() => navigate("/start-session/select/self")}
      onBack={() => navigate("/")}
      onSubmit={() => void handleSubmit()}
    />
  );
}
