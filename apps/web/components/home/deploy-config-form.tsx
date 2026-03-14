import type { CommunityDeploymentConfig } from "../../lib/deploy/config";

type Props = {
  value: CommunityDeploymentConfig;
  deployerAddress?: `0x${string}`;
  validationErrors: string[];
  onChange: (next: CommunityDeploymentConfig) => void;
};

function updateField(
  value: CommunityDeploymentConfig,
  onChange: (next: CommunityDeploymentConfig) => void,
  key: keyof CommunityDeploymentConfig,
  nextValue: string
) {
  onChange({
    ...value,
    [key]: nextValue
  });
}

export function DeployConfigForm({ value, deployerAddress, validationErrors, onChange }: Props) {
  return (
    <section className="card space-y-3">
      <h3 className="text-base font-semibold">Deployment Configuration</h3>
      <p className="text-sm text-muted-foreground">
        Configure the community before starting deployment. Start deploy is enabled only after required fields are valid.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Community name</span>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5"
            value={value.communityName}
            onChange={(event) => updateField(value, onChange, "communityName", event.target.value)}
            placeholder="Shift Builders Collective"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Treasury vault address</span>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
            value={value.treasuryVault}
            onChange={(event) => updateField(value, onChange, "treasuryVault", event.target.value)}
            placeholder="0x..."
          />
        </label>

        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Community description</span>
          <textarea
            className="min-h-20 w-full rounded border border-border bg-background px-2 py-1.5"
            value={value.communityDescription}
            onChange={(event) => updateField(value, onChange, "communityDescription", event.target.value)}
            placeholder="Short purpose and operating model for this community"
          />
        </label>

        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Community metadata URI (optional)</span>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5"
            value={value.communityMetadataUri}
            onChange={(event) => updateField(value, onChange, "communityMetadataUri", event.target.value)}
            placeholder="ipfs://..."
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Treasury stable token address</span>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
            value={value.treasuryStableToken}
            onChange={(event) => updateField(value, onChange, "treasuryStableToken", event.target.value)}
            placeholder="0x..."
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Supported tokens (comma separated)</span>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
            value={value.supportedTokensCsv}
            onChange={(event) => updateField(value, onChange, "supportedTokensCsv", event.target.value)}
            placeholder="0xTokenA,0xTokenB"
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">Deployer wallet: {deployerAddress ?? "Not connected"}</p>

      {validationErrors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-emerald-600">Configuration looks valid.</p>
      )}
    </section>
  );
}
