import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DirectProposalCreateComponent } from "../../../../components/governance/direct-proposal-create.component";

describe("direct proposal composer reuse", () => {
  it("renders shared guided composer surface without introducing a divergent composer", () => {
    render(
      <DirectProposalCreateComponent
        communityId={3}
        composerMode="guided"
        proposalMode="binary"
        numOptions={2}
        title="Test proposal"
        summary="Test summary"
        description="ipfs://desc"
        actions={[]}
        isSubmitting={false}
        errorMessage={null}
        successMessage={null}
        statusMessage={null}
        onComposerModeChange={() => undefined}
        onProposalModeChange={() => undefined}
        onNumOptionsChange={() => undefined}
        onTitleChange={() => undefined}
        onSummaryChange={() => undefined}
        onDescriptionChange={() => undefined}
        onSubmit={() => undefined}
        onRemoveAction={() => undefined}
        onMoveAction={() => undefined}
        composerSection={<div>Guided action composer</div>}
        actionsSection={<div>Actions queued (0)</div>}
      />
    );

    expect(screen.getByText(/guided action composer/i)).toBeInTheDocument();
    expect(screen.getByText(/actions queued/i)).toBeInTheDocument();
  });
});
