"use client";

import { useRouter } from "next/navigation";
import { History, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { useUploads } from "@/hooks/useUploads";
import { apiErrorMessage } from "@/services/api";

/** Every schedule photo the user has uploaded, with re-run + delete actions. */
export default function UploadsPage() {
  const router = useRouter();
  const { data: uploads = [], isLoading, isError, refetch } = useUploads();

  if (isLoading) return <LoadingState rows={3} />;
  if (isError) return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        title="Uploads"
        description="Your schedule photos — view them again, re-run the AI, or clean up old ones."
      />

      {uploads.length === 0 ? (
        <EmptyState
          icon={History}
          title="No uploads yet."
          body="Snap a photo of your class schedule and we'll turn it into an editable weekly plan."
          action={
            <Button onClick={() => router.push("/upload")}>
              <ImageUp className="size-4" aria-hidden="true" />
              Upload Schedule
            </Button>
          }
        />
      ) : (
        <UploadHistory uploads={uploads} />
      )}
    </>
  );
}
