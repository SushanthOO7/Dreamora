import { settingsGroups } from "@dreamora/shared";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function SettingsPage() {
  return (
    <WorkspaceShell
      title="Settings"
      description="Manage local runtime defaults, profile behavior, and the single-server infrastructure settings used by Dreamora."
    >
      <div className="grid gap-5 xl:grid-cols-2">
        {settingsGroups.map((group) => (
          <section key={group.title} className="panel rounded-[30px] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.22em] text-black/35">
              {group.title}
            </p>
            <p className="mt-3 text-sm leading-6 text-black/56">
              {group.description}
            </p>
            <div className="mt-5 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-[22px] border border-black/8 bg-white/75 px-4 py-3"
                >
                  <span className="text-sm text-black/50">{item.label}</span>
                  <span className="text-sm font-medium text-black">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="panel rounded-[32px] p-6">
        <p className="text-sm text-black/45">Profile</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Creative preferences
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Display name", "Susha"],
            ["Default destination", "Local V100 runtime"],
            ["Review style", "Side-by-side outputs"],
            ["Notifications", "In-app only"]
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[22px] border border-black/8 bg-white px-4 py-4"
            >
              <p className="text-sm text-black/45">{label}</p>
              <p className="mt-2 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
