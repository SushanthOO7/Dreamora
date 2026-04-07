import { providerConfigs } from "@dreamora/shared";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function ProvidersPage() {
  return (
    <WorkspaceShell
      title="Providers"
      description="Configure local and third-party model providers. External models require API keys or auth details before users can route generations to them."
    >
      <div className="panel overflow-hidden rounded-[32px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 bg-white/70 px-5 py-4">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-black/8 bg-white px-3 py-2 text-sm">
              All providers
            </div>
            <div className="rounded-full border border-black/8 bg-white px-3 py-2 text-sm text-black/58">
              Third-party only
            </div>
          </div>
          <div className="flex gap-3">
            <button className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm">
              Profile settings
            </button>
            <button className="rounded-full bg-black px-4 py-2 text-sm text-white">
              Add provider
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_0.9fr_1.2fr] border-b border-black/8 px-5 py-4 text-sm font-medium text-black/54">
          <div>Provider</div>
          <div>Category</div>
          <div>Status</div>
          <div>Auth</div>
          <div>Default model</div>
        </div>

        {providerConfigs.map((provider) => (
          <div
            key={provider.name}
            className="grid grid-cols-[1.2fr_0.9fr_0.8fr_0.9fr_1.2fr] items-start border-b border-black/6 px-5 py-4 last:border-b-0"
          >
            <div>
              <p className="font-medium">{provider.name}</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-black/55">
                {provider.note}
              </p>
            </div>
            <div className="text-black/62">{provider.category}</div>
            <div>
              <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs text-[#4466b8]">
                {provider.status}
              </span>
            </div>
            <div className="text-black/62">{provider.auth}</div>
            <div className="text-black/75">{provider.defaultModel}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel rounded-[32px] p-6">
          <p className="text-sm text-black/45">Credential window</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            External provider auth
          </h2>
          <div className="mt-5 space-y-4">
            {[
              ["Provider", "OpenAI images"],
              ["Auth type", "API key"],
              ["Secret storage", "Encrypted server environment"],
              ["Default model", "gpt-image-1"]
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[22px] border border-black/8 bg-white px-4 py-3"
              >
                <span className="text-sm text-black/48">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[32px] p-6">
          <p className="text-sm text-black/45">Profile settings</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            User defaults
          </h2>
          <div className="mt-5 space-y-4">
            {[
              ["Preferred image model", "Dreamora FLUX local"],
              ["Preferred video model", "Dreamora Wan 2.2 local"],
              ["Default image quality", "High"],
              ["Default video ratio", "16:9"]
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-[22px] border border-black/8 bg-white px-4 py-3"
              >
                <span className="text-sm text-black/48">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
