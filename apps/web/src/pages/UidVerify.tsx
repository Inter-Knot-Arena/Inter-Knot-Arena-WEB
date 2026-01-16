export default function UidVerify() {
  return (
    <div className="page">
      <section className="section-header">
        <h2>UID Verification</h2>
        <p>Ranked queues require verified identity.</p>
      </section>

      <div className="grid">
        <div className="card">
          <h3>Step 1: Submit UID</h3>
          <div className="form-grid">
            <label>
              UID
              <input placeholder="Enter UID" />
            </label>
            <label>
              Region
              <select defaultValue="NA">
                <option value="NA">NA</option>
                <option value="EU">EU</option>
                <option value="ASIA">Asia</option>
              </select>
            </label>
          </div>
          <button className="primary-button">Generate code</button>
        </div>

        <div className="card">
          <h3>Step 2: Proof</h3>
          <p className="code">IKA-7F3Q2</p>
          <p>Place the code in your in-game signature and upload a profile screenshot.</p>
          <button className="ghost-button">Upload screenshot</button>
        </div>
      </div>
    </div>
  );
}
