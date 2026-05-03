import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { featureFlags } from "./flags";

const Home = lazy(() => import("./pages/Home"));
const Matchmaking = lazy(() => import("./pages/Matchmaking"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const Players = lazy(() => import("./pages/Players"));
const Agents = lazy(() => import("./pages/Agents"));
const Rulesets = lazy(() => import("./pages/Rulesets"));
const Profile = lazy(() => import("./pages/Profile"));
const SignIn = lazy(() => import("./pages/SignIn"));
const Settings = lazy(() => import("./pages/Settings"));
const MatchRoom = lazy(() => import("./pages/MatchRoom"));
const UidVerify = lazy(() => import("./pages/UidVerify"));
const Roster = lazy(() => import("./pages/Roster"));
const PlayerRoster = lazy(() => import("./pages/PlayerRoster"));
const Disputes = lazy(() => import("./pages/Disputes"));
const Admin = lazy(() => import("./pages/Admin"));

const routeFallback = (
  <div className="card" aria-live="polite">
    Loading page...
  </div>
);

export default function App() {
  return (
    <Shell>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/matchmaking" element={<Matchmaking />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/players" element={<Players />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/rulesets" element={<Rulesets />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="/match/:id" element={<MatchRoom />} />
          <Route path="/uid-verify" element={<UidVerify />} />
          <Route path="/roster" element={<Roster />} />
          {featureFlags.enableAgentCatalog ? (
            <Route path="/players/:uid/roster" element={<PlayerRoster />} />
          ) : null}
          <Route
            path="/disputes"
            element={
              <RequireAuth>
                <RequireRole roles={["ADMIN", "STAFF", "MODER"]}>
                  <Disputes />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireRole roles={["ADMIN", "STAFF", "MODER"]}>
                  <Admin />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="*" element={<div className="card">Page not found.</div>} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
