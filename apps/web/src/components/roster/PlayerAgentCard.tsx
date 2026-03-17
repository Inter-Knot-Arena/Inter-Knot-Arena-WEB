import { useState } from "react";
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
import { getFullMindscapeUrl } from "./mindscape";

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
const preferredStatOrder = ["hp_flat", "attack_flat", "defense_flat", "impact"];
const preferredOcrFields = ["agentId", "level", "mindscape", "stats", "weapon", "discs"];

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

function formatStatLabel(key: string): string {
  switch (key) {
    case "hp_flat":
      return "HP";
    case "attack_flat":
      return "ATK";
    case "defense_flat":
      return "DEF";
    case "impact":
      return "Impact";
    default:
      return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function formatStatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  if (Math.abs(value) >= 100) {
    return value.toFixed(1);
  }
  return value.toFixed(2).replace(/0+$/g, "").replace(/\.$/, "");
}

function formatConfidence(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return `${Math.round(value * 100)}%`;
}

function formatOcrFieldLabel(field: string): string {
  if (field === "agentId") {
    return "Agent";
  }
  return field.charAt(0).toUpperCase() + field.slice(1);
}

export function PlayerAgentCard({ agent, state, eligibility }: PlayerAgentCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const owned = state?.owned ?? false;
  const eligibilityBadge = eligibility.draftEligible ? "Eligible" : "Not eligible";
  const discMap = new Map<number, PlayerAgentDisc>();
  const mindscapeUrl = imageFailed ? null : getFullMindscapeUrl(agent.agentId);
  const weapon = state?.weapon;
  const weaponLabel =
    weapon?.displayName ?? weapon?.weaponId ?? (state?.weaponPresent === false ? "Unequipped" : null);
  const weaponLevel =
    weapon?.level !== undefined
      ? `L${weapon.level}${weapon.levelCap !== undefined ? `/${weapon.levelCap}` : ""}`
      : null;
  const statEntries = Object.entries(state?.stats ?? {})
    .sort((left, right) => {
      const leftIndex = preferredStatOrder.indexOf(left[0]);
      const rightIndex = preferredStatOrder.indexOf(right[0]);
      if (leftIndex === -1 && rightIndex === -1) {
        return left[0].localeCompare(right[0]);
      }
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    })
    .slice(0, 6);
  const ocrFields =
    state?.source === "VERIFIER_OCR"
      ? preferredOcrFields.flatMap((field) => {
          const confidence = formatConfidence(state.confidenceByField?.[field]);
          const source = state.fieldSources?.[field];
          if (!confidence && !source) {
            return [];
          }
          return [
            {
              field,
              label: formatOcrFieldLabel(field),
              confidence,
              source: source ?? "unspecified"
            }
          ];
        })
      : [];
  state?.discs?.forEach((disc) => {
    if (disc.slot && disc.slot >= 1 && disc.slot <= 6) {
      discMap.set(disc.slot, disc);
    }
  });

  return (
    <div className="rounded-xl border border-border bg-ika-800/70 p-3">
      <div className="relative mb-3 overflow-hidden rounded-lg border border-border bg-ika-900/40">
        {mindscapeUrl ? (
          <img
            src={mindscapeUrl}
            alt={`${agent.name} full mindscape`}
            className="h-40 w-full object-cover object-center"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-ika-900 via-ika-800 to-ika-700 text-sm text-ink-500">
            Full mindscape unavailable
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-ink-900">{agent.name}</div>
              <div className="truncate text-xs text-ink-600">{agent.faction}</div>
            </div>
            <RarityIcon rarity={agent.rarity} className="h-6 w-6 shrink-0 object-contain" />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
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

      {(weaponLabel || statEntries.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {weaponLabel ? (
            <div className="rounded-lg border border-border bg-ika-900/40 p-3 text-xs text-ink-500">
              <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500">Weapon</div>
              <div className="mt-2 text-sm font-semibold text-ink-900">{weaponLabel}</div>
              {weaponLevel ? <div className="mt-1">{weaponLevel}</div> : null}
              {weapon?.baseStatKey && weapon.baseStatValue !== undefined ? (
                <div className="mt-2">
                  {weapon.baseStatKey}: {formatStatValue(weapon.baseStatValue)}
                </div>
              ) : null}
              {weapon?.advancedStatKey && weapon.advancedStatValue !== undefined ? (
                <div className="mt-1">
                  {weapon.advancedStatKey}: {formatStatValue(weapon.advancedStatValue)}
                </div>
              ) : null}
            </div>
          ) : null}

          {statEntries.length > 0 ? (
            <div className="rounded-lg border border-border bg-ika-900/40 p-3 text-xs text-ink-500">
              <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500">Stats</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {statEntries.map(([key, value]) => (
                  <div key={key} className="rounded-md border border-border bg-ika-800/60 px-2 py-1">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                      {formatStatLabel(key)}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink-900">
                      {formatStatValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {ocrFields.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-ika-900/40 p-3 text-xs text-ink-500">
          <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500">OCR Fields</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ocrFields.map((field) => {
              const badge = (
                <Badge className="border border-border bg-ika-800/60 text-ink-700">
                  {field.label}
                  {field.confidence ? ` ${field.confidence}` : ""}
                </Badge>
              );

              return (
                <Tooltip key={`${field.field}:${field.source}`}>
                  <TooltipTrigger asChild>{badge}</TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-xs font-semibold text-ink-900">{field.label}</div>
                    <div className="mt-1 text-[11px] text-ink-500">Source: {field.source}</div>
                    {field.confidence ? (
                      <div className="mt-1 text-[11px] text-ink-500">
                        Confidence: {field.confidence}
                      </div>
                    ) : null}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ) : null}

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
