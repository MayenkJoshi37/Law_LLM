"use client";

import { useState } from "react";
import { PROVIDERS, providerDetails, type ProviderConnection, type ProviderId } from "@/lib/provider-config";

type Stage = "landing" | "provider" | "model" | "ready";

export function Onboarding({ onReady }: { onReady: (connection: ProviderConnection) => void }) {
  const [stage, setStage] = useState<Stage>("landing");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(providerDetails.openai.recommendedModel);
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState("");

  const detail = providerDetails[provider];
  const connection = { provider, apiKey: apiKey.trim(), model: model.trim() };

  function chooseProvider(next: ProviderId) {
    setProvider(next);
    setModel(providerDetails[next].recommendedModel);
    setError("");
  }

  async function verify() {
    if (apiKey.trim().length < 12 || model.trim().length < 2) {
      setError("Enter your API key and a valid model identifier.");
      return;
    }
    setStatus("checking");
    setError("");
    try {
      const response = await fetch("/api/providers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The provider could not be verified.");
      setStage("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The provider could not be verified.");
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  }

  if (stage === "landing") {
    return <main className="onboarding-shell landing-shell">
      <header className="onboarding-nav"><div className="kaisan-wordmark"><i /> Kaisan Legal</div><span>Evidence-led legal research</span></header>
      <section className="landing-hero">
        <p className="landing-kicker">A private research workspace</p>
        <h1>Begin with the record.<br /><em>Then form the view.</em></h1>
        <p className="landing-copy">Kaisan Legal turns your legal materials into a focused, cited conversation—so every useful answer stays connected to the text behind it.</p>
        <button className="landing-cta" onClick={() => setStage("provider")}>Set up your workspace <span>→</span></button>
        <p className="landing-note">Bring your own AI provider. Your key is used only for this browser session.</p>
      </section>
      <section className="landing-principles" aria-label="How Kaisan Legal works">
        <article><span>01</span><h2>Bring the material</h2><p>Upload the agreements, statutes, notices, and extracts that matter.</p></article>
        <article><span>02</span><h2>Follow the evidence</h2><p>Inspect concise source cards and citations alongside each response.</p></article>
        <article><span>03</span><h2>Keep perspective</h2><p>Research support, clearly marked—not legal advice or a substitute for counsel.</p></article>
      </section>
    </main>;
  }

  return <main className="onboarding-shell setup-shell">
    <header className="onboarding-nav"><button className="kaisan-wordmark setup-back" onClick={() => setStage("landing")}><i /> Kaisan Legal</button><span>Private, session-only configuration</span></header>
    <section className="setup-card">
      <div className="setup-progress"><span className={stage === "provider" ? "active" : "done"}>1 <b>Provider</b></span><i /><span className={stage === "model" ? "active" : stage === "ready" ? "done" : ""}>2 <b>Model</b></span><i /><span className={stage === "ready" ? "active" : ""}>3 <b>Ready</b></span></div>
      {stage === "provider" && <>
        <p className="setup-kicker">Step 1</p><h1>Choose your AI provider.</h1><p className="setup-copy">Kaisan connects directly to the provider you choose. Credentials stay in live browser memory and are never saved.</p>
        <div className="provider-grid">{PROVIDERS.map((item) => <button key={item} className={provider === item ? "provider-choice selected" : "provider-choice"} onClick={() => chooseProvider(item)}><strong>{providerDetails[item].name}</strong><span>{providerDetails[item].recommendedModel}</span></button>)}</div>
        <label className="setup-field"><span>{detail.name} API key</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste your key" /><small>Sent only with your research requests; never stored by Kaisan.</small></label>
        <button className="setup-next" disabled={apiKey.trim().length < 12} onClick={() => setStage("model")}>Continue to model <span>→</span></button>
      </>}
      {stage === "model" && <>
        <p className="setup-kicker">Step 2 · {detail.name}</p><h1>Specify the model.</h1><p className="setup-copy">Kaisan will use exactly the provider and model shown below. You can enter any model your key can access.</p>
        <label className="setup-field model-field"><span>Model identifier</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={detail.example} /><small>Recommended: <b>{detail.recommendedModel}</b> · Example format: <b>{detail.example}</b></small></label>
        {error && <p className="setup-error">{error}</p>}
        <div className="setup-actions"><button className="setup-secondary" onClick={() => setStage("provider")}>Back</button><button className="setup-next" disabled={status === "checking"} onClick={() => void verify()}>{status === "checking" ? "Checking connection…" : "Verify and continue →"}</button></div>
      </>}
      {stage === "ready" && <>
        <p className="setup-kicker">Connection confirmed</p><h1>Your workspace is ready.</h1><p className="setup-copy">You’re connected to <strong>{detail.name}</strong> using <code>{model}</code>. Add your source material, then ask a focused question.</p>
        <div className="ready-summary"><span>Provider <b>{detail.name}</b></span><span>Model <b>{model}</b></span><span>Storage <b>Session-only</b></span></div>
        <button className="setup-next" onClick={() => onReady(connection)}>Enter research workspace <span>→</span></button>
        <button className="setup-secondary centered" onClick={() => setStage("model")}>Change model</button>
      </>}
    </section>
  </main>;
}
