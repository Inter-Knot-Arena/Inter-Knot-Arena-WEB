import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { submitUidVerification, verifyUidProof } from "../api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../components/ui/tooltip";

const REGION_OPTIONS = ["NA", "EU", "ASIA", "SEA", "OTHER"];

function isValidUid(value: string): boolean {
  return /^\d{6,12}$/.test(value);
}

export default function UidVerify() {
  const { user, isLoading, refresh } = useAuth();
  const initialRegion = useMemo(() => {
    return user?.verification?.region ?? user?.region ?? "NA";
  }, [user]);
  const [uid, setUid] = useState(user?.verification?.uid ?? "");
  const [region, setRegion] = useState(initialRegion);
  const [code, setCode] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const verificationStatus = user?.verification?.status ?? "UNVERIFIED";
  const uidValid = uid.length > 0 && isValidUid(uid);

  const handleSubmit = async () => {
    if (!uidValid) {
      setError("UID должен быть 6-12 цифр.");
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await submitUidVerification({ uid, region });
      setCode(response.code);
      setSuccess("Код сгенерирован. Вставь его в подпись профиля в игре.");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось отправить UID.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!uidValid) {
      setError("UID должен быть 6-12 цифр.");
      return;
    }
    if (!code) {
      setError("Сначала сгенерируй код.");
      return;
    }
    setError(null);
    setSuccess(null);
    setVerifying(true);
    try {
      await verifyUidProof({ uid, region, code, proofUrl: proofUrl || undefined });
      await refresh();
      setSuccess("UID подтверждён. Ranked очереди доступны.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Подтверждение не удалось.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6 text-sm text-ink-500">
          Загрузка...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-lg font-semibold text-ink-900">UID верификация</div>
          <p className="mt-2 text-sm text-ink-500">
            Войди в аккаунт, чтобы подтвердить UID и открыть ranked очереди.
          </p>
          <Button className="mt-4" asChild>
            <a href="/signin">Войти</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">UID verification</div>
        <h1 className="text-2xl font-display text-ink-900">Подтверждение UID</h1>
        <p className="mt-2 text-sm text-ink-500">
          Ranked очереди доступны только после подтверждения UID.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-ink-900">Шаг 1 — отправь UID</div>
              <div className="text-xs text-ink-500">Код генерируется на сервере.</div>
            </div>
            <Badge className="border border-border bg-ika-700/60 text-ink-700">
              Status: {verificationStatus}
            </Badge>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-ink-500">UID</label>
              <Input
                value={uid}
                onChange={(event) => setUid(event.target.value.trim())}
                placeholder="Введите UID (6-12 цифр)"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Region</label>
              <select
                className="mt-2 w-full rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-ink-500">Используется для проверки региона.</div>
            </div>
          </div>

          <Button className="mt-4" onClick={handleSubmit} disabled={submitting || !uidValid}>
            {submitting ? "Генерируем..." : "Сгенерировать код"}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-sm font-semibold text-ink-900">Шаг 2 — подтверждение</div>
          <p className="mt-2 text-xs text-ink-500">
            Вставь код в подпись профиля и сделай скрин. Затем подтвердить можно ссылкой на
            изображение (любой хостинг).
          </p>

          <div className="mt-4 rounded-lg border border-border bg-ika-900/50 px-4 py-3 text-sm text-ink-900">
            {code || "Код появится после шага 1"}
          </div>

          <div className="mt-4">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Proof URL</label>
            <Input
              value={proofUrl}
              onChange={(event) => setProofUrl(event.target.value)}
              placeholder="https://..."
              className="mt-2"
            />
            <div className="mt-2 text-xs text-ink-500">
              Можно оставить пустым для MVP.
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleVerify} disabled={verifying || !uidValid || !code}>
              {verifying ? "Проверяем..." : "Подтвердить UID"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-xs text-ink-500">Что будет дальше?</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs text-xs">
                  После подтверждения UID открывается доступ к ranked очередям и полному ростеру.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
