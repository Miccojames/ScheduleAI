"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BellRing, Info, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/common/PageHeader";
import { useLogout, useMe, useUpdateProfile } from "@/hooks/useAuth";
import { REMINDER_OPTIONS, useReminderStore } from "@/stores/reminderStore";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name."),
  lastName: z.string().trim().min(1, "Enter your last name."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { data: user } = useMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  const reminderLeadMinutes = useReminderStore((state) => state.reminderLeadMinutes);
  const setReminderLeadMinutes = useReminderStore((state) => state.setReminderLeadMinutes);

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
      <PageHeader title="Settings" description="Your profile and reminder preferences." />

      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-2xl border-gray-200 shadow-sm">
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
                    <p className="text-xs text-rose-600">{errors.firstName.message}</p>
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
                    <p className="text-xs text-rose-600">{errors.lastName.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} readOnly disabled />
                <p className="text-xs text-gray-500">Your email address can&apos;t be changed.</p>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={updateProfile.isPending}>
                  <Save className="size-4" aria-hidden="true" />
                  Save Changes
                </Button>
                {saved && !updateProfile.isPending ? (
                  <p className="text-sm text-emerald-600" role="status">
                    Saved.
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Reminder preferences</CardTitle>
            <CardDescription>
              How early the dashboard should warn you before a class starts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="reminder-lead">Remind me</Label>
              <Select
                value={String(reminderLeadMinutes)}
                onValueChange={(value) => setReminderLeadMinutes(Number(value))}
              >
                <SelectTrigger id="reminder-lead" className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes before
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <BellRing className="size-3.5" aria-hidden="true" />
                You&apos;ll see a reminder banner when a class is about to begin.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Account</CardTitle>
            <CardDescription>Sign out of ScheduleAI on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-sm">
          <CardContent className="flex items-start gap-3 py-5">
            <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-900">
                ScheduleAI v1.0 — AI Schedule Scanner &amp; Planner
              </p>
              <Separator className="my-3 w-16" />
              <p className="text-xs text-gray-500">
                Photograph a printed class schedule and get a clean, editable weekly plan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}