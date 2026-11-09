import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormWizard } from "./FormWizard";

function Example({ save = () => {} }: { save?: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  return <FormWizard footer={<button onClick={save}>Save customer</button>}>
    <div className="grid grid-cols-2">
      <div><label htmlFor="first">First name</label><input id="first" required value={first} onChange={e => setFirst(e.target.value)} /></div>
      <div><label htmlFor="last">Last name</label><input id="last" value={last} onChange={e => setLast(e.target.value)} /></div>
    </div>
  </FormWizard>;
}

describe("FormWizard", () => {
  it("shows one question, blocks missing required input, retains answers and saves only after review", () => {
    const save = vi.fn();
    render(<Example save={save} />);
    expect(screen.getByLabelText("First name")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save customer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 1 of 2")).toBeVisible();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.keyDown(screen.getByLabelText("First name"), { key: "Enter" });
    expect(screen.getByLabelText("Last name")).toBeVisible();
    expect(screen.getByLabelText("First name")).not.toBeVisible();
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Rivera" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("First name")).toHaveValue("Alex");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Alex")).toBeVisible();
    expect(screen.getByText("Rivera")).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
    expect(save).toHaveBeenCalledOnce();
  });
});
