"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileImage, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatDate } from "@/lib/time";
import { apiErrorMessage } from "@/services/api";
import { uploadApi } from "@/services/upload.api";
import { useDeleteUpload, useReprocessUpload } from "@/hooks/useUploads";
import { useReviewStore } from "@/stores/reviewStore";
import { cn } from "cn";
import type { UploadRecord, UploadStatus } from "@/types";

const STATUS_STYLES: Record<UploadStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50" },
  PROCESSING: {
    label: "Processing",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 animate-pulse",
  },
  COMPLETED: { label: "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" },
  FAILED: { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50" },
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  return (
    <Badge className={cn("border", style.className)}>
      {style.label}
    </Badge>
  );
}

/** Upload history list: view the image, re-run AI extraction, or delete. */
export function UploadHistory({ uploads }: { uploads: UploadRecord[] }) {
  const router = useRouter();
  const setReview = useReviewStore((state) => state.setReview);
  const deleteUpload = useDeleteUpload();
  const reprocess = useReprocessUpload();

  const [deleteTarget, setDeleteTarget] = useState<UploadRecord | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  async function handleViewImage(upload: UploadRecord) {
    setViewingId(upload.id);
    try {
      await uploadApi.openImageInNewTab(upload.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't open this image."));
    } finally {
      setViewingId(null);
    }
  }

  async function handleRerun(upload: UploadRecord) {
    setRerunningId(upload.id);
    try {
      // Already scanned → reopen the stored result without burning another
      // AI call (waitForUpload isn't needed; GET resolves instantly).
      if (upload.processingStatus === "COMPLETED") {
        const status = await uploadApi.get(upload.id);
        if (status.entries.length === 0) {
          toast.info(status.message ?? "No classes were detected in this image.");
          return;
        }
        setReview({
          detected: status.entries,
          uploadId: upload.id,
          provider: status.provider ?? "mock",
          imageUrl: status.upload.imageUrl ?? null,
        });
        router.push("/upload/review");
        return;
      }

      const result = await reprocess.mutateAsync(upload.id);
      if (result.entries.length === 0) {
        toast.info(result.message ?? "No classes were detected in this image.");
        return;
      }
      setReview({
        detected: result.entries,
        uploadId: upload.id,
        provider: result.provider,
        imageUrl: result.upload.imageUrl ?? null,
      });
      router.push("/upload/review");
    } catch {
      // Toast already shown by the mutation hook.
    } finally {
      setRerunningId(null);
    }
  }

  return (
    <>
      <ul className="space-y-3">
        {uploads.map((upload) => {
          const busy = rerunningId === upload.id;
          return (
            <li
              key={upload.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                    <FileImage className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-zinc-900" title={upload.fileName}>
                        {upload.fileName}
                      </h2>
                      <StatusBadge status={upload.processingStatus} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatFileSize(upload.fileSize)} · Uploaded {formatDate(new Date(upload.createdAt))}
                    </p>
                    {upload.processingStatus === "FAILED" && upload.error ? (
                      <p className="mt-1.5 text-xs text-rose-600">{upload.error}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleViewImage(upload)}
                    disabled={viewingId === upload.id}
                  >
                    {viewingId === upload.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileImage className="size-4" aria-hidden="true" />
                    )}
                    View image
                  </Button>
                  {upload.processingStatus === "COMPLETED" || upload.processingStatus === "FAILED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRerun(upload)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                      Re-run AI
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setDeleteTarget(upload)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this upload?"
        description={`“${deleteTarget?.fileName ?? ""}” and its stored image will be permanently removed. Classes you already saved are not affected.`}
        isPending={deleteUpload.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteUpload.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </>
  );
}
