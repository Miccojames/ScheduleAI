"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { ChangePasswordCard } from "@/components/settings/ChangePasswordCard";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { ReminderPrefsCard } from "@/components/settings/ReminderPrefsCard";
import { useLogout, useMe, useUpdateProfile } from "@/hooks/useAuth";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name."),
  lastName: z.string().trim().min(1, "Enter your last name."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { data: user } = useMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: "", lastName: "" },
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) reset({ firstName: user.firstName, lastName: user.lastName });
  }, [user, reset]);

  return (
    <>
      <PageHeader title="Settings" description="Your profile, password, and notification preferences." />

      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Profile</CardTitle>
            <CardDescription>Update the name your classmates and teachers see.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((values) => {
                setSaved(false);
                updateProfile.mutate(values, { onSuccess: () => setSaved(true) });
              })}
              className="space-y-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    aria-invalid={Boolean(errors.firstName)}
                    {...register("firstName")}
                  />
                  {errors.firstName ? (
                    <p className="text-xs text-destructive">{errors.firstName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    aria-invalid={Boolean(errors.lastName)}
                    {...register("lastName")}
                  />
                  {errors.lastName ? (
                    <p className="text-xs text-destructive">{errors.lastName.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} readOnly disabled />
                <p className="text-xs text-muted-foreground">Your email address can&apos;t be changed.</p>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={updateProfile.isPending}>
                  <Save className="size-4" aria-hidden="true" />
                  Save Changes
                </Button>
                {saved && !updateProfile.isPending ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
                    Saved.
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <ChangePasswordCard />

        <ReminderPrefsCard />

        <NotificationsCard />

        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Account</CardTitle>
            <CardDescription>Sign out of ScheduleAI on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex items-start gap-3 py-5">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                ScheduleAI v1.0 — AI Schedule Scanner &amp; Planner
              </p>
              <Separator className="my-3 w-16" />
              <p className="text-xs text-muted-foreground">
                Photograph a printed timetable and get a clean, editable weekly plan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}