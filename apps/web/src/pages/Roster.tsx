import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function Roster() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="card">Loading roster...</div>;
  }

  if (!user) {
    return (
      <div className="page">
        <section className="section-header">
          <h2>Roster</h2>
          <p>Sign in to manage and verify your playable roster.</p>
        </section>
        <div className="card">
          <Link className="primary-button" to="/signin">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!user.verification.uid) {
    return (
      <div className="page">
        <section className="section-header">
          <h2>Roster</h2>
          <p>
            UID and roster are now verified only through Verifier App OCR full-scan.
          </p>
        </section>
        <div className="card">
          <Link className="primary-button" to="/uid-verify">
            Open Verifier setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="section-header">
        <h2>Roster</h2>
        <p>Use Verifier App OCR sync to keep your roster and UID up to date.</p>
      </section>
      <div className="card">
        <div className="meta-row">
          <div>
            <div className="meta-label">Verified UID</div>
            <div className="meta-value">{user.verification.uid}</div>
          </div>
          <div>
            <div className="meta-label">Region</div>
            <div className="meta-value">{user.verification.region ?? user.region}</div>
          </div>
        </div>
        <div className="card-actions">
          <Link className="primary-button" to={`/players/${user.verification.uid}/roster`}>
            Open roster workspace
          </Link>
          <Link className="ghost-button" to="/uid-verify">
            Verifier setup
          </Link>
        </div>
      </div>
    </div>
  );
}
