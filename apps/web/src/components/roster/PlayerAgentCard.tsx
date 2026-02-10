import type {
  AgentEligibility,
  AgentStatic,
  DiscProperty,
  PlayerAgentDynamic,
  PlayerAgentDisc
} from "@ika/shared";
import { Badge } from "../ui/badge";
import { RarityIcon } from "../RarityIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface PlayerAgentCardProps {
  agent: AgentStatic;
  state?: PlayerAgentDynamic;
  eligibility: AgentEligibility;
}

const sourceLabels: Record<PlayerAgentDynamic["source"], string> = {
  ENKA_SHOWCASE: "Enka",
  VERIFIER_OCR: "Scan",
  MANUAL: "Manual"
};

const discSlots = [1, 2, 3, 4, 5, 6];

function formatDiscProp(prop: DiscProperty): string {
  const level = prop.level !== undefined ? ` L${prop.level}` : "";
  const value = prop.value !== undefined ? prop.value : "-";
  return `${prop.propertyId}: ${value}${level}`;
}

function getDiscIconLabel(disc: PlayerAgentDisc | undefined): string {
  if (!disc?.setIconKey) {
    return "--";
  }
  const cleaned = disc.setIconKey.replace(/[^A-Za-z]/g, "");
  return cleaned.slice(0, 3).toUpperCase() || disc.setIconKey.slice(0, 3).toUpperCase();
}

export function PlayerAgentCard({ agent, state, eligibility }: PlayerAgentCardProps) {
  const owned = state?.owned ?? false;
  const eligibilityBadge = eligibility.draftEligible ? "Eligible" : "Not eligible";
  const discMap = new Map<number, PlayerAgentDisc>();
  state?.discs?.forEach((disc) => {
    if (disc.slot && disc.slot >= 1 && disc.slot <= 6) {
      discMap.set(disc.slot, disc);
    }
  });

  return (
    <div className="rounded-xl border border-border bg-ika-800/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">{agent.name}</div>
          <div className="text-xs text-ink-500">{agent.faction}</div>
        </div>
        <RarityIcon rarity={agent.rarity} className="h-6 w-6 object-contain" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge className="border border-border bg-ika-700/60 text-ink-700">{agent.attribute}</Badge>
        <Badge className="border border-border bg-ika-700/60 text-ink-700">{agent.role}</Badge>
        <Badge className="border border-border bg-ika-700/60 text-ink-700">{agent.attackType}</Badge>
        <Badge
          className={
            owned
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border border-rose-500/40 bg-rose-500/10 text-rose-200"
          }
        >
          {owned ? "Owned" : "Missing"}
        </Badge>
        {state ? (
          <Badge className="border border-border bg-ika-700/60 text-ink-700">
            {sourceLabels[state.source]}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-500">
        <span>Level: {state?.level ?? "-"}</span>
        <span>Dupes: {state?.dupes ?? "-"}</span>
        <span>Mindscape: {state?.mindscape ?? "-"}</span>
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Discs</div>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {discSlots.map((slot) => {
            const disc = discMap.get(slot);
            const isUnknown = !disc?.setName || disc.setName.startsWith("Unknown set");
            const chipClasses = disc
              ? isUnknown
                ? "border-border bg-ika-900/60 text-ink-500"
                : "border-cool-400/60 bg-cool-500/10 text-ink-700"
              : "border-border bg-ika-900/30 text-ink-500";
            const content = (
              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] font-semibold ${chipClasses}`}
              >
                <span>{disc ? getDiscIconLabel(disc) : "--"}</span>
                <span className="absolute -right-1 -top-1 rounded-full border border-border bg-ika-900/80 px-1 text-[9px] text-ink-500">
                  {slot}
                </span>
              </div>
            );

            if (!disc) {
              return <div key={slot}>{content}</div>;
            }

            return (
              <Tooltip key={slot}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-xs font-semibold text-ink-900">{disc.setName}</div>
                  <div className="mt-1 text-[11px] text-ink-500">
                    Slot {slot} - Level {disc.level ?? "-"}
                  </div>
                  {disc.mainProps?.length ? (
                    <div className="mt-2 text-[11px] text-ink-500">
                      <div className="font-semibold text-ink-700">Main</div>
                      {disc.mainProps.map((prop) => (
                        <div key={`main-${prop.propertyId}`}>{formatDiscProp(prop)}</div>
                      ))}
                    </div>
                  ) : null}
                  {disc.subProps?.length ? (
                    <div className="mt-2 text-[11px] text-ink-500">
                      <div className="font-semibold text-ink-700">Sub</div>
                      {disc.subProps.map((prop) => (
                        <div key={`sub-${prop.propertyId}`}>{formatDiscProp(prop)}</div>
                      ))}
                    </div>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {eligibility.draftEligible ? (
          <Badge className="border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            {eligibilityBadge}
          </Badge>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="border border-rose-500/40 bg-rose-500/10 text-rose-200">
                {eligibilityBadge}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs text-xs">
                {eligibility.reasons.map((reason) => (
                  <div key={reason}>{reason}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
