"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, RefreshCw, ScanLine } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ProcessingSteps } from "@/components/upload/ProcessingSteps";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { useProcessUpload } from "@/hooks/useProcessUpload";
import { useUploadSchedule } from "@/hooks/useUploadSchedule";
import { waitForUpload } from "@/hooks/useUploads";
import { ApiError } from "@/services/api";
import { useReviewStore } from "@/stores/reviewStore";

type Stage = "idle" | "uploading" | "processing" | "error" | "empty";

/** Upload → process → hand off to the review screen. */
export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  // Server-provided failure message (ApiError.message); null → static copy.
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const upload = useUploadSchedule();
  const process = useProcessUpload();
  const setReview = useReviewStore((state) => state.setReview);

  const busy = stage === "uploading" || stage === "processing";

  async function handleProcess() {
    if (!file) return;
    try {
      setStage("uploading");
      const uploadResult = await upload.mutateAsync(file);

      setStage("processing");
      const uploadId = uploadResult.upload.id;
      // Kick the background scan (202 — returns instantly), then poll until
      // the server finishes. The scan keeps running even if this tab closes;
      // the Uploads page shows its progress either way.
      await process.mutateAsync(uploadId);
      const status = await waitForUpload(uploadId);

      if (status.upload.status === "FAILED") {
        setFailureMessage(status.upload.error ?? null);
        setStage("error");
        return;
      }

      if (status.entries.length === 0) {
        setStage("empty");
        return;
      }

      setReview({
        detected: status.entries,
        uploadId,
        provider: status.provider ?? "mock",
        imageUrl: status.upload.imageUrl ?? null,
      });
      router.push("/upload/review");
    } catch (error) {
      // Surface the server's honest error message when we have one (quota /
      // timeout / provider outage); otherwise fall back to the static copy.
      setFailureMessage(
        error instanceof ApiError && error.message ? error.message : null,
      );
      setStage("error");
    }
  }

  function reset() {
    setFile(null);
    setStage("idle");
    setFailureMessage(null);
    upload.reset();
    process.reset();
  }

  return (
    <>
      <PageHeader
        title="Scan a Timetable"
        description="Snap a photo of any timetable — class schedule, shift roster, gym slots — and we'll turn it into an editable weekly plan."
      />

      <div className="mx-auto max-w-2xl space-y-4">
        {stage === "uploading" || stage === "processing" ? (
          <>
            <ProcessingSteps completedSteps={stage === "uploading" ? 1 : 3} />
            <p className="text-center text-xs text-muted-foreground">
              Scanning usually takes about a minute. The scan keeps running even if you
              leave this page — you&apos;ll find it under Uploads.
            </p>
          </>
        ) : null}

        {stage === "error" ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-card text-destructive shadow-sm">
              <ImageOff className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {failureMessage ??
                "Sorry, we couldn't read this schedule clearly. Try uploading a clearer image."}
            </h2>
            {failureMessage ? null : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Make sure the whole schedule is inside the photo and the text is readable.
              </p>
            )}
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={reset}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Try Again
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "empty" ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ScanLine className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              No classes were detected in this image.
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Try a straighter photo with better lighting, or add your events by hand.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={reset}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <a href="/add-class">Add class manually instead</a>
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "idle" ? (
          <>
            <UploadDropzone file={file} onFileChange={setFile} disabled={busy} />

            {file ? (
              <div className="flex justify-end">
                <Button onClick={handleProcess} disabled={busy}>
                  <ScanLine className="size-4" aria-hidden="true" />
                  Process Schedule
                </Button>
              </div>
            ) : null}

            <Alert className="border-border bg-muted text-muted-foreground">
              <AlertTitle>Tips for a better scan</AlertTitle>
              <AlertDescription>
                Photograph the schedule straight-on, avoid shadows, and keep the subject names
                and time ranges in focus.
              </AlertDescription>
            </Alert>
          </>
        ) : null}
      </div>
    </>
  );
}