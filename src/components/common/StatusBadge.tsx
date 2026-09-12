import { Ban, CheckCircle2, CircleMinus, CircleX, Wrench } from "lucide-react";
import type { TestCase } from "../../types/analysis";
import { statusLabel } from "../../utils/analysis";

interface StatusBadgeProps {
  item: TestCase;
  fixed: boolean;
  blocked: boolean;
}

export function StatusBadge({ item, fixed, blocked }: StatusBadgeProps) {
  const kind = fixed ? "fixed" : blocked ? "blocked" : item.status === "PASS" ? "pass" : item.status === "FAIL" ? "fail" : "other";
  const Icon = fixed ? Wrench : blocked ? Ban : item.status === "PASS" ? CheckCircle2 : item.status === "FAIL" ? CircleX : CircleMinus;
  return (
    <span className={`status-badge status-badge--${kind}`}>
      <Icon size={14} />
      {statusLabel(item, fixed, blocked)}
    </span>
  );
}
