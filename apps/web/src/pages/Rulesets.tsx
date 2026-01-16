import { useEffect, useMemo, useState } from "react";
import type { Ruleset } from "@ika/shared";
import { fetchRulesets } from "../api";

const leagueLabel: Record<string, string> = {
  league_f2p: "F2P",
  league_standard: "Standard",
  league_unlimited: "Unlimited"
};

export default function Rulesets() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);

  useEffect(() => {
    fetchRulesets().then(setRulesets);
  }, []);

  const sorted = useMemo(() => {
    return rulesets.slice().sort((a, b) => a.leagueId.localeCompare(b.leagueId));
  }, [rulesets]);

  return (
    <div className="page">
      <section className="section-header">
        <h2>Rulesets</h2>
        <p>League policy cards for competitive enforcement.</p>
      </section>

      <div className="grid">
        {sorted.map((ruleset) => (
          <div key={ruleset.id} className="card">
            <div className="card-header">
              <h3>{ruleset.name}</h3>
              <span className="badge-outline">{leagueLabel[ruleset.leagueId] ?? ruleset.leagueId}</span>
            </div>
            <p>{ruleset.description}</p>
            <div className="chip-row">
              <span className={ruleset.requireVerifier ? "badge" : "badge-outline"}>
                {ruleset.requireVerifier ? "Verifier" : "No verifier"}
              </span>
              <span className={ruleset.requireInrunCheck ? "badge" : "badge-outline"}>
                {ruleset.requireInrunCheck ? "In-run" : "No in-run"}
              </span>
            </div>
            <div className="meta-row">
              <div>
                <div className="meta-label">Precheck</div>
                <div className="meta-value">{ruleset.evidencePolicy.retentionDays.precheck} days</div>
              </div>
              <div>
                <div className="meta-label">In-run</div>
                <div className="meta-value">{ruleset.evidencePolicy.retentionDays.inrun} days</div>
              </div>
              <div>
                <div className="meta-label">Result</div>
                <div className="meta-value">{ruleset.evidencePolicy.retentionDays.result} days</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
