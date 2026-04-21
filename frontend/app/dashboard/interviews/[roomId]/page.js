"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";

const TYPE_LABEL = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System design",
};

function trackEnabled(stream, kind) {
  if (!stream) return false;
  return stream
    .getTracks()
    .some((t) => t.kind === kind && t.readyState === "live" && t.enabled);
}

export default function CandidateInterviewRoomPage() {
  const params = useParams();
  const roomId = decodeURIComponent(String(params?.roomId || ""));
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [startedPayload, setStartedPayload] = useState(null);
  const [mediaStatus, setMediaStatus] = useState({ camera: false, mic: false });

  const cameraReady = mediaStatus.camera;
  const micReady = mediaStatus.mic;
  const mediaReady = cameraReady && micReady;
  const canStart =
    interview?.status === "scheduled" || interview?.status === "in_progress";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch("/v1/interviews/lookup-by-room", {
          method: "POST",
          body: JSON.stringify({ roomId }),
        });
        if (!mounted) return;
        setInterview(data.interview || null);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Could not load interview");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) {
          t.stop();
        }
        streamRef.current = null;
      }
      setMediaStatus({ camera: false, mic: false });
    };
  }, [roomId]);

  async function enableCameraAndMic() {
    setMediaLoading(true);
    setMediaError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera/mic access");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) {
          t.stop();
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMediaStatus({
        camera: trackEnabled(stream, "video"),
        mic: trackEnabled(stream, "audio"),
      });
    } catch (err) {
      setMediaError(err.message || "Camera and microphone access is required");
      setMediaStatus({ camera: false, mic: false });
    } finally {
      setMediaLoading(false);
    }
  }

  async function startInterview() {
    if (!mediaReady) {
      setStartError("Enable and test camera + microphone before starting.");
      return;
    }
    if (!canStart) {
      setStartError("This interview cannot be started from its current status.");
      return;
    }
    setStarting(true);
    setStartError("");
    try {
      const data = await apiFetch("/v1/interviews/start-by-room", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      setInterview(data.interview || interview);
      setStartedPayload(data || null);
    } catch (err) {
      setStartError(err.message || "Could not start interview");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <LoadingState label="Loading interview…" />;
  }
  if (error || !interview) {
    return (
      <Card>
        <CardHeader
          title="Interview unavailable"
          subtitle={error || "This room is not available for your account."}
        />
        <div className="mt-2">
          <Link href="/dashboard" className="text-sm font-semibold text-[#1d4ed8] hover:underline">
            Back to interviews
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`Interview Room: ${interview.roomId}`}
          subtitle={`${TYPE_LABEL[interview.interviewType] || interview.interviewType} • ${interview.durationMinutes} min`}
        />
      </Card>

      <Card>
        <CardHeader
          title="Pre-interview check"
          subtitle="Camera and microphone access is mandatory before starting."
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">
                Camera:{" "}
                <span className={cameraReady ? "text-emerald-700" : "text-amber-700"}>
                  {cameraReady ? "Ready" : "Not ready"}
                </span>
              </p>
              <p className="mt-1 text-slate-600">
                You must allow video permission to continue.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">
                Microphone:{" "}
                <span className={micReady ? "text-emerald-700" : "text-amber-700"}>
                  {micReady ? "Ready" : "Not ready"}
                </span>
              </p>
              <p className="mt-1 text-slate-600">
                You must allow audio permission to continue.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video
              ref={videoRef}
              className="h-[280px] w-full object-cover"
              autoPlay
              muted
              playsInline
            />
          </div>

          {mediaError ? <p className="text-sm text-red-600">{mediaError}</p> : null}
          {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
          {!canStart ? (
            <p className="text-sm text-amber-700">
              This interview is currently <strong>{interview.status}</strong> and cannot be started.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={enableCameraAndMic} disabled={mediaLoading}>
              {mediaLoading ? "Checking devices…" : "Enable camera & microphone"}
            </Button>
            <Button
              type="button"
              onClick={startInterview}
              disabled={starting || !mediaReady || !canStart}
              variant="secondary"
            >
              {starting
                ? "Starting…"
                : interview.status === "in_progress"
                  ? "Resume interview"
                  : "Start interview"}
            </Button>
            <Link href="/dashboard" className="inline-flex items-center">
              <Button type="button" variant="ghost">
                Back
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {startedPayload ? (
        <Card>
          <CardHeader
            title="Interview started"
            subtitle="Gemini integration hook is ready. Use the generated prompt payload for first turn."
          />
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Status: <span className="font-medium text-slate-900">{startedPayload.interview?.status}</span>
            </p>
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer font-medium text-slate-900">
                View generated initial prompt payload
              </summary>
              <pre className="mt-3 overflow-auto text-xs leading-5 text-slate-700">
                {JSON.stringify(startedPayload.initialPromptPayload, null, 2)}
              </pre>
            </details>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
