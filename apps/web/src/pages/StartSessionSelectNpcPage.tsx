import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { WechatNpcSelectPage } from "@/components/WechatNpcSelectPage";
import {
  filterNpcsForSide,
  useStartSession,
  type StartSessionSide,
} from "@/contexts/StartSessionContext";

/**
 * 解析路由中的角色侧别参数。
 *
 * @param side - 路由参数原始值
 * @returns 合法的侧别；非法时返回 null
 */
function parseStartSessionSide(side: string | undefined): StartSessionSide | null {
  if (side === "peer" || side === "self") {
    return side;
  }
  return null;
}

/**
 * 发起会话 NPC 选择子页
 *
 * 对方为多选，己方为单选；选中后返回主页（对方需点「完成」）。
 */
export function StartSessionSelectNpcPage() {
  const navigate = useNavigate();
  const { side: sideParam } = useParams<{ side: string }>();
  const side = parseStartSessionSide(sideParam);
  const { npcs, loading, error, peerNpcIds, selfNpcId, togglePeerNpcId, setSelfNpcId } =
    useStartSession();

  useEffect(() => {
    if (side == null) {
      navigate("/start-session", { replace: true });
    }
  }, [side, navigate]);

  if (side == null) {
    return null;
  }

  const isPeer = side === "peer";
  const title = isPeer ? "选择对方" : "选择己方";
  const selectableNpcs = filterNpcsForSide(npcs, side);
  const selectedIds = isPeer ? peerNpcIds : selfNpcId != null ? [selfNpcId] : [];

  const handleSelect = (npcId: number) => {
    if (isPeer) {
      togglePeerNpcId(npcId);
      return;
    }

    setSelfNpcId(npcId);
    navigate("/start-session");
  };

  return (
    <WechatNpcSelectPage
      title={title}
      npcs={selectableNpcs}
      loading={loading}
      error={error}
      multiple={isPeer}
      selectedIds={selectedIds}
      onSelect={handleSelect}
      onBack={() => navigate("/start-session")}
      onDone={() => navigate("/start-session")}
    />
  );
}
