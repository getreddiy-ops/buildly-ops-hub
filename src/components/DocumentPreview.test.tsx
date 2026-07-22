import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPreview } from "./DocumentPreview";

describe("DocumentPreview compliance notice", () => {
  it.each(["estimate", "invoice", "contract"] as const)(
    "shows jurisdiction review guidance on %s documents",
    (type) => {
      render(<DocumentPreview branding={null} type={type} body={type === "contract" ? "Test agreement" : undefined} />);

      expect(screen.getByText(/Important state and local law notice/i)).toBeInTheDocument();
      expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
    },
  );
});
