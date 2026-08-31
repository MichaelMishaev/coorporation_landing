import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderFormReady } from "./test-utils";

describe("SignupForm smoke test", () => {
  it("renders the form once the link and cities checks resolve", async () => {
    const fetchMock = await renderFormReady();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/proxy/support-links/test-code"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/proxy/cities"));
  });
});
