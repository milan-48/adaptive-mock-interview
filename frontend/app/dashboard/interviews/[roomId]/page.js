"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Video,
  VideoOff,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/states";
import { apiFetch } from "@/lib/api";

const TYPE_LABEL = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System design",
};

// TODO: Re-enable mandatory camera after live-call conflict is resolved.
const TEMPORARILY_DISABLE_CAMERA_CHECK = true;

function trackEnabled(stream, kind) {
  if (!stream) return false;
  return stream
    .getTracks()
    .some((t) => t.kind === kind && t.readyState === "live" && t.enabled);
}

function interviewerAvatarStyle(style) {
  if (style === "female") {
    return "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white";
  }
  return "bg-gradient-to-br from-sky-500 to-indigo-600 text-white";
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const v = String(reader.result || "");
      const base64 = v.includes(",") ? v.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function CandidateInterviewRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = decodeURIComponent(String(params?.roomId || ""));
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaStatus, setMediaStatus] = useState({ camera: false, mic: false });
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);

  const [started, setStarted] = useState(false);
  const [interviewer, setInterviewer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [answerText, setAnswerText] = useState("");
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [turnError, setTurnError] = useState("");
  const [endingCall, setEndingCall] = useState(false);
  const [endCallError, setEndCallError] = useState("");

  const [recording, setRecording] = useState(false);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState("");
  const [recordedAudioMimeType, setRecordedAudioMimeType] = useState("audio/webm");
  const [recordedTranscript, setRecordedTranscript] = useState("");

  const cameraRequired = !TEMPORARILY_DISABLE_CAMERA_CHECK;
  const cameraReady = mediaStatus.camera;
  const micReady = mediaStatus.mic;
  const mediaReady = micReady && (cameraRequired ? cameraReady : true);

  const canStart =
    interview?.status === "scheduled" || interview?.status === "in_progress";

  const canSubmitTurn = useMemo(() => {
    return Boolean(answerText.trim() || recordedAudioBase64) && !submittingTurn;
  }, [answerText, recordedAudioBase64, submittingTurn]);
  const latestInterviewerMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "interviewer") {
        return String(messages[i].text || "").trim();
      }
    }
    return "";
  }, [messages]);

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) {
          t.stop();
        }
        streamRef.current = null;
      }
    };
  }, [roomId]);

  function playGeneratedAudio(audio) {
    if (!audio?.base64) return;
    const mime = audio.mimeType || "audio/mpeg";
    const player = new Audio(`data:${mime};base64,${audio.base64}`);
    player.play().catch(() => {
      // Autoplay may be blocked; user can continue via text.
    });
  }

  function attachVideoNode(node) {
    videoRef.current = node;
    if (!node || !streamRef.current) return;
    if (node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }

  async function enableDevices() {
    setMediaLoading(true);
    setMediaError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera/microphone access");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraRequired,
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

      setMicMuted(false);
      setCameraMuted(false);
      setMediaStatus({
        camera: cameraRequired ? trackEnabled(stream, "video") : true,
        mic: trackEnabled(stream, "audio"),
      });
    } catch (err) {
      setMediaError(
        err.message ||
          (cameraRequired
            ? "Camera and microphone access is required"
            : "Microphone access is required"),
      );
      setMediaStatus({ camera: false, mic: false });
    } finally {
      setMediaLoading(false);
    }
  }

  function toggleMic() {
    if (!streamRef.current) return;
    const tracks = streamRef.current.getAudioTracks();
    if (!tracks.length) return;
    const nextMuted = !micMuted;
    for (const t of tracks) t.enabled = !nextMuted;
    setMicMuted(nextMuted);
    setMediaStatus((s) => ({ ...s, mic: !nextMuted }));
  }

  function toggleCamera() {
    if (!cameraRequired || !streamRef.current) return;
    const tracks = streamRef.current.getVideoTracks();
    if (!tracks.length) return;
    const nextMuted = !cameraMuted;
    for (const t of tracks) t.enabled = !nextMuted;
    setCameraMuted(nextMuted);
    setMediaStatus((s) => ({ ...s, camera: !nextMuted }));
  }

  async function startRecording() {
    if (!streamRef.current) {
      setTurnError("Enable microphone first.");
      return;
    }
    const audioTracks = streamRef.current.getAudioTracks();
    if (!audioTracks.length) {
      setTurnError("No microphone track detected.");
      return;
    }
    const audioStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioStream);
    recordedChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    recorder.onstop = async () => {
      const mime = recorder.mimeType || "audio/webm";
      const blob = new Blob(recordedChunksRef.current, { type: mime });
      const base64 = await toBase64(blob);
      setRecordedAudioBase64(base64);
      setRecordedAudioMimeType(mime);
      setRecordedTranscript("");
      setRecording(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setTurnError("");
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function startInterview() {
    if (!mediaReady) {
      setStartError(
        cameraRequired
          ? "Enable and test camera + microphone before starting."
          : "Enable and test microphone before starting.",
      );
      return false;
    }
    if (!canStart) {
      setStartError("This interview cannot be started from its current status.");
      return false;
    }

    setStarting(true);
    setStartError("");
    try {
      const data = await apiFetch("/v1/interviews/start-by-room", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      setInterview(data.interview || interview);
      setInterviewer(data.interviewer || null);
      setStarted(true);

      const q = data.question?.text?.trim();
      if (q) {
        setMessages([{ role: "interviewer", text: q }]);
      } else {
        setMessages([]);
      }
      playGeneratedAudio(data.audio);
      return true;
    } catch (err) {
      setStartError(err.message || "Could not start interview");
      return false;
    } finally {
      setStarting(false);
    }
  }

  async function submitTurn() {
    const typed = answerText.trim();
    if (!typed && !recordedAudioBase64) {
      setTurnError("Type an answer or record audio first.");
      return;
    }
    setSubmittingTurn(true);
    setTurnError("");
    try {
      if (typed) {
        setMessages((prev) => [...prev, { role: "candidate", text: typed }]);
      } else {
        setMessages((prev) => [...prev, { role: "candidate", text: "(voice answer)" }]);
      }

      const res = await apiFetch(`/v1/interviews/by-room/${encodeURIComponent(roomId)}/candidate-turn`, {
        method: "POST",
        body: JSON.stringify({
          answerText: typed,
          answerAudioBase64: recordedAudioBase64 || "",
          answerAudioMimeType: recordedAudioMimeType || "",
        }),
      });

      setInterview(res.interview || interview);
      if (res.interviewer) setInterviewer(res.interviewer);
      if (res.transcript) setRecordedTranscript(res.transcript);

      const nextQuestion = String(res.question?.text || "").trim();
      if (nextQuestion) {
        setMessages((prev) => [...prev, { role: "interviewer", text: nextQuestion }]);
      }

      if (res.policyResult?.warningToCandidate) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `Warning: ${res.policyResult.warningToCandidate}` },
        ]);
      }

      playGeneratedAudio(res.audio);
      setAnswerText("");
      setRecordedAudioBase64("");
      setRecordedAudioMimeType("audio/webm");
    } catch (err) {
      setTurnError(err.message || "Could not submit answer");
    } finally {
      setSubmittingTurn(false);
    }
  }

  async function endInterviewCall() {
    if (endingCall) return;
    setEndingCall(true);
    setEndCallError("");
    try {
      await apiFetch(`/v1/interviews/by-room/${encodeURIComponent(roomId)}/end-call`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Candidate clicked end call",
        }),
      });
      router.push("/dashboard");
    } catch (err) {
      setEndCallError(err.message || "Could not end interview call");
    } finally {
      setEndingCall(false);
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
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[#1d4ed8] hover:underline"
          >
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

      {!started ? (
        <Card>
          <CardHeader
            title="Pre-interview check"
            subtitle={
              cameraRequired
                ? "Camera and microphone access is mandatory before starting."
                : "Microphone access is mandatory before starting. Camera check is temporarily disabled."
            }
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-medium text-slate-900">
                  Camera:{" "}
                  <span
                    className={
                      cameraRequired
                        ? cameraReady
                          ? "text-emerald-700"
                          : "text-amber-700"
                        : "text-slate-600"
                    }
                  >
                    {cameraRequired ? (cameraReady ? "Ready" : "Not ready") : "Temporarily disabled"}
                  </span>
                </p>
                <p className="mt-1 text-slate-600">
                  {cameraRequired
                    ? "You must allow video permission to continue."
                    : "Camera requirement will be turned back on after your call."}
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

            {cameraRequired ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                <video
                  ref={videoRef}
                  className="h-[280px] w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Camera preview is temporarily turned off for this session.
              </div>
            )}

            {mediaError ? <p className="text-sm text-red-600">{mediaError}</p> : null}
            {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
            {!canStart ? (
              <p className="text-sm text-amber-700">
                This interview is currently <strong>{interview.status}</strong> and cannot be started.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={enableDevices} disabled={mediaLoading}>
                {mediaLoading
                  ? "Checking devices…"
                  : cameraRequired
                    ? "Enable camera & microphone"
                    : "Enable microphone"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setStartError("");
                  setStartConfirmOpen(true);
                }}
                disabled={starting || !canStart}
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
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0b1220] p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="relative min-h-[480px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220]">
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                    Room {interview.roomId}
                  </span>
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
                    Live interview
                  </span>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <div
                    className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold shadow-lg ${interviewerAvatarStyle(
                      interviewer?.avatarStyle,
                    )}`}
                  >
                    {(interviewer?.name || "AI").slice(0, 1)}
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {interviewer?.name || "AI Interviewer"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300 capitalize">
                    {interviewer?.gender || "assistant"} interviewer
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {interviewer?.voiceEnabled ? "ElevenLabs voice active" : "Voice fallback mode"}
                  </p>
                </div>

                <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    Live prompt
                  </p>
                  <p className="line-clamp-2 text-sm text-white/90">
                    {latestInterviewerMessage || "Waiting for interviewer question..."}
                  </p>
                </div>

                <div className="absolute right-4 top-4 w-40 overflow-hidden rounded-xl border border-white/20 bg-black/40 shadow-md">
                  {cameraRequired && streamRef.current ? (
                    <video
                      ref={attachVideoNode}
                      className="h-28 w-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-slate-900/80 text-xs font-medium text-slate-300">
                      Camera {cameraRequired ? "off" : "disabled"}
                    </div>
                  )}
                  <div className="border-t border-white/10 px-2 py-1 text-center text-[11px] font-medium text-slate-200">
                    You
                  </div>
                </div>
              </div>

              <div className="flex min-h-[480px] flex-col rounded-2xl border border-white/10 bg-slate-900/75 p-4">
                <p className="text-sm font-semibold text-white">Conversation</p>
                <div className="mt-3 flex-1 space-y-3 overflow-auto pr-1">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-400">Waiting for first question…</p>
                  ) : null}
                  {messages.map((m, idx) => (
                    <div
                      key={`${m.role}-${idx}`}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        m.role === "interviewer"
                          ? "border-blue-400/20 bg-blue-500/10 text-blue-50"
                          : m.role === "candidate"
                            ? "border-slate-500/30 bg-slate-700/30 text-slate-100"
                            : "border-amber-400/20 bg-amber-500/10 text-amber-100"
                      }`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                        {m.role === "interviewer"
                          ? "AI interviewer"
                          : m.role === "candidate"
                            ? "You"
                            : "Policy"}
                      </p>
                      <p>{m.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <textarea
                    className="min-h-[92px] w-full resize-y rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-blue-400/50"
                    placeholder="Type your answer here (or record voice below)"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                  />
                  {recordedAudioBase64 ? (
                    <p className="mt-2 text-xs text-emerald-300">
                      Voice answer recorded ({recordedAudioMimeType}).
                    </p>
                  ) : null}
                  {recordedTranscript ? (
                    <p className="mt-1 text-xs text-slate-300">
                      Transcript: <span className="font-medium">{recordedTranscript}</span>
                    </p>
                  ) : null}
                  {turnError ? <p className="mt-2 text-sm text-red-300">{turnError}</p> : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <button
                type="button"
                onClick={toggleMic}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  micMuted
                    ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {micMuted ? "Unmute" : "Mute"}
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                disabled={!cameraRequired}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !cameraRequired
                    ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {cameraMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                {cameraRequired ? (cameraMuted ? "Enable cam" : "Disable cam") : "Camera disabled"}
              </button>

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  recording
                    ? "border border-amber-300/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {recording ? "Stop rec" : "Record"}
              </button>

              <button
                type="button"
                onClick={submitTurn}
                disabled={!canSubmitTurn || interview?.status === "suspended"}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                  !canSubmitTurn || interview?.status === "suspended"
                    ? "cursor-not-allowed bg-blue-500/40 text-blue-100"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Send className="h-4 w-4" />
                {submittingTurn ? "Sending..." : "Send answer"}
              </button>

              <button
                type="button"
                onClick={endInterviewCall}
                disabled={endingCall}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition ${
                  endingCall
                    ? "cursor-not-allowed bg-red-500/60"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                <PhoneOff className="h-4 w-4" />
                {endingCall ? "Ending..." : "End call"}
              </button>
            </div>
            {endCallError ? (
              <p className="mt-2 text-center text-sm text-red-300">{endCallError}</p>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={startConfirmOpen}
        title="Confirm interview start"
        error={startError}
        confirmLabel={interview?.status === "in_progress" ? "Confirm resume" : "Confirm start"}
        cancelLabel="Cancel"
        loading={starting}
        onCancel={() => {
          if (starting) return;
          setStartConfirmOpen(false);
          setStartError("");
        }}
        onConfirm={async () => {
          const startedNow = await startInterview();
          if (startedNow) {
            setStartConfirmOpen(false);
          }
        }}
      >
        <p>Please verify the room code before entering the interview.</p>
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Room ID</p>
          <p className="mt-1 text-2xl font-extrabold tracking-wide text-slate-900">
            {interview?.roomId || roomId}
          </p>
        </div>
        {!mediaReady ? (
          <p className="mt-3 text-xs text-amber-700">
            {cameraRequired
              ? "Enable camera and microphone first, then confirm start."
              : "Enable microphone first, then confirm start."}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
