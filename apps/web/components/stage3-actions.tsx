"use client";

import type { ProviderConfig } from "@dreamora/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createProject,
  createPrompt,
  createProvider,
  updateProviderCredentials
} from "../lib/client-api";

function FormMessage({
  error,
  success
}: {
  error: string;
  success: string;
}) {
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (success) {
    return <p className="text-sm text-emerald-700">{success}</p>;
  }

  return null;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return (
    <form
      className="panel rounded-[30px] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = {
          name: String(formData.get("name") ?? "").trim(),
          format: String(formData.get("format") ?? "").trim(),
          status: String(formData.get("status") ?? "Draft").trim(),
          summary: String(formData.get("summary") ?? "").trim()
        };

        if (!payload.name || !payload.format || !payload.summary) {
          setError("Name, format, and summary are required.");
          setSuccess("");
          return;
        }

        setError("");
        setSuccess("");

        startTransition(async () => {
          try {
            await createProject(payload);
            setSuccess("Project created.");
            (event.currentTarget as HTMLFormElement).reset();
            router.refresh();
          } catch {
            setError("Could not create project.");
          }
        });
      }}
    >
      <p className="text-sm text-black/45">Create project</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input name="name" placeholder="Project name" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <input name="format" placeholder="Format (image, video, mixed)" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <input name="status" placeholder="Status (Draft/In progress/Ready)" defaultValue="Draft" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2" />
        <textarea name="summary" placeholder="Summary" className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={isPending} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {isPending ? "Creating..." : "Create"}
        </button>
        <FormMessage error={error} success={success} />
      </div>
    </form>
  );
}

export function CreatePromptForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return (
    <form
      className="panel rounded-[30px] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const rawTags = String(formData.get("tags") ?? "");
        const payload = {
          title: String(formData.get("title") ?? "").trim(),
          engine: String(formData.get("engine") ?? "").trim(),
          type: String(formData.get("type") ?? "").trim(),
          summary: String(formData.get("summary") ?? "").trim(),
          tags: rawTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        };

        if (!payload.title || !payload.engine || !payload.type || !payload.summary) {
          setError("Title, engine, type, and summary are required.");
          setSuccess("");
          return;
        }

        setError("");
        setSuccess("");

        startTransition(async () => {
          try {
            await createPrompt(payload);
            setSuccess("Prompt preset created.");
            (event.currentTarget as HTMLFormElement).reset();
            router.refresh();
          } catch {
            setError("Could not create prompt preset.");
          }
        });
      }}
    >
      <p className="text-sm text-black/45">Create prompt preset</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input name="title" placeholder="Preset title" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <input name="engine" placeholder="Engine" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <input name="type" placeholder="Type (Still image, Video)" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <input name="tags" placeholder="Tags comma separated" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
        <textarea name="summary" placeholder="Summary" className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={isPending} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {isPending ? "Creating..." : "Create"}
        </button>
        <FormMessage error={error} success={success} />
      </div>
    </form>
  );
}

export function ProviderActions({
  providers
}: {
  providers: ProviderConfig[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="panel rounded-[30px] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const payload = {
            name: String(formData.get("name") ?? "").trim(),
            category: String(formData.get("category") ?? "").trim(),
            auth: String(formData.get("auth") ?? "").trim(),
            defaultModel: String(formData.get("defaultModel") ?? "").trim(),
            note: String(formData.get("note") ?? "").trim()
          };

          if (!payload.name || !payload.category || !payload.auth || !payload.defaultModel) {
            setError("Provider name, category, auth type, and default model are required.");
            setMessage("");
            return;
          }

          setError("");
          setMessage("");

          startTransition(async () => {
            try {
              await createProvider(payload);
              setMessage("Provider created.");
              (event.currentTarget as HTMLFormElement).reset();
              router.refresh();
            } catch {
              setError("Could not create provider.");
            }
          });
        }}
      >
        <p className="text-sm text-black/45">Add provider</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="name" placeholder="Provider name" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
          <input name="category" placeholder="Category (Third-party API)" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
          <input name="auth" placeholder="Auth type (API key)" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
          <input name="defaultModel" placeholder="Default model" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" />
          <textarea name="note" placeholder="Optional note" className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button disabled={isPending} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {isPending ? "Saving..." : "Add provider"}
          </button>
          <FormMessage error={error} success={message} />
        </div>
      </form>

      <div className="panel rounded-[30px] p-5">
        <p className="text-sm text-black/45">Credential status</p>
        <div className="mt-4 space-y-2">
          {providers.map((provider) => (
            <div
              key={provider.id ?? provider.name}
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{provider.name}</p>
                <p className="text-xs text-black/50">{provider.status}</p>
              </div>
              {provider.id ? (
                <button
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateProviderCredentials(
                          provider.id!,
                          !provider.secretConfigured,
                          !provider.secretConfigured ? "configured via UI" : undefined
                        );
                        router.refresh();
                      } catch {
                        setError("Could not update credentials.");
                      }
                    });
                  }}
                  className="rounded-full border border-black/10 bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                >
                  {provider.secretConfigured ? "Mark unconfigured" : "Mark configured"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
