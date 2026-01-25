import { Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import Home from "./pages/Home";
import Matchmaking from "./pages/Matchmaking";
import Leaderboards from "./pages/Leaderboards";
import Players from "./pages/Players";
import Agents from "./pages/Agents";
import Rulesets from "./pages/Rulesets";
import Profile from "./pages/Profile";
import SignIn from "./pages/SignIn";
import Settings from "./pages/Settings";
import MatchRoom from "./pages/MatchRoom";
import UidVerify from "./pages/UidVerify";
import Roster from "./pages/Roster";
import PlayerRoster from "./pages/PlayerRoster";
import Disputes from "./pages/Disputes";
import Admin from "./pages/Admin";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { featureFlags } from "./flags";

export default function App() {
  return (
    <Shell>
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
        <Route path="/disputes" element={<Disputes />} />
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
    </Shell>
  );
}
